// @ts-nocheck — Emotion styled children type quirk with TS strict mode
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { NextSeo } from 'next-seo'
import styled from '@emotion/styled'
import { keyframes } from '@emotion/react'
import { useForm, Controller } from 'react-hook-form'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import TransportCalendar from '../components/transport/TransportCalendar'
import axios from 'axios'
import { Toaster } from 'react-hot-toast'
import Logo from '../public/icons/Logo'
import BackButton from '../components/form/back-button/BackButton'
import Button from '../components/button/Button'

/* ── price constants ─────────────────────────────────────── */
const PRICE_LUGGAGE_PER_DAY = 1500
const PRICE_BACKPACK_FLAT   = 1000
const PRICE_LATE_PER_BAG    = 500
const PRICE_DELIVERY_FLAT   = 2500

type FormValues = {
  luggage: number
  backpacks: number
  arrivalDate: string
  departureDate: string
  arrivalTime: string
  departureTime: string
  delivery: boolean
  late: boolean
  name: string
  email: string
  phone: string
  hotel: string
  deliveryAddress: string
  comment: string
}

const daysBetween = (a?: string, b?: string) => {
  if (!a || !b) return 0
  const s = new Date(a).getTime()
  const e = new Date(b).getTime()
  if (isNaN(s) || isNaN(e) || e < s) return 0
  return Math.max(1, Math.ceil((e - s) / 86400000))
}

const calcPrice = (v: Partial<FormValues>) => {
  const days     = daysBetween(v.arrivalDate, v.departureDate) || 1
  const luggage  = Number(v.luggage)   || 0
  const backpacks= Number(v.backpacks) || 0
  const base     = luggage * PRICE_LUGGAGE_PER_DAY * days + backpacks * PRICE_BACKPACK_FLAT
  const late     = v.late     ? luggage * PRICE_LATE_PER_BAG : 0
  const delivery = v.delivery ? PRICE_DELIVERY_FLAT : 0
  return { days, base, late, delivery, total: base + late + delivery }
}

const deriveStorageType = (v: Partial<FormValues>): string => {
  const days = daysBetween(v.arrivalDate, v.departureDate)
  if (v.delivery) return 'Hotel Delivery'
  if (days > 1 && v.late) return 'Long term + late check-out'
  if (days > 1) return 'Long term storage'
  return 'Short term storage'
}

/* ── time options ────────────────────────────────────────── */
const timeOptions = (startH = 6, startM = 45, endH = 23) => {
  const out: string[] = []
  let h = startH, m = startM
  while (h < endH || (h === endH && m === 0)) {
    const hh = h % 12 === 0 ? 12 : h % 12
    const mm = m.toString().padStart(2, '0')
    out.push(`${hh}:${mm} ${h < 12 ? 'AM' : 'PM'}`)
    m += 15
    if (m >= 60) { m = 0; h++ }
  }
  return out
}
const CHECKIN_TIMES       = timeOptions(6,  45, 17)
const CHECKOUT_TIMES_OPEN = timeOptions(6,  45, 17)
const CHECKOUT_TIMES_LATE = timeOptions(17, 15, 23)

/* Convert "H:MM AM/PM" → minutes since midnight for comparison */
const parseTimeStr = (t: string): number => {
  const m = /^(\d+):(\d+)\s+(AM|PM)$/i.exec(t.trim())
  if (!m) return 0
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
  return h * 60 + min
}

/* ── styled components — transport design language ───────── */

const PageContainer = styled.div`
  padding: 16px 20px 80px;
  background: #f7f8fa;
  min-height: 100vh;
  font-family: 'Poppins', sans-serif;
`

const TopBar = styled.div`
  max-width: 1180px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`

const HeaderBlock = styled.header`
  max-width: 1180px;
  margin: 0 auto 20px;
`

const Title = styled.h1`
  font-family: 'Poppins';
  font-weight: 700;
  font-size: 26px;
  line-height: 32px;
  margin: 0 0 6px;
  color: #0b0f1a;
  text-transform: uppercase;
  @media (min-width: 720px) { font-size: 30px; line-height: 36px; }
`

const Subtitle = styled.p`
  font-family: 'Poppins';
  font-size: 15px;
  line-height: 22px;
  color: #6b7280;
  margin: 0;
`

const PageGrid = styled.div`
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  gap: 20px;
  grid-template-columns: 1fr;
  @media (min-width: 960px) {
    grid-template-columns: minmax(0, 1fr) 340px;
    align-items: start;
  }
`

const SectionsGrid = styled.div`
  display: grid;
  gap: 16px;
`

const Section = styled.section`
  display: grid;
  gap: 12px;
  padding: 18px 20px;
  border: 1px solid #e6e9ee;
  border-radius: 10px;
  background: #ffffff;
`

const SectionTitle = styled.h2`
  font-family: 'Poppins';
  font-weight: 600;
  font-size: 17px;
  line-height: 22px;
  margin: 0;
  color: #12141d;
`

const FieldGrid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
  @media (min-width: 600px) { grid-template-columns: 1fr 1fr; }
`

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: 'Poppins';
  font-size: 13px;
  color: #4a5260;
  grid-column: ${({ span }: { span?: number }) => span === 2 ? '1 / -1' : 'auto'};
`

const InputEl = styled.input`
  height: 44px;
  border: 1px solid #c8cdd6;
  border-radius: 8px;
  font-family: 'Poppins';
  font-size: 14px;
  color: #12141d;
  padding: 0 12px;
  background: #fff;
  &::placeholder { color: #9ca3af; }
  &:focus {
    outline: none;
    box-shadow: 0 4px 10px 3px rgba(0,0,0,0.08);
    border-color: #c8cdd6;
  }
`

const SelectEl = styled.select`
  height: 44px;
  border: 1px solid #c8cdd6;
  border-radius: 8px;
  font-family: 'Poppins';
  font-size: 14px;
  color: #12141d;
  padding: 0 12px;
  background: #fff;
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 20 20'><path d='M5 7l5 6 5-6' stroke='%238692a6' stroke-width='2' fill='none' stroke-linecap='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
  cursor: pointer;
  &:focus {
    outline: none;
    box-shadow: 0 4px 10px 3px rgba(0,0,0,0.08);
  }
`

const Textarea = styled.textarea`
  border: 1px solid #c8cdd6;
  border-radius: 8px;
  font-family: 'Poppins';
  font-size: 14px;
  color: #12141d;
  padding: 10px 12px;
  min-height: 72px;
  resize: vertical;
  background: #fff;
  &::placeholder { color: #9ca3af; }
  &:focus {
    outline: none;
    box-shadow: 0 4px 10px 3px rgba(0,0,0,0.08);
  }
`

const ErrorText = styled.span`
  font-size: 12px;
  color: #b91c1c;
`

/* Date chips — mirror transport DateChip pattern */
const DateChipsRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`

const DateChip = styled.div`
  border: 1px solid #e9ecf0;
  border-radius: 10px;
  padding: 10px 14px;
  background: #fafafa;
`

const DateChipLabel = styled.div`
  font-family: 'Poppins';
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
`

const DateChipValue = styled.div`
  font-family: 'Poppins';
  font-size: 15px;
  font-weight: ${({ $placeholder }) => ($placeholder ? 400 : 600)};
  color: ${({ $placeholder }) => ($placeholder ? '#9CA3AF' : '#12141d')};
`

/* Bag stepper — transport BagStepper style */
const BagStepper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  border: 1px solid #e6e9ee;
  border-radius: 10px;
  background: #fbfbfd;
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
  width: fit-content;
`

const StepBtn = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1.5px solid ${({ disabled }: { disabled?: boolean }) => disabled ? '#f4d199' : '#f3ad3c'};
  background: white;
  color: ${({ disabled }: { disabled?: boolean }) => disabled ? '#f4d199' : '#f3ad3c'};
  font-size: 18px;
  font-weight: 500;
  line-height: 1;
  cursor: ${({ disabled }: { disabled?: boolean }) => disabled ? 'default' : 'pointer'};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  &:hover { background: ${({ disabled }: { disabled?: boolean }) => disabled ? 'white' : '#fff8ec'}; }
`

const StepVal = styled.span`
  font-family: 'Poppins';
  font-weight: 700;
  font-size: 20px;
  min-width: 24px;
  text-align: center;
  color: #12141d;
`

const StepperHint = styled.div`
  font-family: 'Poppins';
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
`

/* Hotel delivery toggle row */
const slideIn = keyframes`from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}`

const DeliveryToggleRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e6e9ee;
  border-radius: 10px;
  background: #fafafa;
  cursor: pointer;
  &:hover { background: #fff8ec; border-color: #f4d199; }
  transition: background 0.15s, border-color 0.15s;
`

const DeliveryToggleText = styled.div`
  b { display: block; font-size: 14px; font-weight: 600; color: #12141d; margin-bottom: 2px; }
  small { font-size: 12px; color: #6b7280; }
`

const Switch = styled.span`
  position: relative;
  width: 40px;
  height: 22px;
  background: ${({ on }: { on: boolean }) => on ? '#1d3c34' : '#d1d5db'};
  border-radius: 999px;
  flex-shrink: 0;
  transition: background 0.2s;
  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: ${({ on }: { on: boolean }) => on ? '21px' : '3px'};
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
    transition: left 0.2s cubic-bezier(0.2,0.9,0.3,1.3);
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  }
`

const DeliveryFields = styled.div`
  display: grid;
  gap: 10px;
  animation: ${slideIn} 0.2s ease;
`

/* Phone input override */
const PhoneWrap = styled.div`
  .react-tel-input .form-control {
    width: 100% !important;
    height: 44px !important;
    border-radius: 8px !important;
    border: 1px solid #c8cdd6 !important;
    padding-left: 52px !important;
    font-size: 14px !important;
    font-family: 'Poppins' !important;
    background: #fff !important;
  }
  .react-tel-input .form-control:focus {
    box-shadow: 0 4px 10px 3px rgba(0,0,0,0.08) !important;
    border-color: #c8cdd6 !important;
    outline: none !important;
  }
  .react-tel-input .flag-dropdown {
    border: 1px solid #c8cdd6 !important;
    border-right: none !important;
    border-top-left-radius: 8px !important;
    border-bottom-left-radius: 8px !important;
    background: #fff !important;
  }
`

/* Info note — yellow like transport's BsiLockerNote */
const InfoNote = styled.div`
  padding: 10px 14px;
  border-radius: 8px;
  background: #fff8eb;
  border: 1px solid #f4d199;
  font-family: 'Poppins';
  font-size: 13px;
  line-height: 18px;
  color: #7a5400;
  a { color: #1d3c34; font-weight: 600; }
`

/* Sidebar */
const slideInRight = keyframes`
  from { transform: translateX(12px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
`

const Sidebar = styled.aside`
  display: grid;
  gap: 12px;
  @media (min-width: 960px) {
    position: sticky;
    top: 20px;
    align-self: start;
    animation: ${slideInRight} 0.28s ease-out;
  }
`

const SummaryCard = styled.div`
  padding: 18px;
  border: 1px solid #f4d199;
  border-radius: 10px;
  background: #fff8ec;
  display: grid;
  gap: 8px;
`

const SummaryTitle = styled.h3`
  font-family: 'Poppins';
  font-weight: 600;
  font-size: 17px;
  margin: 0 0 4px;
  color: #12141d;
`

const SumRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  font-family: 'Poppins';
  font-size: 14px;
  color: #3c4253;
`

const SumTotal = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  font-family: 'Poppins';
  font-weight: 700;
  font-size: 18px;
  color: #0b0f1a;
  padding-top: 10px;
  border-top: 1px solid #f0d49a;
  margin-top: 4px;
`

const SummaryNote = styled.p`
  font-family: 'Poppins';
  font-size: 12px;
  color: #6b7280;
  margin: 0;
  line-height: 16px;
`

const SubmitWrap = styled.div`
  button { width: 100%; padding: 12px 24px; min-width: 0; }
`

const ErrorNote = styled.div`
  font-family: 'Poppins';
  font-size: 13px;
  color: #b91c1c;
  background: #fee2e2;
  border: 1px solid #fecaca;
  padding: 10px 12px;
  border-radius: 8px;
`

/* ── component ───────────────────────────────────────────── */

const LuggageStorage = () => {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [closedDates, setClosedDates] = useState<string[]>([])
  useEffect(() => {
    axios
      .get('/api/booking/closed-dates?source=bagbee')
      .then(({ data }) => setClosedDates(data?.dates || []))
      .catch(() => setClosedDates([]))
  }, [])

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: {
      luggage: 1,
      backpacks: 0,
      arrivalDate: '',
      departureDate: '',
      arrivalTime: '',
      departureTime: '',
      delivery: false,
      late: false,
      name: '',
      email: '',
      phone: '',
      hotel: '',
      deliveryAddress: '',
      comment: '',
    },
  })

  const values       = watch()
  const price        = useMemo(() => calcPrice(values),        [values])
  const storageType  = useMemo(() => deriveStorageType(values), [values])

  const onSubmit = async (v: FormValues) => {
    setSubmitError(null)
    const p = calcPrice(v)
    const payload: Record<string, unknown> = {
      Name:                                   v.name,
      Email:                                  v.email,
      PhoneNumber:                            v.phone.startsWith('+') ? v.phone : `+${v.phone}`,
      Luggage:                                Number(v.luggage)   || 0,
      'Backpack / Purse (ISK 1000 pr. item)': Number(v.backpacks) || 0,
      ArrivalDate:                            v.arrivalDate,
      'Arrival time':                         v.arrivalTime,
      'Departure date':                        v.departureDate,
      'Departure time':                        v.departureTime,
      'Delivery Service':                      v.delivery,
      'Late check-out (ISK 500 pr. bag)':      v.late,
      'Type of storage':                       storageType,
      Athugasemd:                              v.comment,
      totalAmountIsk:                          p.total,
    }
    if (v.delivery && v.deliveryAddress) payload['Delivery Address'] = v.deliveryAddress
    if (v.hotel)                          payload['Hotel or Cruise ship name'] = v.hotel

    try {
      const { data } = await axios.post('/api/storage/checkout', payload)
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        setSubmitError('Could not start payment. Please try again.')
      }
    } catch {
      setSubmitError('Something went wrong. Please try again or contact us.')
    }
  }

  return (
    <>
      <NextSeo
        title='Luggage Storage in Reykjavik — BagBee'
        description='Secure, staffed luggage storage at BSÍ bus terminal in Reykjavik City Center. Book in seconds.'
      />
      <Toaster position='top-center' />

      <PageContainer>
        <TopBar>
          <BackButton />
          <Link href='/'><Logo /></Link>
          <span style={{ width: 60 }} />
        </TopBar>

        <HeaderBlock>
          <Title>Luggage Storage</Title>
          <Subtitle>
            Secure, staffed storage at BSÍ Bus Terminal — open daily 06:45–17:00.
            Locker delivery available after 5 PM.
          </Subtitle>
        </HeaderBlock>

        <PageGrid>
          <form onSubmit={handleSubmit(onSubmit)}>
            <SectionsGrid>

              {/* ── Dates & Times ── */}
              <Section>
                <SectionTitle>When?</SectionTitle>

                {/* Range calendar — same component as /transport */}
                <TransportCalendar
                  pickupDate={values.arrivalDate || null}
                  deliveryDate={values.departureDate || null}
                  onChange={(arrivalDate, departureDate) => {
                    setValue('arrivalDate', arrivalDate || '', { shouldValidate: true })
                    setValue('departureDate', departureDate || '', { shouldValidate: true })
                  }}
                  locale='en'
                  disabledDates={closedDates}
                />
                <DateChipsRow style={{ marginBottom: 20 }}>
                  <DateChip>
                    <DateChipLabel>Drop-off date</DateChipLabel>
                    <DateChipValue $placeholder={!values.arrivalDate}>
                      {values.arrivalDate || 'Select date'}
                    </DateChipValue>
                    {errors.arrivalDate && <ErrorText>{errors.arrivalDate.message}</ErrorText>}
                  </DateChip>
                  <DateChip>
                    <DateChipLabel>Pick-up date</DateChipLabel>
                    <DateChipValue $placeholder={!values.departureDate}>
                      {values.departureDate || 'Select date'}
                    </DateChipValue>
                    {errors.departureDate && <ErrorText>{errors.departureDate.message}</ErrorText>}
                  </DateChip>
                </DateChipsRow>

                {/* Hidden inputs to keep react-hook-form validation */}
                <input type='hidden' {...register('arrivalDate', { required: 'Drop-off date required' })} />
                <input type='hidden' {...register('departureDate', { required: 'Pick-up date required' })} />

                <FieldGrid>

                  <Field>
                    Check-in time <span style={{ color: '#c25400' }}>*</span>
                    <SelectEl {...register('arrivalTime', { required: 'Required' })}>
                      <option value=''>Select time</option>
                      {CHECKIN_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </SelectEl>
                    {errors.arrivalTime && <ErrorText>{errors.arrivalTime.message}</ErrorText>}
                  </Field>

                  <Field>
                    Check-out time <span style={{ color: '#c25400' }}>*</span>
                    <Controller
                      name='departureTime'
                      control={control}
                      rules={{
                        required: 'Required',
                        validate: (v) => {
                          if (!v || !values.arrivalTime) return true
                          // Only enforce ordering on same-day storage
                          if (values.arrivalDate && values.departureDate &&
                              values.arrivalDate !== values.departureDate) return true
                          return parseTimeStr(v) > parseTimeStr(values.arrivalTime) ||
                            'Check-out must be after check-in time'
                        },
                      }}
                      render={({ field }) => (
                        <SelectEl
                          value={field.value}
                          onChange={(e) => {
                            field.onChange(e.target.value)
                            setValue('late', CHECKOUT_TIMES_LATE.includes(e.target.value))
                          }}
                        >
                          <option value=''>Select time</option>
                          <optgroup label='Staffed pickup (before 5 PM)'>
                            {CHECKOUT_TIMES_OPEN.map((t) => <option key={t} value={t}>{t}</option>)}
                          </optgroup>
                          <optgroup label='Locker delivery (after 5 PM — +500 ISK/bag)'>
                            {CHECKOUT_TIMES_LATE.map((t) => <option key={t} value={t}>{t}</option>)}
                          </optgroup>
                        </SelectEl>
                      )}
                    />
                    {errors.departureTime && <ErrorText>{errors.departureTime.message}</ErrorText>}
                  </Field>
                </FieldGrid>

                <InfoNote>
                  Pre-bookings are for storage <b>June 1 – September 30</b>. For
                  winter storage use the{' '}
                  <a href='https://www.luggagelockers.is' target='_blank' rel='noreferrer'>
                    24/7 luggage lockers
                  </a>.
                </InfoNote>
              </Section>

              {/* ── Luggage ── */}
              <Section>
                <SectionTitle>How many bags?</SectionTitle>
                <FieldGrid>
                  <Field>
                    Luggage items
                    <Controller
                      name='luggage'
                      control={control}
                      render={({ field }) => (
                        <BagStepper>
                          <StepBtn
                            type='button'
                            disabled={field.value <= 0}
                            onClick={() => field.onChange(Math.max(0, field.value - 1))}
                          >−</StepBtn>
                          <StepVal>{field.value}</StepVal>
                          <StepBtn
                            type='button'
                            disabled={field.value >= 10}
                            onClick={() => field.onChange(Math.min(10, field.value + 1))}
                          >+</StepBtn>
                        </BagStepper>
                      )}
                    />
                    <StepperHint>Suitcases, sports bags — {PRICE_LUGGAGE_PER_DAY.toLocaleString()} ISK / day each</StepperHint>
                  </Field>

                  <Field>
                    Backpacks / purses
                    <Controller
                      name='backpacks'
                      control={control}
                      render={({ field }) => (
                        <BagStepper>
                          <StepBtn
                            type='button'
                            disabled={field.value <= 0}
                            onClick={() => field.onChange(Math.max(0, field.value - 1))}
                          >−</StepBtn>
                          <StepVal>{field.value}</StepVal>
                          <StepBtn
                            type='button'
                            disabled={field.value >= 10}
                            onClick={() => field.onChange(Math.min(10, field.value + 1))}
                          >+</StepBtn>
                        </BagStepper>
                      )}
                    />
                    <StepperHint>≤ 50 cm with shoulder straps — {PRICE_BACKPACK_FLAT.toLocaleString()} ISK flat</StepperHint>
                  </Field>
                </FieldGrid>
              </Section>

              {/* ── Hotel delivery ── */}
              <Section>
                <SectionTitle>Hotel delivery (optional)</SectionTitle>
                <Controller
                  name='delivery'
                  control={control}
                  render={({ field }) => (
                    <DeliveryToggleRow onClick={() => field.onChange(!field.value)}>
                      <DeliveryToggleText>
                        <b>Deliver bags to my accommodation</b>
                        <small>We bring your bags straight to you (+{PRICE_DELIVERY_FLAT.toLocaleString()} ISK)</small>
                      </DeliveryToggleText>
                      <Switch on={!!field.value} />
                    </DeliveryToggleRow>
                  )}
                />
                {values.delivery && (
                  <DeliveryFields>
                    <Field span={2}>
                      Hotel / accommodation name
                      <InputEl placeholder='e.g. Hotel Reykjavik Centrum' {...register('hotel')} />
                    </Field>
                    <Field span={2}>
                      Delivery address
                      <InputEl placeholder='Street name and number' {...register('deliveryAddress')} />
                    </Field>
                  </DeliveryFields>
                )}
              </Section>

              {/* ── Contact ── */}
              <Section>
                <SectionTitle>Your details</SectionTitle>
                <FieldGrid>
                  <Field span={2}>
                    Full name <span style={{ color: '#c25400' }}>*</span>
                    <InputEl
                      placeholder='Jane Doe'
                      {...register('name', { required: 'Required', minLength: { value: 2, message: 'Too short' } })}
                    />
                    {errors.name && <ErrorText>{errors.name.message}</ErrorText>}
                  </Field>

                  <Field>
                    Email <span style={{ color: '#c25400' }}>*</span>
                    <InputEl
                      type='email'
                      placeholder='you@example.com'
                      {...register('email', {
                        required: 'Required',
                        pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' },
                      })}
                    />
                    {errors.email && <ErrorText>{errors.email.message}</ErrorText>}
                  </Field>

                  <Field>
                    Phone number <span style={{ color: '#c25400' }}>*</span>
                    <PhoneWrap>
                      <Controller
                        name='phone'
                        control={control}
                        rules={{ required: 'Required', minLength: { value: 6, message: 'Too short' } }}
                        render={({ field }) => (
                          <PhoneInput country='is' value={field.value} onChange={(v) => field.onChange(v)} enableSearch />
                        )}
                      />
                    </PhoneWrap>
                    {errors.phone && <ErrorText>{errors.phone.message}</ErrorText>}
                  </Field>

                  <Field span={2}>
                    Comments (optional)
                    <Textarea placeholder='Flight details, special requests…' {...register('comment')} />
                  </Field>
                </FieldGrid>
              </Section>

            </SectionsGrid>
          </form>

          {/* ── Sidebar ── */}
          <Sidebar>
            <SummaryCard>
              <SummaryTitle>Summary</SummaryTitle>

              <SumRow>
                <span>{storageType}</span>
                <span>{price.days} day{price.days !== 1 ? 's' : ''}</span>
              </SumRow>

              {(values.luggage > 0) && (
                <SumRow>
                  <span>Luggage × {values.luggage}</span>
                  <span>{(values.luggage * PRICE_LUGGAGE_PER_DAY * price.days).toLocaleString()} ISK</span>
                </SumRow>
              )}

              {(values.backpacks > 0) && (
                <SumRow>
                  <span>Backpacks × {values.backpacks}</span>
                  <span>{(values.backpacks * PRICE_BACKPACK_FLAT).toLocaleString()} ISK</span>
                </SumRow>
              )}

              {values.late && (
                <SumRow>
                  <span>Locker delivery surcharge</span>
                  <span>{price.late.toLocaleString()} ISK</span>
                </SumRow>
              )}

              {values.delivery && (
                <SumRow>
                  <span>Hotel delivery</span>
                  <span>{price.delivery.toLocaleString()} ISK</span>
                </SumRow>
              )}

              <SumTotal>
                <span>Total</span>
                <span>{price.total.toLocaleString()} ISK</span>
              </SumTotal>

              <SummaryNote>Prices include 24% VAT. Cancel up to 12h before drop-off.</SummaryNote>
            </SummaryCard>

            <SubmitWrap>
              <Button
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                loading={isSubmitting}
                fullWidth
              >
                {isSubmitting ? 'Redirecting…' : 'Proceed to payment'}
              </Button>
            </SubmitWrap>

            {submitError && <ErrorNote>{submitError}</ErrorNote>}

            <SummaryNote style={{ textAlign: 'center' }}>
              🔒 Secure payment by Rapyd &nbsp;·&nbsp; Staffed storage &nbsp;·&nbsp; 100% insured
            </SummaryNote>
          </Sidebar>
        </PageGrid>
      </PageContainer>
    </>
  )
}

export default LuggageStorage

export async function getServerSideProps() {
  return { props: {} }
}
