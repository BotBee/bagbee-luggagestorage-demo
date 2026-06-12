// @ts-nocheck — Emotion styled children type quirk with TS strict mode
/**
 * KEF bike-box booking manage page. Customer can change dates/windows/return
 * location (price top-up or refund, PIN re-synced) or cancel (refund per the
 * 24h policy). Amounts are hidden except the extra charge when a change costs
 * more (shown at the pay step).
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { NextSeo } from 'next-seo'
import styled from '@emotion/styled'
import axios from 'axios'
import Logo from '../../public/icons/Logo'
import TransportCalendar from '../../components/transport/TransportCalendar'
import { calcKefPrice } from '../../utils/kefPricing'

const timeOptions = (s, e) => {
  const out = []
  for (let h = s; h <= e; h++) for (const m of [0, 30]) { if (h === e && m > 0) break; out.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`) }
  return out
}
const TIMES = timeOptions(5, 23)
const WINDOW_HOURS = [3, 4, 5, 6, 7, 8]

// Reykjavik == UTC: split an ISO datetime into date + HH:MM.
const splitIso = (iso) => {
  if (!iso) return { date: '', time: '' }
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso)
  return m ? { date: m[1], time: m[2] } : { date: '', time: '' }
}
const hoursOf = (startIso, endIso) => {
  const s = Date.parse(startIso), e = Date.parse(endIso)
  if (isNaN(s) || isNaN(e) || e <= s) return 3
  return Math.max(3, Math.round((e - s) / 3600000))
}

const Page = styled.div`min-height: 100vh; background: #f4f6f9; font-family: 'Poppins', sans-serif; color: #12141d;`
const Bar = styled.header`padding: 18px 24px;`
const Wrap = styled.div`max-width: 540px; margin: 0 auto; padding: 8px 18px 48px;`
const Card = styled.div`background: #fff; border: 1px solid #e6e9ef; border-radius: 18px; padding: 22px 22px; box-shadow: 0 14px 50px -28px rgba(18,20,29,0.25);`
const Title = styled.h1`font-size: 20px; font-weight: 700; margin: 0 0 4px;`
const Badge = styled.span`display: inline-block; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; background: ${(p)=>p.$ok?'#d8f3e1':'#fff1d6'}; color: ${(p)=>p.$ok?'#16653a':'#7a5400'}; margin-bottom: 14px;`
const Row = styled.div`display: flex; justify-content: space-between; font-size: 14px; padding: 7px 0; border-bottom: 1px solid #f0f0f0;`
const Label = styled.span`color: #6b7280;`
const Value = styled.span`color: #12141d; font-weight: 600; text-align: right;`
const SectionTitle = styled.h2`font-size: 13px; font-weight: 700; margin: 18px 0 8px;`
const FieldGrid = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 10px;`
const Field = styled.label`display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: #424857;`
const SelectEl = styled.select`border: 1px solid #c8cdd6; border-radius: 8px; font-size: 14px; padding: 9px 10px; background: #fff;`
const ToggleRow = styled.div`display: flex; gap: 8px; margin-top: 4px;`
const RetBtn = styled.button`flex: 1; padding: 10px; border-radius: 9px; border: 1.5px solid ${(p)=>p.$on?'#1d3c34':'#c8cdd6'}; background: ${(p)=>p.$on?'#eaf3ef':'#fff'}; font-size: 12px; font-weight: 600; cursor: pointer;`
const Btn = styled.button`padding: 12px 18px; border-radius: 11px; border: none; background: #1d3c34; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; &:disabled { opacity: 0.5; }`
const Ghost = styled.button`padding: 12px 18px; border-radius: 11px; border: 1.5px solid #c8cdd6; background: #fff; font-size: 14px; font-weight: 600; cursor: pointer; &:disabled { opacity: 0.5; }`
const BtnRow = styled.div`display: flex; gap: 10px; margin-top: 16px;`
const Note = styled.div`font-size: 13px; color: #6b7280; margin-top: 12px;`
const Diff = styled.div`background: #eef3f8; border: 1px solid #cdd9e5; border-radius: 9px; padding: 10px 12px; font-size: 13px; color: #1f3a5f; margin-top: 12px;`
const Flash = styled.div`background: #eaf3ef; border: 1px solid #bfe0cd; border-radius: 9px; padding: 10px 12px; font-size: 13px; color: #16653a; margin-bottom: 12px;`
const PinBox = styled.div`background: #f7f8fb; border: 1px solid #e6e9ef; border-radius: 11px; padding: 12px 14px; margin-top: 8px;`
const PinBoxLabel = styled.div`font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;`
const PinRow = styled.div`display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #424857; padding: 4px 0;`
const PinCode = styled.span`font-family: monospace; font-size: 18px; font-weight: 700; letter-spacing: 2px; color: #000929; background: #fff; border: 1px solid #cdd9e5; border-radius: 7px; padding: 4px 10px;`

export default function KefManage() {
  const router = useRouter()
  const { id } = router.query
  const [booking, setBooking] = useState(null)
  const [recordId, setRecordId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [flash, setFlash] = useState(null)

  const [eDrop, setEDrop] = useState('')
  const [ePick, setEPick] = useState('')
  const [eDropTime, setEDropTime] = useState('')
  const [eDropHours, setEDropHours] = useState(3)
  const [eReturn, setEReturn] = useState('kef')
  const [ePickTime, setEPickTime] = useState('')
  const [ePickHours, setEPickHours] = useState(3)

  const load = () => {
    if (!router.isReady || !id) return
    axios.get(`/api/kef/${id}`).then((r) => { setBooking(r.data); setRecordId(r.data.recordId) })
      .catch(() => setError('We could not find that booking.')).finally(() => setLoading(false))
  }
  useEffect(load, [router.isReady, id])

  const status = booking?.paymentStatus || 'Pending'
  const dropMs = booking ? Date.parse(booking.checkInDatetime || '') : NaN
  const hoursUntil = isNaN(dropMs) ? null : (dropMs - Date.now()) / 3600000
  const withinCutoff = hoursUntil !== null && hoursUntil < 24
  const canEdit = status === 'Paid' && !withinCutoff
  const canCancel = status === 'Paid' || status === 'Pending'

  const beginEdit = () => {
    if (!booking) return
    const di = splitIso(booking.checkInDatetime)
    const pi = splitIso(booking.checkOutDatetime)
    setEDrop(di.date); setEDropTime(di.time)
    setEDropHours(hoursOf(booking.checkInDatetime, booking.checkInWindowEnd))
    setEReturn(booking.returnLocation === 'BSÍ terminal' ? 'bsi' : 'kef')
    setEPick(pi.date || di.date)
    setEPickTime(pi.time || '')
    setEPickHours(hoursOf(booking.checkOutDatetime, booking.checkOutWindowEnd))
    setFlash(null); setEditing(true)
  }

  const editTotal = useMemo(() => {
    if (!booking) return 0
    return calcKefPrice({
      boxes: booking.boxes || 1,
      dropoffDate: eDrop, pickupDate: ePick,
      returnLocation: eReturn === 'bsi' ? 'bsi' : 'kef',
      dropoffWindowHours: eDropHours, pickupWindowHours: ePickHours,
    }).total
  }, [booking, eDrop, ePick, eReturn, eDropHours, ePickHours])
  const diff = booking ? editTotal - (booking.total || 0) : 0

  const submitEdit = async () => {
    setSaving(true); setFlash(null)
    try {
      const { data } = await axios.post(`/api/kef/${recordId || id}/edit`, {
        dropoffDate: eDrop, dropoffTime: eDropTime, dropoffHours: eDropHours,
        returnLocation: eReturn, pickupDate: ePick, pickupTime: ePickTime, pickupHours: ePickHours,
      })
      if (data.redirectUrl) { window.location.href = data.redirectUrl; return }
      setEditing(false); load(); setFlash('Booking updated.')
    } catch (err) { setFlash(err?.response?.data?.message || 'Could not update booking.') }
    finally { setSaving(false) }
  }

  const handleCancel = async () => {
    const late = hoursUntil !== null && hoursUntil < 24 && status === 'Paid'
    const msg = late
      ? 'Cancel this booking? You are within 24 hours of drop-off, so no refund will be issued.'
      : 'Cancel this booking? A full refund will be issued if you have paid.'
    if (!window.confirm(msg)) return
    setCancelling(true); setFlash(null)
    try {
      const { data } = await axios.post(`/api/kef/${recordId || id}/cancel`)
      load()
      setFlash(data.status === 'Refunded' ? 'Booking cancelled and refunded.'
        : data.lateCancel ? 'Booking cancelled. No refund (within 24h of drop-off).'
        : 'Booking cancelled.')
    } catch (err) { setFlash(err?.response?.data?.message || 'Could not cancel booking.') }
    finally { setCancelling(false) }
  }

  if (loading) return <Page><Bar><Link href='/'><Logo /></Link></Bar><Wrap><Card>Loading…</Card></Wrap></Page>
  if (error || !booking) return <Page><Bar><Link href='/'><Logo /></Link></Bar><Wrap><Card>{error || 'Not found'}</Card></Wrap></Page>

  const di = splitIso(booking.checkInDatetime)
  const po = splitIso(booking.checkOutDatetime)

  return (
    <Page>
      <NextSeo title='Your bike-box booking — BagBee' noindex />
      <Bar><Link href='/' aria-label='BagBee home'><Logo /></Link></Bar>
      <Wrap>
        <Card>
          <Title>Bike-box locker #{booking.bookingNumber}</Title>
          <Badge $ok={status === 'Paid'}>{status}</Badge>
          {flash && <Flash>{flash}</Flash>}

          {!editing && (
            <>
              <Row><Label>Bike boxes</Label><Value>{booking.boxes}</Value></Row>
              <Row><Label>Drop-off at KEF</Label><Value>{di.date} {di.time}</Value></Row>
              <Row><Label>Return</Label><Value>{booking.returnLocation}{po.time ? ` · ${po.date} ${po.time}` : ''}</Value></Row>
              <Row><Label>Total paid</Label><Value>{(booking.total||0).toLocaleString()} ISK</Value></Row>

              {status === 'Paid' && (
                <>
                  <SectionTitle>Locker access</SectionTitle>
                  {(booking.lockers || []).some((l) => l.pinIn || l.pinOut) ? (
                    (booking.lockers || []).map((l, i) => (
                      <PinBox key={i}>
                        {booking.boxes > 1 && <PinBoxLabel>Box {i + 1}</PinBoxLabel>}
                        {l.pinIn && (
                          <PinRow><span>Drop-off{l.lockerNameIn ? ` · ${l.lockerNameIn}` : ''}</span><PinCode>{l.pinIn}</PinCode></PinRow>
                        )}
                        {l.pinOut && (
                          <PinRow><span>Pick-up{l.lockerNameOut ? ` · ${l.lockerNameOut}` : ''}</span><PinCode>{l.pinOut}</PinCode></PinRow>
                        )}
                      </PinBox>
                    ))
                  ) : (
                    <Note>Your locker number and PIN code will appear here — and arrive by email — a few hours before your drop-off window.</Note>
                  )}
                </>
              )}

              {canEdit && (
                <BtnRow>
                  <Btn onClick={beginEdit}>Change booking</Btn>
                  <Ghost onClick={handleCancel} disabled={cancelling || !canCancel}>{cancelling ? 'Cancelling…' : 'Cancel booking'}</Ghost>
                </BtnRow>
              )}
              {!canEdit && canCancel && (
                <BtnRow>
                  <Ghost onClick={handleCancel} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel booking'}</Ghost>
                </BtnRow>
              )}
              {withinCutoff && status === 'Paid' && (
                <Note>Changes close 24 hours before drop-off. Contact bagbee@bagbee.is for help.</Note>
              )}
            </>
          )}

          {editing && (
            <>
              <SectionTitle>Dates</SectionTitle>
              <TransportCalendar pickupDate={eDrop || null} deliveryDate={ePick || null}
                onChange={(d, p) => { setEDrop(d || ''); setEPick(p || '') }} locale='en' />
              <SectionTitle>Drop-off at KEF</SectionTitle>
              <FieldGrid>
                <Field>Drop-off time<SelectEl value={eDropTime} onChange={(e)=>setEDropTime(e.target.value)}>{TIMES.map(t=><option key={t} value={t}>{t}</option>)}</SelectEl></Field>
                <Field>Locker window<SelectEl value={eDropHours} onChange={(e)=>setEDropHours(Number(e.target.value))}>{WINDOW_HOURS.map(h=><option key={h} value={h}>{h} h</option>)}</SelectEl></Field>
              </FieldGrid>
              <SectionTitle>Return</SectionTitle>
              <ToggleRow>
                <RetBtn $on={eReturn==='kef'} onClick={()=>setEReturn('kef')}>KEF airport (+10,000/box)</RetBtn>
                <RetBtn $on={eReturn==='bsi'} onClick={()=>setEReturn('bsi')}>BSÍ terminal (no fee)</RetBtn>
              </ToggleRow>
              {eReturn === 'kef' && (
                <FieldGrid style={{ marginTop: 10 }}>
                  <Field>Pick-up time<SelectEl value={ePickTime} onChange={(e)=>setEPickTime(e.target.value)}>{['',...TIMES].map(t=><option key={t} value={t}>{t||'Select'}</option>)}</SelectEl></Field>
                  <Field>Locker window<SelectEl value={ePickHours} onChange={(e)=>setEPickHours(Number(e.target.value))}>{WINDOW_HOURS.map(h=><option key={h} value={h}>{h} h</option>)}</SelectEl></Field>
                </FieldGrid>
              )}
              {diff > 0 && <Diff>You&apos;ll pay an extra <strong>{diff.toLocaleString()} ISK</strong> — you&apos;ll be sent to secure payment.</Diff>}
              <BtnRow>
                <Btn onClick={submitEdit} disabled={saving}>{saving ? 'Saving…' : diff > 0 ? 'Pay & save' : 'Save changes'}</Btn>
                <Ghost onClick={()=>setEditing(false)} disabled={saving}>Back</Ghost>
              </BtnRow>
            </>
          )}
        </Card>
      </Wrap>
    </Page>
  )
}
