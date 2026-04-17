import React, { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { NextSeo } from 'next-seo'
import styled from '@emotion/styled'
import { keyframes } from '@emotion/react'
import { useForm, Controller } from 'react-hook-form'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import axios from 'axios'
import toast, { Toaster } from 'react-hot-toast'
import Logo from '../public/icons/Logo'

/* ---------- price logic ---------- */

const PRICE_LUGGAGE_PER_DAY = 1500
const PRICE_BACKPACK_FLAT = 1000
const PRICE_LATE_PER_BAG = 500
const PRICE_DELIVERY_FLAT = 2500

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
  const start = new Date(a).getTime()
  const end = new Date(b).getTime()
  if (isNaN(start) || isNaN(end) || end < start) return 0
  const ms = end - start
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

const calcPrice = (v: Partial<FormValues>) => {
  const days = daysBetween(v.arrivalDate, v.departureDate) || 1
  const luggage = Number(v.luggage) || 0
  const backpacks = Number(v.backpacks) || 0
  const base =
    luggage * PRICE_LUGGAGE_PER_DAY * days + backpacks * PRICE_BACKPACK_FLAT
  const late = v.late ? luggage * PRICE_LATE_PER_BAG : 0
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

/* ---------- styles ---------- */

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const floatBg = keyframes`
  0%   { transform: translate(0,0) scale(1); }
  50%  { transform: translate(40px,-30px) scale(1.1); }
  100% { transform: translate(0,0) scale(1); }
`

const Page = styled.div`
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #fff8ec 0%, #ffeacc 45%, #f7e0ff 100%);
  font-family: ${({ theme }) => theme.fonts.poppins};

  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 520px;
    height: 520px;
    border-radius: 50%;
    filter: blur(120px);
    opacity: 0.55;
    pointer-events: none;
  }
  &::before {
    top: -180px;
    left: -140px;
    background: #f3ad3c;
    animation: ${floatBg} 18s ease-in-out infinite;
  }
  &::after {
    bottom: -200px;
    right: -180px;
    background: #3d7165;
    animation: ${floatBg} 22s ease-in-out infinite reverse;
  }
`

const TopBar = styled.header`
  position: relative;
  z-index: 2;
  padding: 24px 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const TopLinks = styled.div`
  display: flex;
  gap: 18px;
  a {
    color: #1d3c34;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    opacity: 0.8;
    &:hover {
      opacity: 1;
    }
  }
`

const Shell = styled.div`
  position: relative;
  z-index: 1;
  max-width: 1180px;
  margin: 0 auto;
  padding: 12px 24px 80px;
  display: grid;
  gap: 28px;
  grid-template-columns: 1fr;
  @media (min-width: 960px) {
    grid-template-columns: 1.6fr 1fr;
    align-items: flex-start;
  }
`

const Hero = styled.section`
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px 0 16px;
  animation: ${fadeIn} 0.6s ease both;

  h1 {
    font-family: ${({ theme }) => theme.fonts.druk};
    font-size: 48px;
    line-height: 1;
    margin: 0 0 12px;
    color: #000929;
    letter-spacing: -1px;
    @media (min-width: 720px) {
      font-size: 72px;
    }
  }
  p {
    max-width: 620px;
    margin: 0 auto;
    color: #3d4558;
    font-size: 17px;
    line-height: 1.55;
  }
`

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(243, 173, 60, 0.4);
  color: #8b5a12;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 999px;
  margin-bottom: 16px;
`

const Card = styled.form`
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 28px;
  padding: 36px 30px;
  box-shadow: 0 20px 60px -20px rgba(29, 60, 52, 0.25);
  animation: ${fadeIn} 0.7s ease both;
  animation-delay: 0.1s;
  @media (min-width: 720px) {
    padding: 44px 44px;
  }
`

const Stepper = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 32px;
`

const StepPill = styled.div<{ active: boolean; done: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ active, done }) => (active || done ? '#1d3c34' : '#9aa1ad')};

  span:first-of-type {
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }
  b {
    display: inline-flex;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    background: ${({ active, done }) =>
      done ? '#3d7165' : active ? '#f3ad3c' : '#e5e6eb'};
    color: ${({ active, done }) =>
      active || done ? '#fff' : '#9aa1ad'};
    transition: background 0.3s ease;
  }
  div {
    height: 4px;
    border-radius: 4px;
    background: ${({ active, done }) =>
      done ? '#3d7165' : active ? '#f3ad3c' : '#e5e6eb'};
    transition: background 0.3s ease;
  }
`

const StepContent = styled.div`
  animation: ${fadeIn} 0.35s ease both;
`

const StepTitle = styled.h2`
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 700;
  color: #000929;
`

const StepSubtitle = styled.p`
  margin: 0 0 26px;
  font-size: 14px;
  color: #6b7280;
`

const FieldGrid = styled.div`
  display: grid;
  gap: 18px;
  grid-template-columns: 1fr;
  @media (min-width: 620px) {
    grid-template-columns: 1fr 1fr;
  }
`

const Field = styled.div<{ span?: number }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  grid-column: ${({ span }) => (span === 2 ? '1 / -1' : 'auto')};
`

const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: #1d3c34;
  letter-spacing: 0.2px;
`

const Hint = styled.span`
  font-size: 12px;
  color: #8692a6;
  font-weight: 400;
  margin-left: 6px;
`

const BaseInputStyles = `
  width: 100%;
  height: 52px;
  border-radius: 14px;
  border: 1.5px solid #e0d7c7;
  background: #ffffff;
  padding: 0 16px;
  font-family: inherit;
  font-size: 15px;
  color: #12141d;
  transition: border-color 0.2s ease, box-shadow 0.2s ease,
    transform 0.1s ease;
  &:hover { border-color: #f3ad3c; }
  &:focus {
    outline: none;
    border-color: #f3ad3c;
    box-shadow: 0 0 0 4px rgba(243, 173, 60, 0.18);
  }
`

const Input = styled.input`
  ${BaseInputStyles}
`

const Select = styled.select`
  ${BaseInputStyles}
  appearance: none;
  background: #ffffff
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 20 20'><path d='M5 7l5 6 5-6' stroke='%238692a6' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>")
    no-repeat right 16px center;
  padding-right: 44px;
`

const Textarea = styled.textarea`
  ${BaseInputStyles}
  height: auto;
  min-height: 110px;
  padding: 14px 16px;
  resize: vertical;
  line-height: 1.45;
`

const Stepper2 = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: #ffffff;
  border: 1.5px solid #e0d7c7;
  border-radius: 14px;
  padding: 6px 10px;
  height: 52px;
  button {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    border: none;
    background: #fff5e1;
    color: #8b5a12;
    font-size: 20px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.1s ease, background 0.15s ease;
    &:hover:not(:disabled) {
      background: #f3ad3c;
      color: #fff;
      transform: scale(1.05);
    }
    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
  span {
    flex: 1;
    text-align: center;
    font-weight: 600;
    font-size: 16px;
    color: #12141d;
    font-variant-numeric: tabular-nums;
  }
`

const ToggleRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  background: #fff;
  border: 1.5px solid #e0d7c7;
  border-radius: 14px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
  &:hover {
    border-color: #f3ad3c;
    background: #fffaf0;
  }
  > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    b {
      font-size: 14px;
      font-weight: 600;
      color: #12141d;
    }
    small {
      font-size: 12px;
      color: #8692a6;
    }
  }
`

const Switch = styled.span<{ on: boolean }>`
  position: relative;
  width: 46px;
  height: 26px;
  background: ${({ on }) => (on ? '#3d7165' : '#d9dbe1')};
  border-radius: 999px;
  flex-shrink: 0;
  transition: background 0.25s ease;
  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: ${({ on }) => (on ? '23px' : '3px')};
    width: 20px;
    height: 20px;
    background: #fff;
    border-radius: 50%;
    transition: left 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.3);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
  }
`

const PhoneWrap = styled.div`
  .react-tel-input .form-control {
    width: 100% !important;
    height: 52px !important;
    border-radius: 14px !important;
    border: 1.5px solid #e0d7c7 !important;
    padding-left: 58px !important;
    font-size: 15px !important;
    font-family: inherit !important;
    background: #fff !important;
  }
  .react-tel-input .form-control:focus {
    border-color: #f3ad3c !important;
    box-shadow: 0 0 0 4px rgba(243, 173, 60, 0.18) !important;
  }
  .react-tel-input .flag-dropdown {
    border: 1.5px solid #e0d7c7 !important;
    border-right: none !important;
    border-top-left-radius: 14px !important;
    border-bottom-left-radius: 14px !important;
    background: #fff !important;
  }
`

const ErrorText = styled.span`
  font-size: 12px;
  color: #d04a3c;
  margin-top: -2px;
`

const Info = styled.div`
  margin: 4px 0 26px;
  padding: 12px 16px;
  background: #fff5e1;
  border: 1px solid #f3ad3c;
  border-radius: 12px;
  font-size: 13px;
  color: #8b5a12;
  a {
    color: #1d3c34;
    font-weight: 600;
  }
`

const Actions = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 32px;
`

const Btn = styled.button<{ variant?: 'primary' | 'ghost' }>`
  min-width: 140px;
  height: 52px;
  padding: 0 28px;
  border-radius: 14px;
  border: none;
  font-family: inherit;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: transform 0.1s ease, box-shadow 0.2s ease, background 0.2s ease;
  ${({ variant }) =>
    variant === 'ghost'
      ? `
    background: transparent;
    color: #1d3c34;
    border: 1.5px solid #c4cbd6;
    &:hover { background: #f4f6f9; }
  `
      : `
    background: linear-gradient(135deg, #f3ad3c 0%, #e37f2f 100%);
    color: #fff;
    box-shadow: 0 10px 24px -12px rgba(227, 127, 47, 0.7);
    &:hover { transform: translateY(-1px); box-shadow: 0 14px 28px -12px rgba(227,127,47,0.75);}
    &:disabled { opacity: 0.5; cursor: not-allowed; transform:none; box-shadow:none;}
  `}
`

/* summary */

const Summary = styled.aside`
  position: sticky;
  top: 24px;
  align-self: start;
  background: linear-gradient(160deg, #1d3c34 0%, #0f1f1b 100%);
  color: #fff;
  border-radius: 28px;
  padding: 28px;
  box-shadow: 0 20px 60px -20px rgba(29, 60, 52, 0.45);
  animation: ${fadeIn} 0.7s ease both;
  animation-delay: 0.2s;
  @media (max-width: 959px) {
    position: relative;
    top: 0;
  }
`

const SummaryHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 22px;
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }
  span {
    font-size: 11px;
    font-weight: 600;
    color: #f3ad3c;
    letter-spacing: 1.4px;
    text-transform: uppercase;
  }
`

const SumRow = styled.div<{ muted?: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 10px 0;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
  font-size: 14px;
  color: ${({ muted }) => (muted ? 'rgba(255,255,255,0.55)' : '#fff')};
  b {
    font-weight: 600;
  }
`

const Total = styled.div`
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  span {
    font-size: 12px;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
  }
  b {
    font-size: 32px;
    font-weight: 700;
    color: #f3ad3c;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
`

const BulletList = styled.ul`
  margin: 22px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  li {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.75);
    line-height: 1.5;
    &::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #f3ad3c;
      margin-top: 7px;
      flex-shrink: 0;
    }
  }
`

const SuccessCard = styled.div`
  background: #fff;
  border-radius: 28px;
  padding: 60px 40px;
  text-align: center;
  box-shadow: 0 20px 60px -20px rgba(29, 60, 52, 0.25);
  animation: ${fadeIn} 0.6s ease both;
  h2 {
    font-family: ${({ theme }) => theme.fonts.druk};
    font-size: 42px;
    color: #1d3c34;
    margin: 16px 0 8px;
  }
  p {
    color: #3d4558;
    font-size: 16px;
    margin: 0 auto 24px;
    max-width: 420px;
    line-height: 1.5;
  }
  .check {
    width: 72px;
    height: 72px;
    margin: 0 auto;
    border-radius: 50%;
    background: linear-gradient(135deg, #3d7165, #1d3c34);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 36px;
  }
`

/* ---------- helpers ---------- */

const timeOptions = (startHour = 6, startMin = 45, endHour = 23) => {
  const out: string[] = []
  let h = startHour
  let m = startMin
  while (h < endHour || (h === endHour && m === 0)) {
    const hh = h % 12 === 0 ? 12 : h % 12
    const mm = m.toString().padStart(2, '0')
    const ap = h < 12 ? 'AM' : 'PM'
    out.push(`${hh}:${mm} ${ap}`)
    m += 15
    if (m >= 60) {
      m = 0
      h += 1
    }
  }
  return out
}

const CHECKIN_TIMES = timeOptions(6, 45, 17)
const CHECKOUT_TIMES_NORMAL = timeOptions(6, 45, 17)
const CHECKOUT_TIMES_LATE = timeOptions(6, 45, 23)

const isoToday = () => new Date().toISOString().slice(0, 10)

/* ---------- component ---------- */

const STEPS = ['Luggage', 'When', 'Options', 'Contact'] as const

const LuggageStorage = () => {
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)

  const {
    control,
    register,
    handleSubmit,
    watch,
    trigger,
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

  const values = watch()
  const price = useMemo(() => calcPrice(values), [values])
  const storageType = useMemo(() => deriveStorageType(values), [values])

  const stepFields: Record<number, (keyof FormValues)[]> = {
    0: ['luggage', 'backpacks'],
    1: ['arrivalDate', 'departureDate', 'arrivalTime', 'departureTime'],
    2: [],
    3: ['name', 'email', 'phone'],
  }

  const next = async () => {
    const ok = await trigger(stepFields[step])
    if (!ok) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const prev = () => {
    setStep((s) => Math.max(s - 1, 0))
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const onSubmit = async (v: FormValues) => {
    const payload: Record<string, unknown> = {
      Name: v.name,
      Email: v.email,
      PhoneNumber: v.phone.startsWith('+') ? v.phone : `+${v.phone}`,
      Luggage: Number(v.luggage) || 0,
      'Backpack / Purse (ISK 1000 pr. item)': Number(v.backpacks) || 0,
      ArrivalDate: v.arrivalDate,
      'Arrival time': v.arrivalTime,
      'Departure date': v.departureDate,
      'Departure time': v.departureTime,
      'Delivery Service': v.delivery,
      'Late check-out (ISK 500 pr. bag)': v.late,
      'Type of storage': storageType,
      Athugasemd: v.comment,
    }
    if (v.delivery && v.deliveryAddress) {
      payload['Delivery Address'] = v.deliveryAddress
    }
    if (v.hotel) payload['Hotel or Cruise ship name'] = v.hotel

    try {
      await axios.post('/api/airtable/create-storage', payload)
      setSubmitted(true)
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (err) {
      toast.error('Something went wrong. Please try again or contact us.')
      console.error(err)
    }
  }

  return (
    <Page>
      <NextSeo
        title='Luggage Storage in Reykjavik — BagBee'
        description='Secure, staffed luggage storage at the BSÍ bus terminal in Reykjavik City Center. Book in seconds.'
      />
      <Toaster position='top-center' />
      <TopBar>
        <Link href='/' aria-label='BagBee home'>
          <Logo />
        </Link>
        <TopLinks>
          <Link href='/'>Home</Link>
          <Link href='/about'>About</Link>
          <a href='mailto:info@bagbee.is'>Contact</a>
        </TopLinks>
      </TopBar>

      <div ref={topRef} />

      <Shell>
        <Hero>
          <Chip>&#x2022; Open daily &#x2022; BSÍ Bus Terminal, Reykjavik</Chip>
          <h1>Drop your bags.
Go enjoy Iceland.</h1>
          <p>
            Secure, staffed luggage storage in the heart of Reykjavik. Book
            your slot in under a minute — pay on arrival, or add delivery
            straight to your hotel.
          </p>
        </Hero>

        {submitted ? (
          <SuccessCard style={{ gridColumn: '1 / -1' }}>
            <div className='check'>&#10003;</div>
            <h2>Booking received!</h2>
            <p>
              Thanks {values.name?.split(' ')[0] || 'there'} — we&apos;ve sent
              your details to our team. You&apos;ll get a confirmation email at{' '}
              <b>{values.email}</b> shortly. See you at BSÍ!
            </p>
            <Btn
              type='button'
              onClick={() => {
                setSubmitted(false)
                setStep(0)
              }}
            >
              Make another booking
            </Btn>
          </SuccessCard>
        ) : (
          <>
            <Card onSubmit={handleSubmit(onSubmit)}>
              <Stepper>
                {STEPS.map((s, i) => (
                  <StepPill key={s} active={i === step} done={i < step}>
                    <span>
                      <b>{i < step ? '\u2713' : i + 1}</b> {s}
                    </span>
                    <div />
                  </StepPill>
                ))}
              </Stepper>

              {step === 0 && (
                <StepContent>
                  <StepTitle>How much are you storing?</StepTitle>
                  <StepSubtitle>
                    You can store any kind of item — bags, suitcases, golf
                    bags.
                  </StepSubtitle>

                  <FieldGrid>
                    <Field>
                      <Label>
                        Luggage items <Hint>max 10 per booking</Hint>
                      </Label>
                      <Controller
                        name='luggage'
                        control={control}
                        rules={{ min: 0, max: 10 }}
                        render={({ field }) => (
                          <Stepper2>
                            <button
                              type='button'
                              disabled={field.value <= 0}
                              onClick={() =>
                                field.onChange(Math.max(0, field.value - 1))
                              }
                            >
                              −
                            </button>
                            <span>{field.value}</span>
                            <button
                              type='button'
                              disabled={field.value >= 10}
                              onClick={() =>
                                field.onChange(Math.min(10, field.value + 1))
                              }
                            >
                              +
                            </button>
                          </Stepper2>
                        )}
                      />
                    </Field>

                    <Field>
                      <Label>
                        Backpacks / purses{' '}
                        <Hint>≤ 50 cm, with shoulder straps</Hint>
                      </Label>
                      <Controller
                        name='backpacks'
                        control={control}
                        rules={{ min: 0, max: 10 }}
                        render={({ field }) => (
                          <Stepper2>
                            <button
                              type='button'
                              disabled={field.value <= 0}
                              onClick={() =>
                                field.onChange(Math.max(0, field.value - 1))
                              }
                            >
                              −
                            </button>
                            <span>{field.value}</span>
                            <button
                              type='button'
                              disabled={field.value >= 10}
                              onClick={() =>
                                field.onChange(Math.min(10, field.value + 1))
                              }
                            >
                              +
                            </button>
                          </Stepper2>
                        )}
                      />
                    </Field>
                  </FieldGrid>

                  <Info style={{ marginTop: 20 }}>
                    Pre-bookings are for storage between <b>June 1st</b> and{' '}
                    <b>September 30th</b>. For winter storage please use the{' '}
                    <a
                      href='https://www.luggagelockers.is'
                      target='_blank'
                      rel='noreferrer'
                    >
                      24/7 luggage lockers
                    </a>
                    .
                  </Info>
                </StepContent>
              )}

              {step === 1 && (
                <StepContent>
                  <StepTitle>When should we hold them?</StepTitle>
                  <StepSubtitle>
                    Pick your drop-off and pick-up slots — you can edit later
                    if plans change.
                  </StepSubtitle>

                  <FieldGrid>
                    <Field>
                      <Label>Drop-off date</Label>
                      <Input
                        type='date'
                        min={isoToday()}
                        {...register('arrivalDate', {
                          required: 'Drop-off date is required',
                        })}
                      />
                      {errors.arrivalDate && (
                        <ErrorText>{errors.arrivalDate.message}</ErrorText>
                      )}
                    </Field>

                    <Field>
                      <Label>Pick-up date</Label>
                      <Input
                        type='date'
                        min={values.arrivalDate || isoToday()}
                        {...register('departureDate', {
                          required: 'Pick-up date is required',
                          validate: (v) =>
                            !values.arrivalDate ||
                            v >= values.arrivalDate ||
                            'Pick-up must be after drop-off',
                        })}
                      />
                      {errors.departureDate && (
                        <ErrorText>{errors.departureDate.message}</ErrorText>
                      )}
                    </Field>

                    <Field>
                      <Label>Check-in time</Label>
                      <Select
                        {...register('arrivalTime', {
                          required: 'Check-in time is required',
                        })}
                      >
                        <option value=''>Select time</option>
                        {CHECKIN_TIMES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                      {errors.arrivalTime && (
                        <ErrorText>{errors.arrivalTime.message}</ErrorText>
                      )}
                    </Field>

                    <Field>
                      <Label>Check-out time</Label>
                      <Select
                        {...register('departureTime', {
                          required: 'Check-out time is required',
                        })}
                      >
                        <option value=''>Select time</option>
                        {(values.late
                          ? CHECKOUT_TIMES_LATE
                          : CHECKOUT_TIMES_NORMAL
                        ).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                      {errors.departureTime && (
                        <ErrorText>{errors.departureTime.message}</ErrorText>
                      )}
                    </Field>
                  </FieldGrid>
                </StepContent>
              )}

              {step === 2 && (
                <StepContent>
                  <StepTitle>Any extras?</StepTitle>
                  <StepSubtitle>
                    Upgrade your booking with late pickup or delivery to your
                    hotel.
                  </StepSubtitle>

                  <FieldGrid>
                    <Field span={2}>
                      <Controller
                        name='late'
                        control={control}
                        render={({ field }) => (
                          <ToggleRow onClick={() => field.onChange(!field.value)}>
                            <div>
                              <b>Pick-up later than 5pm</b>
                              <small>
                                Adds {PRICE_LATE_PER_BAG} ISK per bag for
                                out-of-hours collection.
                              </small>
                            </div>
                            <Switch on={!!field.value} />
                          </ToggleRow>
                        )}
                      />
                    </Field>

                    <Field span={2}>
                      <Controller
                        name='delivery'
                        control={control}
                        render={({ field }) => (
                          <ToggleRow onClick={() => field.onChange(!field.value)}>
                            <div>
                              <b>Deliver luggage to my hotel</b>
                              <small>
                                We&apos;ll bring your bags straight to your
                                accommodation (+{PRICE_DELIVERY_FLAT} ISK).
                              </small>
                            </div>
                            <Switch on={!!field.value} />
                          </ToggleRow>
                        )}
                      />
                    </Field>

                    {values.delivery && (
                      <>
                        <Field span={2}>
                          <Label>Hotel / Accommodation</Label>
                          <Input
                            placeholder='e.g. Hotel Reykjavik Centrum'
                            {...register('hotel')}
                          />
                        </Field>
                        <Field span={2}>
                          <Label>Delivery address</Label>
                          <Input
                            placeholder='Street, city'
                            {...register('deliveryAddress')}
                          />
                        </Field>
                      </>
                    )}
                  </FieldGrid>
                </StepContent>
              )}

              {step === 3 && (
                <StepContent>
                  <StepTitle>Your details</StepTitle>
                  <StepSubtitle>
                    We use these to confirm your booking and reach you if
                    anything changes.
                  </StepSubtitle>

                  <FieldGrid>
                    <Field span={2}>
                      <Label>Full name</Label>
                      <Input
                        placeholder='Jane Doe'
                        {...register('name', {
                          required: 'Name is required',
                          minLength: { value: 2, message: 'Name too short' },
                        })}
                      />
                      {errors.name && (
                        <ErrorText>{errors.name.message}</ErrorText>
                      )}
                    </Field>

                    <Field>
                      <Label>Email</Label>
                      <Input
                        type='email'
                        placeholder='you@example.com'
                        {...register('email', {
                          required: 'Email is required',
                          pattern: {
                            value: /^\S+@\S+\.\S+$/,
                            message: 'Invalid email',
                          },
                        })}
                      />
                      {errors.email && (
                        <ErrorText>{errors.email.message}</ErrorText>
                      )}
                    </Field>

                    <Field>
                      <Label>Phone</Label>
                      <PhoneWrap>
                        <Controller
                          name='phone'
                          control={control}
                          rules={{
                            required: 'Phone is required',
                            minLength: { value: 6, message: 'Too short' },
                          }}
                          render={({ field }) => (
                            <PhoneInput
                              country={'is'}
                              value={field.value}
                              onChange={(v) => field.onChange(v)}
                              enableSearch
                            />
                          )}
                        />
                      </PhoneWrap>
                      {errors.phone && (
                        <ErrorText>{errors.phone.message}</ErrorText>
                      )}
                    </Field>

                    <Field span={2}>
                      <Label>
                        Anything we should know? <Hint>optional</Hint>
                      </Label>
                      <Textarea
                        placeholder='Flight details, special requests, etc.'
                        {...register('comment')}
                      />
                    </Field>
                  </FieldGrid>
                </StepContent>
              )}

              <Actions>
                {step > 0 ? (
                  <Btn type='button' variant='ghost' onClick={prev}>
                    ← Back
                  </Btn>
                ) : (
                  <span />
                )}
                {step < STEPS.length - 1 ? (
                  <Btn type='button' onClick={next}>
                    Continue →
                  </Btn>
                ) : (
                  <Btn type='submit' disabled={isSubmitting}>
                    {isSubmitting ? 'Booking…' : 'Complete booking'}
                  </Btn>
                )}
              </Actions>
            </Card>

            <Summary>
              <SummaryHead>
                <h3>Your booking</h3>
                <span>Live</span>
              </SummaryHead>

              <SumRow>
                <b>{storageType}</b>
                <span>
                  {price.days} day{price.days > 1 ? 's' : ''}
                </span>
              </SumRow>
              <SumRow muted={!values.luggage}>
                <span>
                  Luggage × {values.luggage || 0}
                  <Hint>
                    @ {PRICE_LUGGAGE_PER_DAY.toLocaleString()} / day
                  </Hint>
                </span>
                <b>
                  {(
                    (values.luggage || 0) *
                    PRICE_LUGGAGE_PER_DAY *
                    price.days
                  ).toLocaleString()}{' '}
                  kr
                </b>
              </SumRow>
              <SumRow muted={!values.backpacks}>
                <span>Backpacks × {values.backpacks || 0}</span>
                <b>
                  {(
                    (values.backpacks || 0) * PRICE_BACKPACK_FLAT
                  ).toLocaleString()}{' '}
                  kr
                </b>
              </SumRow>
              {values.late && (
                <SumRow>
                  <span>Late pickup</span>
                  <b>{price.late.toLocaleString()} kr</b>
                </SumRow>
              )}
              {values.delivery && (
                <SumRow>
                  <span>Hotel delivery</span>
                  <b>{price.delivery.toLocaleString()} kr</b>
                </SumRow>
              )}

              <Total>
                <div>
                  <span>Total</span>
                </div>
                <b>{price.total.toLocaleString()} kr</b>
              </Total>

              <BulletList>
                <li>Pay securely on arrival at BSÍ — cash or card.</li>
                <li>Cancel or change up to 12 hours before drop-off.</li>
                <li>Staffed storage, camera surveillance, 100% insured.</li>
              </BulletList>
            </Summary>
          </>
        )}
      </Shell>
    </Page>
  )
}

export default LuggageStorage
