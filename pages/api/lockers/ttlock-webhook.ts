/**
 * TTLock unlock-event webhook receiver.
 *
 * TTLock POSTs unlock records to this URL when a PIN is entered on one of
 * our locks. We:
 *   1. Append the event to the Access Events table (always — even if we
 *      can't match a booking, the audit trail is useful for debugging).
 *   2. If the unlock matches a booking's drop-off PIN → flip
 *      "Drop-off opened at" on that booking.
 *   3. Same for pickup PIN → "Pickup opened at".
 *
 * TTLock's webhook payload field names are loose in their docs; we read
 * defensively and treat anything we don't recognise as "other".
 *
 * No request signature available from TTLock today — we authenticate via
 * lookup: if the (lockId, PIN) pair doesn't match any booking we trust, we
 * still log it but don't mutate any booking. That's good enough for the
 * threat model (small denial-of-log-noise attack possible but no real
 * damage).
 *
 * Always return 200 so TTLock doesn't retry forever on transient errors.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  FLD,
  appendAccessEvent,
  loadActiveBookings,
  loadLockers,
  updateBooking,
} from '../../../utils/kefLockersAirtable'

// TTLock recordType codes we recognise. From their lock-record reference:
//   1  = unlock via app
//   4  = unlock via PIN (success)
//   7  = unlock via PIN (success, alternate)
//   11 = wrong PIN attempt
//   12 = lock (closed)
//
// In practice TTLock uses 4 or 7 for PIN unlock events depending on lock
// firmware. We treat both as door_unlocked.
const RECORD_TYPE_TO_EVENT: Record<number, string> = {
  1: 'door_unlocked',
  4: 'door_unlocked',
  7: 'door_unlocked',
  11: 'wrong_code',
  12: 'door_locked',
}

interface NormalizedEvent {
  lockId: number | null
  recordType: number | null
  keyboardPwd: string | null
  lockDate: number | null // epoch ms
  success: boolean
}

function normalize(body: any): NormalizedEvent {
  const b = body ?? {}
  return {
    lockId: numericOrNull(b.lockId),
    recordType: numericOrNull(b.recordType),
    keyboardPwd: stringOrNull(b.keyboardPwd),
    lockDate: numericOrNull(b.lockDate),
    success: b.success === 1 || b.success === '1',
  }
}

function numericOrNull(v: any): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function stringOrNull(v: any): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const body = req.body
  console.log('[lockers/ttlock-webhook] received', {
    method: req.method,
    query: req.query,
    body,
  })

  // Always 200 even on parsing errors — TTLock retries are not helpful.
  try {
    await processEvent(req, body)
  } catch (err) {
    console.error('[lockers/ttlock-webhook] error processing', err)
  }
  return res.status(200).json({ ok: true })
}

async function processEvent(req: NextApiRequest, body: any) {
  // TTLock sometimes posts form-urlencoded, sometimes JSON. Next.js parses
  // JSON by default; for form-urlencoded `body` arrives as an object too.
  const evt = normalize(body)
  const eventType =
    (evt.recordType != null && RECORD_TYPE_TO_EVENT[evt.recordType]) || 'other'
  const occurredAt = evt.lockDate ? new Date(evt.lockDate).toISOString() : new Date().toISOString()

  // Match to locker + booking
  let lockerRecordId: string | undefined
  let bookingRecordId: string | undefined

  if (evt.lockId != null) {
    const lockers = await loadLockers()
    const locker = lockers.find(
      (l) => Number(l.fields[FLD.lockers.ttlockLockId] || NaN) === evt.lockId
    )
    if (locker) lockerRecordId = locker.id
  }

  if (evt.lockId != null && evt.keyboardPwd && eventType === 'door_unlocked') {
    const bookings = await loadActiveBookings()
    for (const b of bookings) {
      const lockInIds = (b.fields[FLD.bookings.lockerIn] as string[]) ?? []
      const lockOutIds = (b.fields[FLD.bookings.lockerOut] as string[]) ?? []
      const pinIn = b.fields[FLD.bookings.pinIn] as string | undefined
      const pinOut = b.fields[FLD.bookings.pinOut] as string | undefined

      if (lockInIds[0] === lockerRecordId && pinIn === evt.keyboardPwd) {
        bookingRecordId = b.id
        if (!b.fields[FLD.bookings.dropoffOpenedAt]) {
          await updateBooking(b.id, {
            [FLD.bookings.dropoffOpenedAt]: occurredAt,
          })
        }
        break
      }
      if (lockOutIds[0] === lockerRecordId && pinOut === evt.keyboardPwd) {
        bookingRecordId = b.id
        if (!b.fields[FLD.bookings.pickupOpenedAt]) {
          await updateBooking(b.id, {
            [FLD.bookings.pickupOpenedAt]: occurredAt,
          })
        }
        break
      }
    }
  }

  await appendAccessEvent({
    eventLabel: `${eventType} ${evt.lockId ?? '?'} ${occurredAt}`,
    occurredAt,
    eventType,
    lockerRecordId,
    bookingRecordId,
    deviceId: evt.lockId != null ? String(evt.lockId) : undefined,
    codeUsed: evt.keyboardPwd ?? undefined,
    rawPayload: JSON.stringify(body),
  })
}
