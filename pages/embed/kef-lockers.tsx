// @ts-nocheck — Emotion styled children type quirk with TS strict mode
/**
 * KEF airport bike-box locker booking — partner embed (luggagelockers.is).
 * Reuses the partner-popup pattern (form → /api/kef/checkout → Rapyd →
 * /kef/payment-success). Pricing in utils/kefPricing.ts; capacity + lockers in
 * utils/kefBooking.ts; PINs issued by the existing TTLock sync.
 */
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
  calcKefPrice,
  daysBetween,
  KEF_MAX_BOXES,
  KEF_LOCKER_DIMENSIONS,
  KEF_LOCKER_CAPACITY_TEXT,
} from '../../utils/kefPricing'

const timeOptions = (startH, endH) => {
  const out = []
  for (let h = startH; h <= endH; h++) {
    for (const m of [0, 30]) {
      if (h === endH && m > 0) break
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return out
}
const TIMES = timeOptions(5, 23) // 05:00–23:00 (lockers are 24/7 self-service)
const WINDOW_HOURS = [3, 4, 5, 6, 7, 8]

const Shell = styled.div`max-width: 540px; margin: 0 auto; font-family: 'Poppins', sans-serif; color: #12141d;`
const Body = styled.div`padding: 18px 20px 28px;`
const Intro = styled.p`font-size: 14px; color: #4b5563; line-height: 1.55; margin: 4px 0 16px;`
const Section = styled.section`margin-bottom: 18px;`
const SectionTitle = styled.h2`font-size: 14px; font-weight: 700; margin: 0 0 10px; color: #12141d;`
const FieldGrid = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 12px;`
const Field = styled.label`display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #424857;`
const SelectEl = styled.select`border: 1px solid #c8cdd6; border-radius: 8px; font-size: 14px; padding: 10px 12px; background: #fff;`
const InputEl = styled.input`border: 1px solid #c8cdd6; border-radius: 8px; font-size: 14px; padding: 10px 12px;`
const Textarea = styled.textarea`border: 1px solid #c8cdd6; border-radius: 8px; font-size: 14px; padding: 10px 12px; min-height: 60px; resize: vertical;`
const Stepper = styled.div`display: flex; align-items: center; gap: 14px;`
const StepBtn = styled.button`width: 34px; height: 34px; border-radius: 8px; border: 1px solid #c8cdd6; background: #fff; font-size: 18px; cursor: pointer; &:disabled { opacity: 0.4; cursor: default; }`
const StepVal = styled.span`font-size: 16px; font-weight: 600; min-width: 18px; text-align: center;`
const InfoNote = styled.div`background: #eef3f8; border: 1px solid #cdd9e5; border-radius: 10px; padding: 11px 14px; font-size: 13px; color: #1f3a5f; line-height: 1.45; margin-top: 12px;`
const WarnNote = styled.div`background: #fff8eb; border: 1px solid #f4d199; border-radius: 10px; padding: 11px 14px; font-size: 13px; color: #7a5400; line-height: 1.45; margin-top: 10px;`
const ToggleRow = styled.div`display: flex; gap: 10px; margin-top: 8px;`
const RetBtn = styled.button`flex: 1; padding: 12px; border-radius: 10px; border: 1.5px solid ${(p) => (p.$on ? '#1d3c34' : '#c8cdd6')}; background: ${(p) => (p.$on ? '#eaf3ef' : '#fff')}; color: #12141d; font-size: 13px; font-weight: 600; cursor: pointer; text-align: left;`
const RetSub = styled.span`display: block; font-weight: 400; color: #6b7280; font-size: 12px; margin-top: 2px;`
const SummaryCard = styled.div`background: #f7f8fb; border: 1px solid #e6e9ef; border-radius: 12px; padding: 14px 16px; margin-top: 12px;`
const SumRow = styled.div`display: flex; justify-content: space-between; font-size: 13px; color: #424857; padding: 4px 0;`
const SumTotal = styled.div`display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; color: #12141d; padding-top: 8px; margin-top: 6px; border-top: 1px solid #e6e9ef;`
const SubmitBtn = styled.button`width: 100%; margin-top: 16px; padding: 15px; border-radius: 12px; border: none; background: #1d3c34; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; &:disabled { opacity: 0.5; cursor: default; }`
const ErrorText = styled.span`font-size: 12px; color: #b91c1c;`
const FootNote = styled.p`font-size: 11px; color: #9aa3b2; text-align: center; margin: 12px 0 0;`

const KefLockersEmbed = () => {
  useEmbedAutoResize()
  const [submitError, setSubmitError] = useState(null)
  const [avail, setAvail] = useState({ maxBoxes: KEF_MAX_BOXES, freeDropoff: 2 })

  const { control, register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } =
    useForm({
      mode: 'onChange',
      defaultValues: {
        boxes: 1,
        dropoffDate: '',
        pickupDate: '',
        dropoffTime: '',
        dropoffHours: 3,
        returnLocation: 'kef',
        pickupTime: '',
        pickupHours: 3,
        arrivalFlight: '',
        departureFlight: '',
        name: '',
        email: '',
        phone: '',
        comment: '',
      },
    })

  const v = watch()
  const isKef = v.returnLocation !== 'bsi'
  const days = daysBetween(v.dropoffDate, v.pickupDate) || 1
  const price = useMemo(
    () =>
      calcKefPrice({
        boxes: Number(v.boxes) || 1,
        dropoffDate: v.dropoffDate,
        pickupDate: v.pickupDate,
        returnLocation: isKef ? 'kef' : 'bsi',
        dropoffWindowHours: Number(v.dropoffHours) || 3,
        pickupWindowHours: Number(v.pickupHours) || 3,
      }),
    [v.boxes, v.dropoffDate, v.pickupDate, v.returnLocation, v.dropoffHours, v.pickupHours],
  )

  // Live availability — caps the box stepper + warns when full.
  useEffect(() => {
    if (!v.dropoffDate || !v.dropoffTime) return
    const params = new URLSearchParams({
      dropoffDate: v.dropoffDate,
      dropoffTime: v.dropoffTime,
      dropoffHours: String(v.dropoffHours || 3),
      returnLocation: isKef ? 'kef' : 'bsi',
    })
    if (isKef && v.pickupDate && v.pickupTime) {
      params.set('pickupDate', v.pickupDate)
      params.set('pickupTime', v.pickupTime)
      params.set('pickupHours', String(v.pickupHours || 3))
    }
    axios
      .get(`/api/kef/availability?${params.toString()}`)
      .then(({ data }) => {
        setAvail(data)
        if (data.maxBoxes >= 1 && Number(v.boxes) > data.maxBoxes) {
          setValue('boxes', data.maxBoxes)
        }
      })
      .catch(() => setAvail({ maxBoxes: KEF_MAX_BOXES, freeDropoff: 2 }))
  }, [v.dropoffDate, v.dropoffTime, v.dropoffHours, v.returnLocation, v.pickupDate, v.pickupTime, v.pickupHours])

  const full = avail.maxBoxes < 1

  const onSubmit = async (data) => {
    setSubmitError(null)
    try {
      const { data: resp } = await axios.post('/api/kef/checkout', {
        boxes: Number(data.boxes) || 1,
        name: data.name,
        email: data.email,
        phone: data.phone.startsWith('+') ? data.phone : `+${data.phone}`,
        dropoffDate: data.dropoffDate,
        dropoffTime: data.dropoffTime,
        dropoffHours: Number(data.dropoffHours) || 3,
        returnLocation: isKef ? 'kef' : 'bsi',
        pickupDate: data.pickupDate,
        pickupTime: isKef ? data.pickupTime : '',
        pickupHours: Number(data.pickupHours) || 3,
        arrivalFlight: data.arrivalFlight,
        departureFlight: data.departureFlight,
        comment: data.comment,
      })
      if (resp.redirectUrl) redirectTop(resp.redirectUrl)
      else setSubmitError('Could not start payment. Please try again.')
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Something went wrong. Please try again.')
    }
  }

  const winLabel = (h) => (h === 3 ? '3 hours (included)' : `${h} hours (+${((h - 3) * 1000).toLocaleString()} / box)`)

  return (
    <Shell>
      <PartnerFormHeader partnerName='Luggage Lockers' partnerSubtitle='Keflavík Airport · bike-box lockers' />
      <Body>
        <Intro>
          Self-service bike-box storage in our locked compartments at Keflavík Airport. Drop your
          boxed bike in the locker with your PIN; we store it and have it ready for your return.
        </Intro>

        {/* Boxes */}
        <Section>
          <SectionTitle>How many bike boxes?</SectionTitle>
          <Controller
            name='boxes'
            control={control}
            render={({ field }) => (
              <Stepper>
                <StepBtn type='button' disabled={field.value <= 1} onClick={() => field.onChange(Math.max(1, field.value - 1))}>−</StepBtn>
                <StepVal>{field.value}</StepVal>
                <StepBtn type='button' disabled={field.value >= Math.min(KEF_MAX_BOXES, Math.max(1, avail.maxBoxes))} onClick={() => field.onChange(Math.min(KEF_MAX_BOXES, field.value + 1))}>+</StepBtn>
              </Stepper>
            )}
          />
          <InfoNote>
            One bike box per locker. Each locker ({KEF_LOCKER_DIMENSIONS}) holds {KEF_LOCKER_CAPACITY_TEXT}.
          </InfoNote>
          {full && <WarnNote>No lockers are free for these times — please choose another date or time.</WarnNote>}
        </Section>

        {/* When */}
        <Section>
          <SectionTitle>Dates</SectionTitle>
          <TransportCalendar
            pickupDate={v.dropoffDate || null}
            deliveryDate={v.pickupDate || null}
            onChange={(d, p) => {
              setValue('dropoffDate', d || '', { shouldValidate: true })
              setValue('pickupDate', p || '', { shouldValidate: true })
            }}
            locale='en'
          />
          <input type='hidden' {...register('dropoffDate', { required: 'Drop-off date required' })} />
          <input type='hidden' {...register('pickupDate', { required: 'Pick-up date required' })} />

          <SectionTitle style={{ marginTop: 8 }}>Drop-off at KEF</SectionTitle>
          <FieldGrid>
            <Field>
              Drop-off time *
              <SelectEl {...register('dropoffTime', { required: 'Required' })}>
                <option value=''>Select time</option>
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </SelectEl>
              {errors.dropoffTime && <ErrorText>{errors.dropoffTime.message}</ErrorText>}
            </Field>
            <Field>
              Locker window
              <SelectEl {...register('dropoffHours')}>
                {WINDOW_HOURS.map((h) => <option key={h} value={h}>{winLabel(h)}</option>)}
              </SelectEl>
            </Field>
            <Field>
              Arrival flight (optional)
              <InputEl placeholder='e.g. FI205' {...register('arrivalFlight')} />
            </Field>
          </FieldGrid>
        </Section>

        {/* Return */}
        <Section>
          <SectionTitle>Where do you collect the box?</SectionTitle>
          <Controller
            name='returnLocation'
            control={control}
            render={({ field }) => (
              <ToggleRow>
                <RetBtn type='button' $on={field.value === 'kef'} onClick={() => field.onChange('kef')}>
                  Keflavík Airport locker
                  <RetSub>+10,000 / box · PIN to collect</RetSub>
                </RetBtn>
                <RetBtn type='button' $on={field.value === 'bsi'} onClick={() => field.onChange('bsi')}>
                  BSÍ bus terminal
                  <RetSub>no airport fee · collect in Reykjavík</RetSub>
                </RetBtn>
              </ToggleRow>
            )}
          />
          {isKef && (
            <FieldGrid style={{ marginTop: 10 }}>
              <Field>
                Pick-up time at KEF *
                <SelectEl {...register('pickupTime', { required: isKef ? 'Required' : false })}>
                  <option value=''>Select time</option>
                  {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </SelectEl>
                {errors.pickupTime && <ErrorText>{errors.pickupTime.message}</ErrorText>}
              </Field>
              <Field>
                Locker window
                <SelectEl {...register('pickupHours')}>
                  {WINDOW_HOURS.map((h) => <option key={h} value={h}>{winLabel(h)}</option>)}
                </SelectEl>
              </Field>
              <Field>
                Departure flight (optional)
                <InputEl placeholder='e.g. FI204' {...register('departureFlight')} />
              </Field>
            </FieldGrid>
          )}
        </Section>

        {/* Details */}
        <Section>
          <SectionTitle>Your details</SectionTitle>
          <FieldGrid>
            <Field style={{ gridColumn: '1 / -1' }}>
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
              <Controller
                name='phone'
                control={control}
                rules={{ required: 'Required', minLength: { value: 6, message: 'Too short' } }}
                render={({ field }) => <PhoneInput country='us' value={field.value} onChange={(val) => field.onChange(val)} enableSearch />}
              />
              {errors.phone && <ErrorText>{errors.phone.message}</ErrorText>}
            </Field>
            <Field style={{ gridColumn: '1 / -1' }}>
              Anything to add?
              <Textarea placeholder='Bike details, special requests…' {...register('comment')} />
            </Field>
          </FieldGrid>
        </Section>

        {/* Summary */}
        <SummaryCard>
          <SumRow><span>Storage length</span><span>{days} day{days !== 1 ? 's' : ''}</span></SumRow>
          {price.dropoffFee > 0 && <SumRow><span>KEF drop-off × {v.boxes}</span><span>{price.dropoffFee.toLocaleString()} ISK</span></SumRow>}
          {price.storage > 0 && <SumRow><span>Storage ({v.boxes} × {days}d)</span><span>{price.storage.toLocaleString()} ISK</span></SumRow>}
          {price.returnFee > 0 && <SumRow><span>KEF return × {v.boxes}</span><span>{price.returnFee.toLocaleString()} ISK</span></SumRow>}
          {price.windowExtra > 0 && <SumRow><span>Extra locker hours</span><span>{price.windowExtra.toLocaleString()} ISK</span></SumRow>}
          <SumTotal><span>Total</span><span>{price.total.toLocaleString()} ISK</span></SumTotal>
        </SummaryCard>

        {submitError && <ErrorText style={{ display: 'block', marginTop: 10 }}>{submitError}</ErrorText>}

        <SubmitBtn type='button' onClick={handleSubmit(onSubmit)} disabled={isSubmitting || full}>
          {isSubmitting ? 'Redirecting…' : `Book · ${price.total.toLocaleString()} ISK`}
        </SubmitBtn>
        <FootNote>🔒 Secure payment by Rapyd · Locker PIN emailed before drop-off · Powered by BagBee</FootNote>
      </Body>
    </Shell>
  )
}

export default KefLockersEmbed
