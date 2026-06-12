// @ts-nocheck
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { NextSeo } from 'next-seo'
import styled from '@emotion/styled'
import axios from 'axios'
import dayjs from 'dayjs'
import Header from '../../components/header/Header'
import TransportCalendar from '../../components/transport/TransportCalendar'
import { calcStoragePrice, getStorageRates } from '../../utils/storagePricing'

// ────────────────────────────────────────────────────────────
// Time options — same 15-min grid as the booking form
// ────────────────────────────────────────────────────────────
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
const CHECKIN_TIMES = timeOptions(6, 45, 17)
const CHECKOUT_TIMES_OPEN = timeOptions(6, 45, 17)
const CHECKOUT_TIMES_LATE = timeOptions(17, 15, 23)

// ────────────────────────────────────────────────────────────
// Status / progress
// ────────────────────────────────────────────────────────────
type StorageStep = 'Confirmed' | 'Drop-off' | 'In storage' | 'Picked up'
const STORAGE_STEPS: StorageStep[] = ['Confirmed', 'Drop-off', 'In storage', 'Picked up']

const STATUS_COLORS: Record<string, string> = {
  Pending: '#A3A4A7',
  Paid: '#3D7165',
  Confirmed: '#F3AD3C',
  'Drop-off': '#F3AD3C',
  'In storage': '#E37F2F',
  'Picked up': '#3D7165',
  Refunded: '#1d4ed8',
  Cancelled: '#A3A4A7',
  Failed: '#c2313b',
}

const currentStep = (
  paymentStatus: string,
  arrivalDate?: string,
  departureDate?: string,
  pickedUp?: boolean,
): StorageStep => {
  if (pickedUp) return 'Picked up'
  if (!arrivalDate) return 'Confirmed'
  const today = dayjs().startOf('day')
  const a = dayjs(arrivalDate).startOf('day')
  const d = departureDate ? dayjs(departureDate).startOf('day') : a
  if (today.isBefore(a)) return 'Confirmed'
  if (today.isSame(a, 'day')) return 'Drop-off'
  if (today.isAfter(d)) return 'Picked up'
  return 'In storage'
}

// ────────────────────────────────────────────────────────────
// Styled components — orders-page design language
// ────────────────────────────────────────────────────────────
const Page = styled.div`
  background: #E5E6EB;
  min-height: 100vh;
`
const PageContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  padding-bottom: 80px;
`
const OrderTitle = styled.h1`
  font-family: 'Poppins', sans-serif;
  font-size: 28px;
  font-weight: 600;
  color: #000929;
  margin: 0 0 8px;
  @media (min-width: 768px) { font-size: 36px; }
`
const OrderSubtitle = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #a3a4a7;
  margin: 0 0 24px;
`
const Section = styled.section`
  margin-bottom: 32px;
`
const SectionTitle = styled.h2`
  font-family: 'Poppins', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: #000929;
  margin: 0 0 16px;
`
const StatusCard = styled.div`
  background: #fff;
  border-radius: 20px;
  padding: 24px;
  border: 1px solid #e5e6eb;
`
const StatusCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
`
const StatusBadge = styled.span<{ bg: string }>`
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: ${({ bg }) => bg};
`
const EditOrderLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #d0d0d8;
  border-radius: 20px;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #000929;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #f5f5f7; border-color: #000929; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`
const DetailGrid = styled.div`
  display: grid;
  gap: 12px;
  margin-top: 16px;
`
const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  &:last-child { border-bottom: none; }
`
const DetailLabel = styled.span`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #696f79;
`
const DetailValue = styled.span`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: #000929;
  text-align: right;
  white-space: pre-wrap;
`
const CancelOrderRow = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #efeff3;
`
const CancelOrderLink = styled.button`
  background: transparent;
  border: 0;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  color: #8a8a94;
  cursor: pointer;
  text-decoration: underline;
  padding: 4px 8px;
  &:hover { color: #c2313b; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`

// Progress bar
const ProgressContainer = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0;
  margin: 8px 0 24px;
`
const ProgressStep = styled.div`
  flex: 1;
  text-align: center;
  position: relative;
`
const ProgressDot = styled.div<{ active: boolean; completed: boolean; color: string }>`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${({ completed, active, color }) =>
    completed || active ? color : '#e5e6eb'};
  margin: 0 auto 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
  position: relative;
  z-index: 2;
`
const ProgressLabel = styled.span<{ active: boolean }>`
  font-family: 'Poppins', sans-serif;
  font-size: 10px;
  color: ${({ active }) => (active ? '#000929' : '#a3a4a7')};
  font-weight: ${({ active }) => (active ? 600 : 400)};
`
const ProgressLine = styled.div<{ filled: boolean }>`
  position: absolute;
  top: 14px;
  left: 50%;
  right: -50%;
  height: 3px;
  background: ${({ filled }) => (filled ? '#3D7165' : '#e5e6eb')};
  z-index: 1;
`
const Notice = styled.div<{ kind?: 'info' | 'warn' | 'error' }>`
  padding: 12px 16px;
  border-radius: 12px;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  background: ${({ kind }) =>
    kind === 'warn' ? '#fef9c3' : kind === 'error' ? '#fee2e2' : '#eff6ff'};
  color: ${({ kind }) =>
    kind === 'warn' ? '#92400e' : kind === 'error' ? '#b00020' : '#1e40af'};
  border: 1px solid ${({ kind }) =>
    kind === 'warn' ? '#fde68a' : kind === 'error' ? '#fecaca' : '#bfdbfe'};
  margin-bottom: 16px;
`

// Edit form widgets
const EditFormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
  @media (max-width: 480px) { grid-template-columns: 1fr; }
`
const InputLabel = styled.label`
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: #696f79;
  display: block;
  margin-bottom: 6px;
`
const Select = styled.select`
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #e5e6eb;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  background: #fff;
  color: #000929;
`
const Stepper = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f9fafb;
  border-radius: 12px;
  padding: 6px 8px;
`
const StepBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: #000929;
  color: #fff;
  font-family: 'Poppins', sans-serif;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`
const StepCount = styled.div`
  flex: 1;
  text-align: center;
  font-weight: 600;
  font-size: 16px;
  color: #000929;
`
const PriceDiff = styled.div<{ kind: 'up' | 'down' | 'same' }>`
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 12px;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  background: ${({ kind }) =>
    kind === 'up' ? '#fef3c7' : kind === 'down' ? '#dcfce7' : '#f3f4f6'};
  color: ${({ kind }) =>
    kind === 'up' ? '#92400e' : kind === 'down' ? '#15803d' : '#374151'};
  border: 1px solid ${({ kind }) =>
    kind === 'up' ? '#fde68a' : kind === 'down' ? '#bbf7d0' : '#e5e6eb'};
`
const PrimaryBtn = styled.button`
  padding: 12px 24px;
  border-radius: 20px;
  border: none;
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  background: #000929;
  color: #fff;
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`
const SecondaryBtn = styled.button`
  padding: 12px 24px;
  border-radius: 20px;
  border: 1px solid #d0d0d8;
  font-family: 'Poppins', sans-serif;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  background: #fff;
  color: #000929;
  &:hover { background: #f5f5f7; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`
const ActionRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 20px;
`

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
type BookingFields = Record<string, unknown>

const fmt = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}
const fmtDate = (s?: string): string => (s ? dayjs(s).format('DD/MM/YYYY') : '—')
const fmtIsk = (n: unknown): string =>
  typeof n === 'number' && !isNaN(n) ? `${n.toLocaleString()} kr` : '—'

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────
export default function StorageBookingPage() {
  const router = useRouter()
  const { id } = router.query as { id: string }

  const [fields, setFields] = useState<BookingFields | null>(null)
  // Resolved Airtable record id (the URL may be the short Booking Number).
  const [recordId, setRecordId] = useState('')
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [cancelRefunded, setCancelRefunded] = useState(true)
  const [error, setError] = useState('')

  // Edit panel state
  const [editing, setEditing] = useState(false)
  const [editArrivalDate, setEditArrivalDate] = useState('')
  const [editDepartureDate, setEditDepartureDate] = useState('')
  const [editArrivalTime, setEditArrivalTime] = useState('')
  const [editDepartureTime, setEditDepartureTime] = useState('')
  const [editLuggage, setEditLuggage] = useState(0)
  const [editBackpacks, setEditBackpacks] = useState(0)
  const [editLate, setEditLate] = useState(false)
  const [editDelivery, setEditDelivery] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editFlash, setEditFlash] = useState<string | null>(null)
  const [closedDates, setClosedDates] = useState<string[]>([])

  const bookingRef = fields?.['Reference']
  useEffect(() => {
    const source = bookingRef === 'luggagelockers.is' ? 'luggage-lockers' : 'bagbee'
    axios
      .get(`/api/booking/closed-dates?source=${source}`)
      .then(({ data }) => setClosedDates(data?.dates || []))
      .catch(() => setClosedDates([]))
  }, [bookingRef])

  useEffect(() => {
    if (!id) return
    axios
      .get(`/api/storage/${id}`)
      .then((r) => { setFields(r.data.fields); setRecordId(r.data.id); setLoading(false) })
      .catch(() => { setError('Booking not found.'); setLoading(false) })
  }, [id])

  const payStatus = (fields?.['Payment Status'] as string) || 'Pending'

  // Cancellation is always allowed (until terminal). Refund eligibility is
  // decided server-side: full refund 24h+ before drop-off, no refund inside 24h.
  const canCancel = (): boolean => {
    if (!fields) return false
    if (payStatus === 'Cancelled' || payStatus === 'Refunded') return false
    return payStatus === 'Paid' || payStatus === 'Pending'
  }
  // Edits close 24h before drop-off.
  const canEdit = (): boolean => {
    if (!fields || payStatus !== 'Paid') return false
    const dropoff = fields['ArrivalDate'] as string
    if (!dropoff) return true
    return dayjs(dropoff).diff(dayjs(), 'hour') > 24
  }

  const beginEdit = () => {
    if (!fields) return
    setEditArrivalDate((fields['ArrivalDate'] as string) || '')
    setEditDepartureDate((fields['Departure date'] as string) || '')
    setEditArrivalTime((fields['Arrival time'] as string) || CHECKIN_TIMES[0])
    setEditDepartureTime((fields['Departure time'] as string) || CHECKOUT_TIMES_OPEN[0])
    setEditLuggage(Number(fields['Luggage']) || 0)
    setEditBackpacks(Number(fields['Backpack / Purse (ISK 1000 pr. item)']) || 0)
    setEditLate(!!fields['Late check-out (ISK 500 pr. bag)'])
    setEditDelivery(!!fields['Delivery Service'])
    setEditFlash(null)
    setEditing(true)
  }

  // Partner bookings (e.g. Luggage Lockers) carry a Reference that selects
  // partner pricing — match the server so the preview diff is correct.
  // getStorageRates returns a stable module constant, so it's memo-safe.
  const rates = getStorageRates(fields?.['Reference'] as string | undefined)
  const editPrice = useMemo(
    () =>
      calcStoragePrice(
        {
          arrivalDate: editArrivalDate,
          departureDate: editDepartureDate,
          luggage: editLuggage,
          backpacks: editBackpacks,
          late: editLate,
          delivery: editDelivery,
        },
        rates,
      ).total,
    [editArrivalDate, editDepartureDate, editLuggage, editBackpacks, editLate, editDelivery, rates],
  )
  const oldTotal = Number(fields?.['Total Amount ISK']) || 0
  const editDiff = editPrice - oldTotal

  const submitEdit = async () => {
    if (!fields) return
    setSavingEdit(true)
    setEditFlash(null)
    try {
      const { data } = await axios.post(`/api/storage/${recordId || id}/edit`, {
        arrivalDate: editArrivalDate,
        departureDate: editDepartureDate,
        arrivalTime: editArrivalTime,
        departureTime: editDepartureTime,
        luggage: editLuggage,
        backpacks: editBackpacks,
        late: editLate,
        delivery: editDelivery,
      })
      if (data?.redirectUrl) {
        window.location.href = data.redirectUrl as string
        return
      }
      const refreshed = await axios.get(`/api/storage/${recordId || id}`)
      setFields(refreshed.data.fields)
      setEditing(false)
      setEditFlash(
        data?.refunded
          ? `Saved. ${Number(data.refunded).toLocaleString()} kr refunded to your card.`
          : 'Booking updated.',
      )
    } catch (err: any) {
      setEditFlash(err?.response?.data?.message || 'Could not update booking.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleCancel = async () => {
    const dropoff = fields?.['ArrivalDate'] as string
    const lateCancel = !!dropoff && payStatus === 'Paid' && dayjs(dropoff).diff(dayjs(), 'hour') < 24
    const confirmMsg = lateCancel
      ? 'Cancel this booking? You are within 24 hours of drop-off, so no refund will be issued.'
      : 'Cancel this booking? A full refund will be issued if payment was made.'
    if (!window.confirm(confirmMsg)) return
    setCancelling(true)
    try {
      const { data } = await axios.post(`/api/storage/${recordId || id}/cancel`)
      const newStatus = (data?.status as string) || 'Cancelled'
      setCancelRefunded(newStatus === 'Refunded' || data?.refunded === true)
      setFields((f) => ({ ...f, 'Payment Status': newStatus }))
      setCancelled(true)
    } catch {
      alert('Could not cancel. Please contact bagbee@bagbee.is.')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <Page>
        <Header hideNav />
        <PageContainer>
          <OrderSubtitle>Loading your booking…</OrderSubtitle>
        </PageContainer>
      </Page>
    )
  }

  if (error || !fields) {
    return (
      <Page>
        <NextSeo title='Booking not found — BagBee' noindex />
        <Header hideNav />
        <PageContainer>
          <OrderTitle>Booking not found</OrderTitle>
          <OrderSubtitle>{error || 'This link may be expired or incorrect.'}</OrderSubtitle>
          <PrimaryBtn onClick={() => router.push('/luggagestorage')}>Make a new booking</PrimaryBtn>
        </PageContainer>
      </Page>
    )
  }

  const arrivalDate = fields['ArrivalDate'] as string
  const departureDate = fields['Departure date'] as string
  const pickedUp = !!fields['Picked up!']
  const bookingNumber = (fields['Booking Number'] as string) || id.slice(-5).toUpperCase()
  const shortId = String(bookingNumber).toUpperCase()

  const isTerminal = payStatus === 'Cancelled' || payStatus === 'Refunded'
  const step: StorageStep = isTerminal ? 'Confirmed' : currentStep(payStatus, arrivalDate, departureDate, pickedUp)
  const stepIndex = STORAGE_STEPS.indexOf(step)
  const badgeLabel = isTerminal ? payStatus : step
  const badgeColor = STATUS_COLORS[badgeLabel] ?? '#A3A4A7'

  return (
    <Page>
      <NextSeo title={`BagBee | Storage #${shortId}`} noindex />
      <Header hideNav />
      <PageContainer>
        <OrderTitle>Storage #{shortId}</OrderTitle>
        <OrderSubtitle>BagBee Luggage Storage</OrderSubtitle>

        {!isTerminal && (
          <Section>
            <ProgressContainer>
              {STORAGE_STEPS.map((s, i) => {
                const completed = i < stepIndex
                const active = i === stepIndex
                const dotColor = STATUS_COLORS[s] ?? '#A3A4A7'
                return (
                  <ProgressStep key={s}>
                    {i < STORAGE_STEPS.length - 1 && <ProgressLine filled={completed} />}
                    <ProgressDot active={active} completed={completed} color={dotColor}>
                      {completed ? '✓' : ''}
                    </ProgressDot>
                    <ProgressLabel active={active}>{s}</ProgressLabel>
                  </ProgressStep>
                )
              })}
            </ProgressContainer>
          </Section>
        )}

        <Section>
          <SectionTitle>Client Information</SectionTitle>
          <StatusCard>
            <StatusCardHeader>
              <StatusBadge bg={badgeColor}>{badgeLabel}</StatusBadge>
              {canEdit() && !editing && (
                <EditOrderLink onClick={beginEdit}>
                  <span aria-hidden>&#9998;</span> Edit booking
                </EditOrderLink>
              )}
            </StatusCardHeader>

            {cancelled && (
              <Notice kind='info'>
                {cancelRefunded
                  ? 'Your booking has been cancelled. A refund has been issued and should appear within 5–10 business days.'
                  : 'Your booking has been cancelled. As it was within 24 hours of drop-off, no refund was issued.'}
              </Notice>
            )}
            {editFlash && <Notice kind='info'>{editFlash}</Notice>}
            {!canEdit() && !isTerminal && !editing && (
              <Notice kind='warn'>
                Edits are accepted up to 24 hours before drop-off. For help, email{' '}
                <a href='mailto:bagbee@bagbee.is'>bagbee@bagbee.is</a>.
              </Notice>
            )}

            {!editing && (
              <>
                <DetailGrid>
                  {fields['Name'] && (
                    <DetailRow>
                      <DetailLabel>Customer</DetailLabel>
                      <DetailValue>{fmt(fields['Name'])}</DetailValue>
                    </DetailRow>
                  )}
                  {fields['Email'] && (
                    <DetailRow>
                      <DetailLabel>Email</DetailLabel>
                      <DetailValue>{fmt(fields['Email'])}</DetailValue>
                    </DetailRow>
                  )}
                  {fields['PhoneNumber'] && (
                    <DetailRow>
                      <DetailLabel>Phone</DetailLabel>
                      <DetailValue>{fmt(fields['PhoneNumber'])}</DetailValue>
                    </DetailRow>
                  )}
                  <DetailRow>
                    <DetailLabel>Bags</DetailLabel>
                    <DetailValue>
                      {(() => {
                        const lug = Number(fields['Luggage']) || 0
                        const bk = Number(fields['Backpack / Purse (ISK 1000 pr. item)']) || 0
                        const parts: string[] = []
                        if (lug) parts.push(`${lug} luggage`)
                        if (bk) parts.push(`${bk} backpack${bk === 1 ? '' : 's'}`)
                        return parts.length ? parts.join(' · ') : '—'
                      })()}
                    </DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>Storage type</DetailLabel>
                    <DetailValue>{fmt(fields['Type of storage'])}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>Total paid</DetailLabel>
                    <DetailValue>{fmtIsk(fields['Total Amount ISK'])}</DetailValue>
                  </DetailRow>
                </DetailGrid>

                {canCancel() && !cancelled && (
                  <CancelOrderRow>
                    <CancelOrderLink onClick={handleCancel} disabled={cancelling}>
                      {cancelling ? 'Cancelling…' : 'Cancel booking'}
                    </CancelOrderLink>
                  </CancelOrderRow>
                )}
              </>
            )}

            {editing && (
              <>
                <div style={{ marginTop: 16 }}>
                  <InputLabel>Dates</InputLabel>
                  <TransportCalendar
                    pickupDate={editArrivalDate || null}
                    deliveryDate={editDepartureDate || null}
                    onChange={(a, d) => {
                      setEditArrivalDate(a || '')
                      setEditDepartureDate(d || '')
                    }}
                    locale='en'
                    disabledDates={closedDates}
                  />
                </div>

                <EditFormGrid>
                  <div>
                    <InputLabel>Check-in time</InputLabel>
                    <Select
                      value={editArrivalTime}
                      onChange={(e) => setEditArrivalTime(e.target.value)}
                    >
                      {CHECKIN_TIMES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <InputLabel>Check-out time</InputLabel>
                    <Select
                      value={editDepartureTime}
                      onChange={(e) => setEditDepartureTime(e.target.value)}
                    >
                      {(editLate ? CHECKOUT_TIMES_LATE : CHECKOUT_TIMES_OPEN).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <InputLabel>Luggage items (1,500 kr / day)</InputLabel>
                    <Stepper>
                      <StepBtn
                        onClick={() => setEditLuggage((n) => Math.max(0, n - 1))}
                        disabled={editLuggage <= 0}
                      >−</StepBtn>
                      <StepCount>{editLuggage}</StepCount>
                      <StepBtn onClick={() => setEditLuggage((n) => Math.min(20, n + 1))}>+</StepBtn>
                    </Stepper>
                  </div>
                  <div>
                    <InputLabel>Backpacks / purses (1,000 kr each)</InputLabel>
                    <Stepper>
                      <StepBtn
                        onClick={() => setEditBackpacks((n) => Math.max(0, n - 1))}
                        disabled={editBackpacks <= 0}
                      >−</StepBtn>
                      <StepCount>{editBackpacks}</StepCount>
                      <StepBtn onClick={() => setEditBackpacks((n) => Math.min(20, n + 1))}>+</StepBtn>
                    </Stepper>
                  </div>
                </EditFormGrid>

                {/* Amounts are intentionally hidden unless the change costs more
                    — only the extra charge is surfaced (shown at the pay step). */}
                {editDiff > 0 && (
                  <PriceDiff kind='up'>
                    You'll pay an extra <strong>{editDiff.toLocaleString()} kr</strong> now
                  </PriceDiff>
                )}

                <ActionRow>
                  <PrimaryBtn onClick={submitEdit} disabled={savingEdit}>
                    {savingEdit
                      ? 'Saving…'
                      : editDiff > 0
                      ? `Pay ${editDiff.toLocaleString()} kr & save`
                      : 'Save changes'}
                  </PrimaryBtn>
                  <SecondaryBtn onClick={() => setEditing(false)} disabled={savingEdit}>
                    Cancel
                  </SecondaryBtn>
                </ActionRow>
              </>
            )}
          </StatusCard>
        </Section>

        <Section>
          <SectionTitle>Drop-off</SectionTitle>
          <StatusCard>
            <DetailGrid>
              <DetailRow>
                <DetailLabel>Drop-off date</DetailLabel>
                <DetailValue>{fmtDate(arrivalDate)}</DetailValue>
              </DetailRow>
              <DetailRow>
                <DetailLabel>Check-in time</DetailLabel>
                <DetailValue>{fmt(fields['Arrival time'])}</DetailValue>
              </DetailRow>
              <DetailRow>
                <DetailLabel>Location</DetailLabel>
                <DetailValue>BSÍ Bus Terminal, Reykjavík</DetailValue>
              </DetailRow>
            </DetailGrid>
          </StatusCard>
        </Section>

        <Section>
          <SectionTitle>Pick-up</SectionTitle>
          <StatusCard>
            <DetailGrid>
              <DetailRow>
                <DetailLabel>Pick-up date</DetailLabel>
                <DetailValue>{fmtDate(departureDate)}</DetailValue>
              </DetailRow>
              <DetailRow>
                <DetailLabel>Check-out time</DetailLabel>
                <DetailValue>{fmt(fields['Departure time'])}</DetailValue>
              </DetailRow>
              {fields['Delivery Service'] ? (
                <>
                  <DetailRow>
                    <DetailLabel>Delivery method</DetailLabel>
                    <DetailValue>Hotel delivery</DetailValue>
                  </DetailRow>
                  {fields['Hotel or Cruise ship name'] && (
                    <DetailRow>
                      <DetailLabel>Hotel / ship</DetailLabel>
                      <DetailValue>{fmt(fields['Hotel or Cruise ship name'])}</DetailValue>
                    </DetailRow>
                  )}
                  {fields['Delivery Address'] && (
                    <DetailRow>
                      <DetailLabel>Address</DetailLabel>
                      <DetailValue>{fmt(fields['Delivery Address'])}</DetailValue>
                    </DetailRow>
                  )}
                </>
              ) : (
                <DetailRow>
                  <DetailLabel>Location</DetailLabel>
                  <DetailValue>BSÍ Bus Terminal, Reykjavík</DetailValue>
                </DetailRow>
              )}
            </DetailGrid>
          </StatusCard>
        </Section>
      </PageContainer>
    </Page>
  )
}
