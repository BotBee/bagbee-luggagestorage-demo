// @ts-nocheck — Emotion styled children type quirk with TS strict mode
//
// Partner booking popup for luggagelockers.is. Same BSÍ manned storage that
// BagBee runs, sold under the partner brand: bookings are tagged
// Reference = "Luggage lockers" and priced at the partner's published rates
// (bags 2000 ISK/day, backpacks 1000 ISK/day). Payment + the post-payment
// self-service edit/cancel/refund all run through the existing storage flow
// (/api/storage/checkout → Rapyd → /storage/[id]).
//
// Designed to be iframed onto luggagelockers.is in place of the old Fillout
// popup. See EMBED-SNIPPETS.md.
import React, { useEffect, useMemo, useState } from 'react'
import styled from '@emotion/styled'
import { useForm, Controller } from 'react-hook-form'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import axios from 'axios'
import TransportCalendar from '../../components/transport/TransportCalendar'
import PartnerFormHeader from '../../components/PartnerFormHeader'
import { useEmbedAutoResize, redirectTop } from '../../components/embed/embedUtils'
import {
  calcStoragePrice,
  daysBetween,
  RATE_LUGGAGE_LOCKERS,
} from '../../utils/storagePricing'

const LATE_PICKUP_LABEL = 'After 17:00 (24/7 locker)'

type FormValues = {
  luggage: number
  backpacks: number
  arrivalDate: string
  departureDate: string
  arrivalTime: string
  departureTime: string
  pickupLater: boolean
  name: string
  email: string
  phone: string
  comment: string
}

/* ── time options (15-min steps) ─────────────────────────── */
const timeOptions = (startH: number, startM: number, endH: number) => {
  const out: string[] = []
  let h = startH
  let m = startM
  while (h < endH || (h === endH && m === 0)) {
    const hh = h % 12 === 0 ? 12 : h % 12
    const mm = m.toString().padStart(2, '0')
    out.push(`${hh}:${mm} ${h < 12 ? 'AM' : 'PM'}`)
    m += 15
    if (m >= 60) {
      m = 0
      h++
    }
  }
  return out
}
const CHECKIN_TIMES = timeOptions(6, 45, 17)
const CHECKOUT_TIMES = timeOptions(6, 45, 17)

const parseTimeStr = (t: string): number => {
  const m = /^(\d+):(\d+)\s+(AM|PM)$/i.exec((t || '').trim())
  if (!m) return 0
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
  return h * 60 + min
}

/* ── styled ──────────────────────────────────────────────── */
const Shell = styled.div`
  font-family: 'Poppins', sans-serif;
  background: #ffffff;
  min-height: 100%;
  color: #12141d;
`

const Body = styled.div`
  max-width: 640px;
  margin: 0 auto;
  padding: 18px 20px 28px;
  display: grid;
  gap: 16px;
`

const Intro = styled.p`
  font-size: 13px;
  line-height: 19px;
  color: #6b7280;
  margin: 2px 0 0;
  b { color: #b91c1c; }
`

const Section = styled.section`
  display: grid;
  gap: 12px;
  padding: 16px 18px;
  border: 1px solid #e6e9ee;
  border-radius: 10px;
  background: #fff;
`

const SectionTitle = styled.h2`
  font-weight: 600;
  font-size: 16px;
  margin: 0;
  color: #12141d;
`

const FieldGrid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
  @media (min-width: 540px) {
    grid-template-columns: 1fr 1fr;
  }
`

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: #4a5260;
  grid-column: ${({ span }: { span?: number }) => (span === 2 ? '1 / -1' : 'auto')};
`

const InputEl = styled.input`
  height: 44px;
  border: 1px solid #c8cdd6;
  border-radius: 8px;
  font-size: 14px;
  color: #12141d;
  padding: 0 12px;
  background: #fff;
  &::placeholder { color: #9ca3af; }
  &:focus { outline: none; box-shadow: 0 4px 10px 3px rgba(0,0,0,0.08); }
`

const SelectEl = styled.select`
  height: 44px;
  border: 1px solid #c8cdd6;
  border-radius: 8px;
  font-size: 14px;
  color: #12141d;
  padding: 0 36px 0 12px;
  background: #fff;
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 20 20'><path d='M5 7l5 6 5-6' stroke='%238692a6' stroke-width='2' fill='none' stroke-linecap='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  cursor: pointer;
  &:focus { outline: none; box-shadow: 0 4px 10px 3px rgba(0,0,0,0.08); }
`

const Textarea = styled.textarea`
  border: 1px solid #c8cdd6;
  border-radius: 8px;
  font-size: 14px;
  color: #12141d;
  padding: 10px 12px;
  min-height: 64px;
  resize: vertical;
  background: #fff;
  font-family: inherit;
  &::placeholder { color: #9ca3af; }
  &:focus { outline: none; box-shadow: 0 4px 10px 3px rgba(0,0,0,0.08); }
`

const ErrorText = styled.span`
  font-size: 12px;
  color: #b91c1c;
`

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
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
`

const DateChipValue = styled.div`
  font-size: 15px;
  font-weight: ${({ $placeholder }: { $placeholder?: boolean }) => ($placeholder ? 400 : 600)};
  color: ${({ $placeholder }: { $placeholder?: boolean }) => ($placeholder ? '#9CA3AF' : '#12141d')};
`

const BagStepper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  border: 1px solid #e6e9ee;
  border-radius: 10px;
  background: #fbfbfd;
  width: fit-content;
`

const StepBtn = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1.5px solid ${({ disabled }: { disabled?: boolean }) => (disabled ? '#f4d199' : '#f3ad3c')};
  background: white;
  color: ${({ disabled }: { disabled?: boolean }) => (disabled ? '#f4d199' : '#f3ad3c')};
  font-size: 18px;
  line-height: 1;
  cursor: ${({ disabled }: { disabled?: boolean }) => (disabled ? 'default' : 'pointer')};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
`

const StepVal = styled.span`
  font-weight: 700;
  font-size: 20px;
  min-width: 24px;
  text-align: center;
`

const StepperHint = styled.div`
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
`

const ToggleRow = styled.label`
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
`

const ToggleText = styled.div`
  b { display: block; font-size: 14px; font-weight: 600; color: #12141d; margin-bottom: 2px; }
  small { font-size: 12px; color: #6b7280; }
`

const Switch = styled.span`
  position: relative;
  width: 40px;
  height: 22px;
  background: ${({ $on }: { $on: boolean }) => ($on ? '#1d3c34' : '#d1d5db')};
  border-radius: 999px;
  flex-shrink: 0;
  transition: background 0.2s;
  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: ${({ $on }: { $on: boolean }) => ($on ? '21px' : '3px')};
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
    transition: left 0.2s;
  }
`

const PhoneWrap = styled.div`
  .react-tel-input .form-control {
    width: 100% !important;
    height: 44px !important;
    border-radius: 8px !important;
    border: 1px solid #c8cdd6 !important;
    padding-left: 52px !important;
    font-size: 14px !important;
    background: #fff !important;
  }
  .react-tel-input .flag-dropdown {
    border: 1px solid #c8cdd6 !important;
    border-right: none !important;
    border-top-left-radius: 8px !important;
    border-bottom-left-radius: 8px !important;
    background: #fff !important;
  }
`

const SummaryCard = styled.div`
  padding: 16px 18px;
  border: 1px solid #f4d199;
  border-radius: 10px;
  background: #fff8ec;
  display: grid;
  gap: 8px;
`

const SumRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  color: #3c4253;
`

const SumTotal = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-weight: 700;
  font-size: 18px;
  color: #0b0f1a;
  padding-top: 10px;
  border-top: 1px solid #f0d49a;
  margin-top: 4px;
`

const SubmitBtn = styled.button`
  width: 100%;
  height: 50px;
  border: none;
  border-radius: 10px;
  background: #1d3c34;
  color: #fff;
  font-family: inherit;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  &:disabled { opacity: 0.6; cursor: default; }
`

const ErrorNote = styled.div`
  font-size: 13px;
  color: #b91c1c;
  background: #fee2e2;
  border: 1px solid #fecaca;
  padding: 10px 12px;
  border-radius: 8px;
`

const FootNote = styled.p`
  font-size: 12px;
  color: #6b7280;
  margin: 0;
  text-align: center;
`

/* ── component ───────────────────────────────────────────── */
const LuggageLockersEmbed = () => {
  useEmbedAutoResize()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [closedDates, setClosedDates] = useState<string[]>([])
  useEffect(() => {
    axios
      .get('/api/booking/closed-dates?source=luggage-lockers')
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
      pickupLater: false,
      name: '',
      email: '',
      phone: '',
      comment: '',
    },
  })

  const values = watch()
  const price = useMemo(
    () =>
      calcStoragePrice(
        {
          arrivalDate: values.arrivalDate,
          departureDate: values.departureDate,
          luggage: Number(values.luggage) || 0,
          backpacks: Number(values.backpacks) || 0,
          late: values.pickupLater,
        },
        RATE_LUGGAGE_LOCKERS,
      ),
    [values.arrivalDate, values.departureDate, values.luggage, values.backpacks, values.pickupLater],
  )
  const days = daysBetween(values.arrivalDate, values.departureDate) || 1

  const onSubmit = async (v: FormValues) => {
    setSubmitError(null)
    const payload: Record<string, unknown> = {
      source: 'luggage-lockers',
      Name: v.name,
      Email: v.email,
      PhoneNumber: v.phone.startsWith('+') ? v.phone : `+${v.phone}`,
      Luggage: Number(v.luggage) || 0,
      'Backpack / Purse (ISK 1000 pr. item)': Number(v.backpacks) || 0,
      ArrivalDate: v.arrivalDate,
      'Arrival time': v.arrivalTime,
      'Departure date': v.departureDate,
      'Departure time': v.pickupLater ? LATE_PICKUP_LABEL : v.departureTime,
      'Late check-out (ISK 500 pr. bag)': v.pickupLater,
      Athugasemd: v.comment,
    }

    try {
      const { data } = await axios.post('/api/storage/checkout', payload)
      if (data.redirectUrl) {
        redirectTop(data.redirectUrl)
      } else {
        setSubmitError('Could not start payment. Please try again.')
      }
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.message ||
          'Something went wrong. Please try again or contact us.',
      )
    }
  }

  return (
    <Shell>
      <PartnerFormHeader
        partnerName='Luggage Lockers'
        partnerSubtitle='BSÍ Bus Terminal · Reykjavík'
      />

      <Body>
        <Intro>
          Manned luggage storage at the BSÍ bus terminal in Reykjavík City Center.
          <br />
          The 24/7 luggage lockers cannot be pre-booked.
        </Intro>

        {/* ── When ── */}
        <Section>
          <SectionTitle>When?</SectionTitle>
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
          <DateChipsRow>
            <DateChip>
              <DateChipLabel>Drop-off date</DateChipLabel>
              <DateChipValue $placeholder={!values.arrivalDate}>
                {values.arrivalDate || 'Select date'}
              </DateChipValue>
            </DateChip>
            <DateChip>
              <DateChipLabel>Pick-up date</DateChipLabel>
              <DateChipValue $placeholder={!values.departureDate}>
                {values.departureDate || 'Select date'}
              </DateChipValue>
            </DateChip>
          </DateChipsRow>
          <input type='hidden' {...register('arrivalDate', { required: 'Drop-off date required' })} />
          <input type='hidden' {...register('departureDate', { required: 'Pick-up date required' })} />
          {(errors.arrivalDate || errors.departureDate) && (
            <ErrorText>Please pick a drop-off and pick-up date.</ErrorText>
          )}

          <FieldGrid>
            <Field>
              Check-in time (06:45–17:00) *
              <SelectEl {...register('arrivalTime', { required: 'Required' })}>
                <option value=''>Select time</option>
                {CHECKIN_TIMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </SelectEl>
              {errors.arrivalTime && <ErrorText>{errors.arrivalTime.message}</ErrorText>}
            </Field>

            <Field>
              Check-out time {values.pickupLater ? '' : '*'}
              <Controller
                name='departureTime'
                control={control}
                rules={{
                  validate: (val) => {
                    if (values.pickupLater) return true
                    if (!val) return 'Required'
                    if (
                      values.arrivalTime &&
                      values.arrivalDate &&
                      values.departureDate &&
                      values.arrivalDate === values.departureDate &&
                      parseTimeStr(val) <= parseTimeStr(values.arrivalTime)
                    ) {
                      return 'Check-out must be after check-in'
                    }
                    return true
                  },
                }}
                render={({ field }) => (
                  <SelectEl
                    value={field.value}
                    disabled={values.pickupLater}
                    onChange={(e) => field.onChange(e.target.value)}
                  >
                    <option value=''>
                      {values.pickupLater ? 'Locker after 17:00' : 'Select time'}
                    </option>
                    {CHECKOUT_TIMES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </SelectEl>
                )}
              />
              {errors.departureTime && <ErrorText>{errors.departureTime.message}</ErrorText>}
            </Field>
          </FieldGrid>

          <Controller
            name='pickupLater'
            control={control}
            render={({ field }) => (
              <ToggleRow onClick={() => field.onChange(!field.value)}>
                <ToggleText>
                  <b>Pick-up later than 5 pm?</b>
                  <small>After closing, your bags go to a 24/7 locker at the terminal.</small>
                </ToggleText>
                <Switch $on={!!field.value} />
              </ToggleRow>
            )}
          />
        </Section>

        {/* ── How many ── */}
        <Section>
          <SectionTitle>How many items?</SectionTitle>
          <FieldGrid>
            <Field>
              Number of items
              <Controller
                name='luggage'
                control={control}
                render={({ field }) => (
                  <BagStepper>
                    <StepBtn type='button' disabled={field.value <= 0} onClick={() => field.onChange(Math.max(0, field.value - 1))}>−</StepBtn>
                    <StepVal>{field.value}</StepVal>
                    <StepBtn type='button' disabled={field.value >= 20} onClick={() => field.onChange(Math.min(20, field.value + 1))}>+</StepBtn>
                  </BagStepper>
                )}
              />
              <StepperHint>Any item (bags, suitcases, golf bags etc) — 2,000 ISK / day each</StepperHint>
            </Field>

            <Field>
              Number of backpacks
              <Controller
                name='backpacks'
                control={control}
                render={({ field }) => (
                  <BagStepper>
                    <StepBtn type='button' disabled={field.value <= 0} onClick={() => field.onChange(Math.max(0, field.value - 1))}>−</StepBtn>
                    <StepVal>{field.value}</StepVal>
                    <StepBtn type='button' disabled={field.value >= 20} onClick={() => field.onChange(Math.min(20, field.value + 1))}>+</StepBtn>
                  </BagStepper>
                )}
              />
              <StepperHint>≤ 50 cm with shoulder straps — 1,000 ISK / day each</StepperHint>
            </Field>
          </FieldGrid>
        </Section>

        {/* ── Details ── */}
        <Section>
          <SectionTitle>Your details</SectionTitle>
          <FieldGrid>
            <Field span={2}>
              Full name *
              <InputEl placeholder='Jane Doe' {...register('name', { required: 'Required', minLength: { value: 2, message: 'Too short' } })} />
              {errors.name && <ErrorText>{errors.name.message}</ErrorText>}
            </Field>
            <Field>
              Email *
              <InputEl type='email' placeholder='you@example.com' {...register('email', { required: 'Required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' } })} />
              {errors.email && <ErrorText>{errors.email.message}</ErrorText>}
            </Field>
            <Field>
              Phone *
              <PhoneWrap>
                <Controller
                  name='phone'
                  control={control}
                  rules={{ required: 'Required', minLength: { value: 6, message: 'Too short' } }}
                  render={({ field }) => (
                    <PhoneInput country='us' value={field.value} onChange={(v) => field.onChange(v)} enableSearch />
                  )}
                />
              </PhoneWrap>
              {errors.phone && <ErrorText>{errors.phone.message}</ErrorText>}
            </Field>
            <Field span={2}>
              Anything you would like to tell us?
              <Textarea placeholder='Flight details, special requests…' {...register('comment')} />
            </Field>
          </FieldGrid>
        </Section>

        {/* ── Summary + submit ── */}
        <SummaryCard>
          <SumRow>
            <span>Storage length</span>
            <span>{days} day{days !== 1 ? 's' : ''}</span>
          </SumRow>
          {values.luggage > 0 && (
            <SumRow>
              <span>Items × {values.luggage}</span>
              <span>{(values.luggage * 2000 * days).toLocaleString()} ISK</span>
            </SumRow>
          )}
          {values.backpacks > 0 && (
            <SumRow>
              <span>Backpacks × {values.backpacks}</span>
              <span>{(values.backpacks * 1000 * days).toLocaleString()} ISK</span>
            </SumRow>
          )}
          {price.late > 0 && (
            <SumRow>
              <span>Late pick-up (after 5 pm) × {values.luggage}</span>
              <span>{price.late.toLocaleString()} ISK</span>
            </SumRow>
          )}
          <SumTotal>
            <span>Total</span>
            <span>{price.total.toLocaleString()} ISK</span>
          </SumTotal>
        </SummaryCard>

        {submitError && <ErrorNote>{submitError}</ErrorNote>}

        <SubmitBtn type='button' onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
          {isSubmitting ? 'Redirecting…' : `Book · ${price.total.toLocaleString()} ISK`}
        </SubmitBtn>

        <FootNote>
          🔒 Secure payment by Rapyd · Free changes & cancellation up to 24 h before drop-off ·
          Powered by BagBee
        </FootNote>
      </Body>
    </Shell>
  )
}

export default LuggageLockersEmbed

export async function getServerSideProps() {
  return { props: {} }
}
