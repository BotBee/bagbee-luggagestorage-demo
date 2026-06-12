// @ts-nocheck — Emotion styled children type quirk with TS strict mode
//
// Partner booking popup for bikerent.is — bike-box & bulky-equipment storage at
// the BSÍ bus terminal. Bookings land in the BSI BikeRent Airtable table
// (Reference = "BikeRent.is"), payment + the post-payment self-service
// edit/cancel/refund run through /api/bikerent/* → Rapyd → /bikerent/[id].
//
// Designed to be iframed onto bikerent.is in place of the old Fillout popup.
import React, { useEffect, useMemo, useState } from 'react'
import styled from '@emotion/styled'
import { useForm, Controller } from 'react-hook-form'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import axios from 'axios'
import TransportCalendar from '../../components/transport/TransportCalendar'
import PartnerFormHeader from '../../components/PartnerFormHeader'
import { useEmbedAutoResize, redirectTop } from '../../components/embed/embedUtils'
import { calcBikerentPrice, daysBetween } from '../../utils/bikerentPricing'

type FormValues = {
  hardBoxes: number
  foldedBoxes: number
  dropoffDate: string
  pickupDate: string
  dropoffTime: string
  pickupTime: string
  afterHours: boolean
  name: string
  email: string
  phone: string
  comment: string
}

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
// BSÍ manned opening hours only — 06:45 to 17:00.
const TIMES = timeOptions(6, 45, 17)
// After-hours drop-off window — 17:15 to 22:00 (+10,000 ISK surcharge).
const AFTER_TIMES = timeOptions(17, 15, 22)
const AFTERHOURS_FEE = 10000

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
  @media (min-width: 540px) { grid-template-columns: 1fr 1fr; }
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
const AfterHoursRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid #c8cdd6;
  border-radius: 10px;
  background: #f8f9fb;
  font-size: 13px;
  color: #12141d;
  cursor: pointer;
  line-height: 1.4;
  input { margin-top: 2px; width: 16px; height: 16px; cursor: pointer; flex: 0 0 auto; }
  strong { color: #000929; }
  span { color: #696f79; }
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
const BikeRentEmbed = () => {
  useEmbedAutoResize()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [closedDates, setClosedDates] = useState<string[]>([])
  useEffect(() => {
    axios
      .get('/api/booking/closed-dates?source=bikerent')
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
      hardBoxes: 1,
      foldedBoxes: 0,
      dropoffDate: '',
      pickupDate: '',
      dropoffTime: '',
      pickupTime: '',
      afterHours: false,
      name: '',
      email: '',
      phone: '',
      comment: '',
    },
  })

  const values = watch()
  const price = useMemo(
    () =>
      calcBikerentPrice({
        dropoffDate: values.dropoffDate,
        pickupDate: values.pickupDate,
        hardBoxes: Number(values.hardBoxes) || 0,
        foldedBoxes: Number(values.foldedBoxes) || 0,
        dropoffTime: values.dropoffTime,
      }),
    [values.dropoffDate, values.pickupDate, values.hardBoxes, values.foldedBoxes, values.dropoffTime],
  )
  const days = daysBetween(values.dropoffDate, values.pickupDate) || 1

  const onSubmit = async (v: FormValues) => {
    setSubmitError(null)
    try {
      const { data } = await axios.post('/api/bikerent/checkout', {
        name: v.name,
        email: v.email,
        phone: v.phone.startsWith('+') ? v.phone : `+${v.phone}`,
        hardBoxes: Number(v.hardBoxes) || 0,
        foldedBoxes: Number(v.foldedBoxes) || 0,
        dropoffDate: v.dropoffDate,
        dropoffTime: v.dropoffTime,
        pickupDate: v.pickupDate,
        pickupTime: v.pickupTime,
        comment: v.comment,
      })
      if (data.redirectUrl) {
        redirectTop(data.redirectUrl)
      } else {
        setSubmitError('Could not start payment. Please try again.')
      }
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || 'Something went wrong. Please try again.')
    }
  }

  return (
    <Shell>
      <PartnerFormHeader
        partnerName='Bike Rent Iceland'
        partnerSubtitle='BSÍ Bus Terminal · bike-box storage'
      />

      <Body>
        <Intro>
          Store bikes, bike boxes and other bulky equipment at the BSÍ bus terminal where the
          Flybus stops. Assembly/disassembly area (covered) available on site.
        </Intro>

        {/* ── Boxes ── */}
        <Section>
          <SectionTitle>What are you storing?</SectionTitle>
          <FieldGrid>
            <Field>
              Number of bike boxes
              <Controller
                name='hardBoxes'
                control={control}
                render={({ field }) => (
                  <BagStepper>
                    <StepBtn type='button' disabled={field.value <= 0} onClick={() => field.onChange(Math.max(0, field.value - 1))}>−</StepBtn>
                    <StepVal>{field.value}</StepVal>
                    <StepBtn type='button' disabled={field.value >= 20} onClick={() => field.onChange(Math.min(20, field.value + 1))}>+</StepBtn>
                  </BagStepper>
                )}
              />
              <StepperHint>Hard or soft bike boxes and bags — 5,000 kr base + 1,000 kr / day each</StepperHint>
            </Field>
            <Field>
              Number of folded bike boxes
              <Controller
                name='foldedBoxes'
                control={control}
                render={({ field }) => (
                  <BagStepper>
                    <StepBtn type='button' disabled={field.value <= 0} onClick={() => field.onChange(Math.max(0, field.value - 1))}>−</StepBtn>
                    <StepVal>{field.value}</StepVal>
                    <StepBtn type='button' disabled={field.value >= 20} onClick={() => field.onChange(Math.min(20, field.value + 1))}>+</StepBtn>
                  </BagStepper>
                )}
              />
              <StepperHint>Folded cardboard boxes — flat 5,000 kr each (up to 31 days)</StepperHint>
            </Field>
          </FieldGrid>
        </Section>

        {/* ── When ── */}
        <Section>
          <SectionTitle>When?</SectionTitle>
          <TransportCalendar
            pickupDate={values.dropoffDate || null}
            deliveryDate={values.pickupDate || null}
            onChange={(dropoffDate, pickupDate) => {
              setValue('dropoffDate', dropoffDate || '', { shouldValidate: true })
              setValue('pickupDate', pickupDate || '', { shouldValidate: true })
            }}
            locale='en'
            disabledDates={closedDates}
          />
          <DateChipsRow>
            <DateChip>
              <DateChipLabel>Drop-off date</DateChipLabel>
              <DateChipValue $placeholder={!values.dropoffDate}>
                {values.dropoffDate || 'Select date'}
              </DateChipValue>
            </DateChip>
            <DateChip>
              <DateChipLabel>Pick-up date</DateChipLabel>
              <DateChipValue $placeholder={!values.pickupDate}>
                {values.pickupDate || 'Select date'}
              </DateChipValue>
            </DateChip>
          </DateChipsRow>
          <input type='hidden' {...register('dropoffDate', { required: 'Drop-off date required' })} />
          <input type='hidden' {...register('pickupDate', { required: 'Pick-up date required' })} />
          {(errors.dropoffDate || errors.pickupDate) && (
            <ErrorText>Please pick a drop-off and pick-up date.</ErrorText>
          )}

          <FieldGrid>
            <Field>
              Approximate drop-off time *
              <SelectEl {...register('dropoffTime', { required: 'Required' })}>
                <option value=''>Select time</option>
                {(values.afterHours ? AFTER_TIMES : TIMES).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </SelectEl>
              {errors.dropoffTime && <ErrorText>{errors.dropoffTime.message}</ErrorText>}
            </Field>
            <Field>
              Approximate pick-up time *
              <SelectEl {...register('pickupTime', { required: 'Required' })}>
                <option value=''>Select time</option>
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </SelectEl>
              {errors.pickupTime && <ErrorText>{errors.pickupTime.message}</ErrorText>}
            </Field>
          </FieldGrid>
          <AfterHoursRow>
            <input
              type='checkbox'
              {...register('afterHours', { onChange: () => setValue('dropoffTime', '') })}
            />
            <div>
              <strong>Drop off after 17:00</strong>{' '}
              <span>
                (after-hours, 17:15–22:00) — +{AFTERHOURS_FEE.toLocaleString()} ISK. Normal pick-up
                stays within 06:45–17:00.
              </span>
            </div>
          </AfterHoursRow>
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
              Anything you would like to add?
              <Textarea placeholder='Bike details, special requests…' {...register('comment')} />
            </Field>
          </FieldGrid>
        </Section>

        {/* ── Summary + submit ── */}
        <SummaryCard>
          <SumRow>
            <span>Storage length</span>
            <span>{days} day{days !== 1 ? 's' : ''}</span>
          </SumRow>
          {price.base > 0 && (
            <SumRow>
              <span>Base fee</span>
              <span>{price.base.toLocaleString()} ISK</span>
            </SumRow>
          )}
          {values.hardBoxes > 0 && (
            <SumRow>
              <span>Bike boxes × {values.hardBoxes} × {days}d</span>
              <span>{price.hardCost.toLocaleString()} ISK</span>
            </SumRow>
          )}
          {values.foldedBoxes > 0 && (
            <SumRow>
              <span>Folded boxes × {values.foldedBoxes}</span>
              <span>{price.foldedCost.toLocaleString()} ISK</span>
            </SumRow>
          )}
          {price.afterHoursCost > 0 && (
            <SumRow>
              <span>After-hours drop-off</span>
              <span>{price.afterHoursCost.toLocaleString()} ISK</span>
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

export default BikeRentEmbed

export async function getServerSideProps() {
  return { props: {} }
}
