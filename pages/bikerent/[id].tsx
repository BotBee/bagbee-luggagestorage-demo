// @ts-nocheck — Emotion styled children type quirk with TS strict mode
//
// Customer self-service page for a BikeRent booking: change boxes/dates (charged
// or refunded automatically) or cancel (full refund). Landing page after
// payment. Mirrors /pages/storage/[id].tsx for the BSI BikeRent table.
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { NextSeo } from 'next-seo'
import styled from '@emotion/styled'
import axios from 'axios'
import TransportCalendar from '../../components/transport/TransportCalendar'
import { calcBikerentPrice } from '../../utils/bikerentPricing'

// BSÍ manned opening hours only — 06:45 to 17:00.
const TIMES = (() => {
  const out: string[] = []
  let h = 6
  let m = 45
  while (h < 17 || (h === 17 && m === 0)) {
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
})()

// After-hours drop-off window — 17:15 to 22:00 (+10,000 ISK surcharge).
const AFTER_TIMES = (() => {
  const out: string[] = []
  let h = 17
  let m = 15
  while (h < 22 || (h === 22 && m === 0)) {
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
})()
// Drop-off can be normal or after-hours; pick-up stays within normal hours.
const DROPOFF_TIMES = [...TIMES, ...AFTER_TIMES]
const AFTER_SET = new Set(AFTER_TIMES)

const parseTimeToMinutes = (t?: string): number | null => {
  if (!t) return null
  const ampm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim())
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = parseInt(ampm[2], 10)
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0
    return h * 60 + m
  }
  const h24 = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (h24) return parseInt(h24[1], 10) * 60 + parseInt(h24[2], 10)
  return null
}

const hoursUntilDropoff = (date?: string, time?: string): number | null => {
  if (!date) return null
  const ms = new Date(date).getTime()
  if (isNaN(ms)) return null
  const mins = parseTimeToMinutes(time) ?? 0
  return (ms + mins * 60_000 - Date.now()) / 3_600_000
}

const STATUS_COLORS: Record<string, string> = {
  Paid: '#1d8a4e',
  Pending: '#b7791f',
  Refunded: '#6b7280',
  Cancelled: '#b91c1c',
}

/* ── styled ──────────────────────────────────────────────── */
const Page = styled.div`
  min-height: 100vh;
  background: #f7f8fa;
  font-family: 'Poppins', sans-serif;
  padding: 24px 16px 64px;
`
const Card = styled.div`
  max-width: 560px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #e6e9ee;
  border-radius: 14px;
  padding: 24px 22px;
  display: grid;
  gap: 16px;
`
const HeadRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`
const Title = styled.h1`
  font-size: 20px;
  font-weight: 700;
  color: #0b0f1a;
  margin: 0;
`
const Badge = styled.span<{ $c: string }>`
  font-size: 12px;
  font-weight: 700;
  color: ${({ $c }) => $c};
  border: 1px solid ${({ $c }) => $c}33;
  background: ${({ $c }) => $c}11;
  padding: 4px 10px;
  border-radius: 999px;
`
const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  padding: 9px 0;
  border-bottom: 1px solid #f0f0f0;
`
const Label = styled.span`
  color: #6b7280;
`
const Value = styled.span`
  color: #12141d;
  font-weight: 500;
  text-align: right;
`
const SectionTitle = styled.h2`
  font-size: 15px;
  font-weight: 600;
  margin: 8px 0 0;
`
const FieldGrid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr 1fr;
`
const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: #4a5260;
`
const SelectEl = styled.select`
  height: 42px;
  border: 1px solid #c8cdd6;
  border-radius: 8px;
  font-size: 14px;
  padding: 0 12px;
  background: #fff;
`
const Stepper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 6px 14px;
  border: 1px solid #e6e9ee;
  border-radius: 10px;
  background: #fbfbfd;
  width: fit-content;
`
const StepBtn = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1.5px solid #f3ad3c;
  background: #fff;
  color: #f3ad3c;
  font-size: 17px;
  cursor: pointer;
`
const StepVal = styled.span`
  font-weight: 700;
  font-size: 18px;
  min-width: 22px;
  text-align: center;
`
const DiffNote = styled.div<{ $up: boolean }>`
  font-size: 14px;
  font-weight: 600;
  color: ${({ $up }) => ($up ? '#b7791f' : '#1d8a4e')};
  background: ${({ $up }) => ($up ? '#fff8ec' : '#ecfdf3')};
  border: 1px solid ${({ $up }) => ($up ? '#f4d199' : '#a7e8c4')};
  padding: 10px 12px;
  border-radius: 8px;
`
const BtnRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`
const Btn = styled.button`
  flex: 1;
  min-width: 130px;
  height: 46px;
  border-radius: 10px;
  border: none;
  background: #1d3c34;
  color: #fff;
  font-family: inherit;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: default; }
`
const BtnGhost = styled(Btn)`
  background: #fff;
  color: #b91c1c;
  border: 1.5px solid #f1c4c4;
`
const Flash = styled.div`
  font-size: 13px;
  color: #1d3c34;
  background: #ecfdf3;
  border: 1px solid #a7e8c4;
  padding: 10px 12px;
  border-radius: 8px;
`
const Muted = styled.p`
  font-size: 12px;
  color: #9aa3b2;
  margin: 0;
  text-align: center;
`

const fmtIsk = (n?: any) => {
  const v = Number(n)
  return isNaN(v) ? '—' : `${v.toLocaleString()} kr`
}

const BikerentManage = () => {
  const router = useRouter()
  const { id } = router.query as { id?: string }

  const [fields, setFields] = useState<Record<string, any> | null>(null)
  // Resolved Airtable record id (the URL may be the short Booking Number).
  const [recordId, setRecordId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const [eHard, setEHard] = useState(0)
  const [eFolded, setEFolded] = useState(0)
  const [eDropoffDate, setEDropoffDate] = useState('')
  const [ePickupDate, setEPickupDate] = useState('')
  const [eDropoffTime, setEDropoffTime] = useState('')
  const [ePickupTime, setEPickupTime] = useState('')
  const [closedDates, setClosedDates] = useState<string[]>([])

  useEffect(() => {
    axios
      .get('/api/booking/closed-dates?source=bikerent')
      .then(({ data }) => setClosedDates(data?.dates || []))
      .catch(() => setClosedDates([]))
  }, [])

  useEffect(() => {
    if (!router.isReady || !id) return
    axios
      .get(`/api/bikerent/${id}`)
      .then((r) => { setFields(r.data.fields); setRecordId(r.data.id) })
      .catch(() => setError('We could not find that booking.'))
      .finally(() => setLoading(false))
  }, [router.isReady, id])

  const status = (fields?.['Payment Status'] as string) || 'Pending'
  const dropoffDate = fields?.['ArrivalDate'] as string
  const dropoffTime = fields?.['Arrival time'] as string
  const hoursUntil = useMemo(() => hoursUntilDropoff(dropoffDate, dropoffTime), [dropoffDate, dropoffTime])
  const withinCutoff = hoursUntil !== null && hoursUntil < 24
  const canEdit = status === 'Paid' && !withinCutoff
  const canCancel = (status === 'Paid' || status === 'Pending') && !withinCutoff

  const beginEdit = () => {
    if (!fields) return
    setEHard(Number(fields['Luggage']) || 0)
    setEFolded(Number(fields['Backpack / Purse (ISK 1000 pr. item)']) || 0)
    setEDropoffDate((fields['ArrivalDate'] as string) || '')
    setEPickupDate((fields['Departure date'] as string) || '')
    setEDropoffTime((fields['Arrival time'] as string) || TIMES[0])
    setEPickupTime((fields['Departure time'] as string) || TIMES[0])
    setFlash(null)
    setEditing(true)
  }

  const editPrice = useMemo(
    () =>
      calcBikerentPrice({
        dropoffDate: eDropoffDate,
        pickupDate: ePickupDate,
        hardBoxes: eHard,
        foldedBoxes: eFolded,
        dropoffTime: eDropoffTime,
      }).total,
    [eDropoffDate, ePickupDate, eHard, eFolded, eDropoffTime],
  )
  const oldTotal = Number(fields?.['Total Amount ISK']) || 0
  const diff = editPrice - oldTotal

  const submitEdit = async () => {
    if (!fields) return
    setSavingEdit(true)
    setFlash(null)
    try {
      const { data } = await axios.post(`/api/bikerent/${recordId || id}/edit`, {
        hardBoxes: eHard,
        foldedBoxes: eFolded,
        dropoffDate: eDropoffDate,
        pickupDate: ePickupDate,
        dropoffTime: eDropoffTime,
        pickupTime: ePickupTime,
      })
      if (data?.redirectUrl) {
        window.location.href = data.redirectUrl as string
        return
      }
      const refreshed = await axios.get(`/api/bikerent/${recordId || id}`)
      setFields(refreshed.data.fields)
      setEditing(false)
      setFlash(
        data?.refunded
          ? `Saved. ${Number(data.refunded).toLocaleString()} kr refunded to your card.`
          : 'Booking updated.',
      )
    } catch (err: any) {
      setFlash(err?.response?.data?.message || 'Could not update booking.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleCancel = async () => {
    const lateCancel = hoursUntil !== null && hoursUntil < 24
    const confirmMsg = lateCancel
      ? 'Cancel this booking? You are within 24 hours of drop-off, so no refund will be issued.'
      : 'Cancel this booking? A full refund will be issued if you have paid.'
    if (!window.confirm(confirmMsg)) return
    setCancelling(true)
    setFlash(null)
    try {
      const { data } = await axios.post(`/api/bikerent/${recordId || id}/cancel`)
      const refreshed = await axios.get(`/api/bikerent/${recordId || id}`)
      setFields(refreshed.data.fields)
      setFlash(
        data?.status === 'Refunded'
          ? 'Booking cancelled and refunded.'
          : data?.lateCancel
          ? 'Booking cancelled. No refund was issued (within 24 hours of drop-off).'
          : 'Booking cancelled.',
      )
    } catch (err: any) {
      setFlash(err?.response?.data?.message || 'Could not cancel booking.')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <Page>
        <NextSeo title='Your booking — BagBee' noindex />
        <Card><Title>Loading…</Title></Card>
      </Page>
    )
  }
  if (error || !fields) {
    return (
      <Page>
        <NextSeo title='Booking not found — BagBee' noindex />
        <Card>
          <Title>Booking not found</Title>
          <Muted>{error || 'Please check your link or contact bagbee@bagbee.is.'}</Muted>
        </Card>
      </Page>
    )
  }

  const ref = (fields['Booking Number'] as string) || (id || '').slice(-5).toUpperCase()

  return (
    <Page>
      <NextSeo title='Your bike-box storage — BagBee' noindex />
      <Card>
        <HeadRow>
          <Title>Bike-box storage · #{ref}</Title>
          <Badge $c={STATUS_COLORS[status] || '#6b7280'}>{status}</Badge>
        </HeadRow>

        {flash && <Flash>{flash}</Flash>}

        {!editing && (
          <>
            <div>
              <Row><Label>Name</Label><Value>{fields['Name'] || '—'}</Value></Row>
              <Row><Label>Drop-off</Label><Value>{fields['ArrivalDate'] || '—'} {fields['Arrival time'] || ''}</Value></Row>
              <Row><Label>Pick-up</Label><Value>{fields['Departure date'] || '—'} {fields['Departure time'] || ''}</Value></Row>
              <Row><Label>Bike boxes / bags</Label><Value>{Number(fields['Luggage']) || 0}</Value></Row>
              <Row><Label>Folded boxes</Label><Value>{Number(fields['Backpack / Purse (ISK 1000 pr. item)']) || 0}</Value></Row>
              <Row><Label>Total paid</Label><Value>{fmtIsk(fields['Total Amount ISK'])}</Value></Row>
            </div>

            {(status === 'Paid' || status === 'Pending') ? (
              <>
                <BtnRow>
                  <Btn onClick={beginEdit} disabled={!canEdit}>Change booking</Btn>
                  <BtnGhost onClick={handleCancel} disabled={!canCancel || cancelling}>
                    {cancelling ? 'Cancelling…' : 'Cancel booking'}
                  </BtnGhost>
                </BtnRow>
                {withinCutoff && (
                  <Muted>Changes and cancellation close 24 hours before drop-off. Contact bagbee@bagbee.is for help.</Muted>
                )}
              </>
            ) : (
              <Muted>This booking is {status.toLowerCase()}. Contact bagbee@bagbee.is if you need help.</Muted>
            )}
          </>
        )}

        {editing && (
          <>
            <SectionTitle>Boxes</SectionTitle>
            <FieldGrid>
              <Field>
                Bike boxes / bags
                <Stepper>
                  <StepBtn type='button' onClick={() => setEHard(Math.max(0, eHard - 1))}>−</StepBtn>
                  <StepVal>{eHard}</StepVal>
                  <StepBtn type='button' onClick={() => setEHard(Math.min(20, eHard + 1))}>+</StepBtn>
                </Stepper>
              </Field>
              <Field>
                Folded boxes
                <Stepper>
                  <StepBtn type='button' onClick={() => setEFolded(Math.max(0, eFolded - 1))}>−</StepBtn>
                  <StepVal>{eFolded}</StepVal>
                  <StepBtn type='button' onClick={() => setEFolded(Math.min(20, eFolded + 1))}>+</StepBtn>
                </Stepper>
              </Field>
            </FieldGrid>

            <SectionTitle>Dates</SectionTitle>
            <TransportCalendar
              pickupDate={eDropoffDate || null}
              deliveryDate={ePickupDate || null}
              onChange={(d, p) => {
                setEDropoffDate(d || '')
                setEPickupDate(p || '')
              }}
              locale='en'
              disabledDates={closedDates}
            />
            <FieldGrid>
              <Field>
                Drop-off time
                <SelectEl value={eDropoffTime} onChange={(e) => setEDropoffTime(e.target.value)}>
                  {DROPOFF_TIMES.map((t) => (
                    <option key={t} value={t}>
                      {AFTER_SET.has(t) ? `${t} (after-hours +10,000 ISK)` : t}
                    </option>
                  ))}
                </SelectEl>
              </Field>
              <Field>
                Pick-up time
                <SelectEl value={ePickupTime} onChange={(e) => setEPickupTime(e.target.value)}>
                  {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </SelectEl>
              </Field>
            </FieldGrid>

            {diff > 0 && (
              <DiffNote $up={true}>
                {`You'll pay an extra ${diff.toLocaleString()} kr — you'll be sent to secure payment.`}
              </DiffNote>
            )}

            <BtnRow>
              <Btn onClick={submitEdit} disabled={savingEdit}>
                {savingEdit ? 'Saving…' : diff > 0 ? 'Pay & save' : 'Save changes'}
              </Btn>
              <BtnGhost onClick={() => setEditing(false)} disabled={savingEdit}>Back</BtnGhost>
            </BtnRow>
          </>
        )}
      </Card>
    </Page>
  )
}

export default BikerentManage
