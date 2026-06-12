/**
 * KEF lockers sync — Vercel cron route, every 10 minutes.
 *
 * For each booking in Airtable KEF Lockers 2025:
 *   - Cancelled? → revoke active PINs, mark Revoked.
 *   - Pickup shift ended? → mark Completed (PIN expired naturally on lock).
 *   - Drop-off shift starts within 24h and no PIN (in) yet? → create one.
 *   - Pickup shift starts within 24h and no PIN (out) yet? → create one.
 *
 * Each booking is processed independently — one failure doesn't poison
 * the rest of the run. Errors land in `RemoteLock last error` on the booking
 * with `RemoteLock sync status` = Failed.
 *
 * Protected by CRON_SECRET — Vercel cron sends it in the Authorization header,
 * everyone else gets 401.
 *
 * See ../../../../memory/kef_lockers_project.md for full context.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  FLD,
  loadActiveBookings,
  loadLockers,
  updateBooking,
  type BookingRecord,
  type LockerRecord,
} from '../../../utils/kefLockersAirtable'
import { shiftForEvent } from '../../../utils/kefLockerShifts'
import {
  createTimeBoundPasscode,
  deletePasscode,
  randomPin,
  TTLockError,
} from '../../../utils/ttlock'

const PUSH_AHEAD_MS = 24 * 60 * 60 * 1000 // create PIN when shift is within next 24h

// Allow up to 60s for the sync (Pro plan). Default is 10s which is too short
// if we ever have a large backlog to revoke or many TTLock calls in one tick.
export const config = {
  maxDuration: 60,
}

interface SyncSummary {
  processed: number
  pinsCreated: number
  pinsRevoked: number
  completed: number
  failed: number
  errors: { booking: string; error: string }[]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // --- auth -----------------------------------------------------------------
  const expected = process.env.CRON_SECRET
  const auth = req.headers.authorization
  if (!expected || auth !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  // --- run ------------------------------------------------------------------
  const summary: SyncSummary = {
    processed: 0,
    pinsCreated: 0,
    pinsRevoked: 0,
    completed: 0,
    failed: 0,
    errors: [],
  }

  try {
    const [bookings, lockers] = await Promise.all([loadActiveBookings(), loadLockers()])
    const lockerByRecordId = new Map(lockers.map((l) => [l.id, l]))

    const now = Date.now()
    for (const booking of bookings) {
      summary.processed++
      try {
        await processBooking(booking, lockerByRecordId, now, summary)
      } catch (err: any) {
        summary.failed++
        const msg = err instanceof Error ? err.message : String(err)
        summary.errors.push({ booking: bookingLabel(booking), error: msg })
        await updateBooking(booking.id, {
          [FLD.bookings.syncStatus]: 'Failed',
          [FLD.bookings.lastError]: msg,
        }).catch(() => {
          /* swallow — we already failed once */
        })
      }
    }
  } catch (err: any) {
    console.error('[lockers/sync] fatal', err)
    return res.status(500).json({ error: err?.message || String(err), summary })
  }

  console.log('[lockers/sync] done', summary)
  return res.status(200).json({ ok: true, summary })
}

// ---------------------------------------------------------------------------
// Per-booking logic
// ---------------------------------------------------------------------------

async function processBooking(
  booking: BookingRecord,
  lockerByRecordId: Map<string, LockerRecord>,
  now: number,
  summary: SyncSummary
): Promise<void> {
  const fields = booking.fields
  const paymentStatus = fields[FLD.bookings.paymentStatus] as string | undefined
  // New paid bike-box bookings can be cancelled/refunded via Payment Status too.
  const cancelled =
    !!fields[FLD.bookings.cancelled] ||
    paymentStatus === 'Cancelled' ||
    paymentStatus === 'Refunded'
  const checkInIso = fields[FLD.bookings.checkInDatetime] as string | undefined
  const checkOutIso = fields[FLD.bookings.checkOutDatetime] as string | undefined
  const checkInEndIso = fields[FLD.bookings.checkInWindowEnd] as string | undefined
  const checkOutEndIso = fields[FLD.bookings.checkOutWindowEnd] as string | undefined
  const pinIn = fields[FLD.bookings.pinIn] as string | undefined
  const pinOut = fields[FLD.bookings.pinOut] as string | undefined
  const keyboardPwdIdIn = fields[FLD.bookings.keyboardPwdIdIn] as string | undefined
  const keyboardPwdIdOut = fields[FLD.bookings.keyboardPwdIdOut] as string | undefined
  const lockerInIds = (fields[FLD.bookings.lockerIn] as string[] | undefined) ?? []
  const lockerOutIds = (fields[FLD.bookings.lockerOut] as string[] | undefined) ?? []


  // ---- Cancellation: revoke and mark ---------------------------------------
  if (cancelled) {
    let revoked = 0
    if (keyboardPwdIdIn && lockerInIds[0]) {
      const lock = lockerByRecordId.get(lockerInIds[0])
      if (lock) {
        await revoke(lock, keyboardPwdIdIn)
        revoked++
      }
    }
    if (keyboardPwdIdOut && lockerOutIds[0]) {
      const lock = lockerByRecordId.get(lockerOutIds[0])
      if (lock) {
        await revoke(lock, keyboardPwdIdOut)
        revoked++
      }
    }
    await updateBooking(booking.id, {
      [FLD.bookings.syncStatus]: 'Revoked',
      [FLD.bookings.lastError]: '',
    })
    summary.pinsRevoked += revoked
    return
  }

  // ---- Validate + resolve windows ------------------------------------------
  // Missing drop-off datetime = incomplete booking — skip silently.
  if (!checkInIso) return
  // Never issue a PIN for an unpaid hold (new paid bike-box flow). Legacy rows
  // have an empty Payment Status and fall through as before (assumed paid).
  if (paymentStatus === 'Pending') return
  if (!lockerInIds[0]) {
    throw new Error('Booking has a Check-in datetime but no Locker-In link')
  }
  // Exact [start,end] when the booking carries an explicit window end (bike-box
  // form); otherwise the legacy operating shift around the event. Pickup is
  // optional — a BSÍ-return bike-box booking has no airport-locker pickup.
  const dropoffWin = windowFor(checkInIso, checkInEndIso)
  const pickupWin = checkOutIso ? windowFor(checkOutIso, checkOutEndIso) : null

  // ---- Completion: all required PINs done and the last window has ended ----
  const pickupSatisfied = !pickupWin || !!pinOut
  const lastEndMs = pickupWin ? pickupWin.endMs : dropoffWin.endMs
  if (pinIn && pickupSatisfied && now > lastEndMs) {
    await updateBooking(booking.id, {
      [FLD.bookings.syncStatus]: 'Completed',
      [FLD.bookings.lastError]: '',
    })
    summary.completed++
    return
  }

  // ---- Create drop-off PIN if within push window ---------------------------
  if (!pinIn && now >= dropoffWin.startMs - PUSH_AHEAD_MS && now < dropoffWin.endMs) {
    const lock = mustLock(lockerByRecordId, lockerInIds[0], 'Locker-In')
    const name = customerSuffix(fields, 'inn')
    const pin = randomPin()
    const { keyboardPwdId } = await createTimeBoundPasscode({
      lockId: ttlockId(lock),
      keyboardPwd: pin,
      keyboardPwdName: name,
      startDate: dropoffWin.startMs,
      endDate: dropoffWin.endMs,
    })
    await updateBooking(booking.id, {
      [FLD.bookings.pinIn]: pin,
      [FLD.bookings.keyboardPwdIdIn]: String(keyboardPwdId),
      [FLD.bookings.syncStatus]: 'Active',
      [FLD.bookings.lastError]: '',
    })
    summary.pinsCreated++
  }

  // ---- Create pickup PIN if within push window -----------------------------
  if (
    pickupWin &&
    !pinOut &&
    lockerOutIds[0] &&
    now >= pickupWin.startMs - PUSH_AHEAD_MS &&
    now < pickupWin.endMs
  ) {
    const lock = mustLock(lockerByRecordId, lockerOutIds[0], 'Locker-Out')
    const name = customerSuffix(fields, 'út')
    const pin = randomPin()
    const { keyboardPwdId } = await createTimeBoundPasscode({
      lockId: ttlockId(lock),
      keyboardPwd: pin,
      keyboardPwdName: name,
      startDate: pickupWin.startMs,
      endDate: pickupWin.endMs,
    })
    await updateBooking(booking.id, {
      [FLD.bookings.pinOut]: pin,
      [FLD.bookings.keyboardPwdIdOut]: String(keyboardPwdId),
      [FLD.bookings.syncStatus]: 'Active',
      [FLD.bookings.lastError]: '',
    })
    summary.pinsCreated++
  }
}

/**
 * Resolve a PIN window. With an explicit end (bike-box exact-window bookings)
 * the PIN is valid for exactly [start, end]. Without one (legacy/transport
 * bookings), snap to the operating shift that contains the event.
 */
function windowFor(startIso: string, endIso?: string): { startMs: number; endMs: number } {
  const startMs = Date.parse(startIso)
  if (endIso) {
    const endMs = Date.parse(endIso)
    if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) return { startMs, endMs }
  }
  const s = shiftForEvent(new Date(startMs))
  return { startMs: s.startMs, endMs: s.endMs }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bookingLabel(booking: BookingRecord): string {
  const name = booking.fields[FLD.bookings.customerName] || ''
  const num = booking.fields[FLD.bookings.bookingNumber] || ''
  return `${num} ${name}`.trim() || booking.id
}

function mustLock(
  map: Map<string, LockerRecord>,
  recordId: string,
  fieldName: string
): LockerRecord {
  const l = map.get(recordId)
  if (!l) throw new Error(`${fieldName} points at unknown locker record ${recordId}`)
  return l
}

function ttlockId(lock: LockerRecord): number {
  const raw = lock.fields[FLD.lockers.ttlockLockId] as string | undefined
  if (!raw) throw new Error(`Locker ${lock.id} missing TTLock lockId`)
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new Error(`Locker ${lock.id} has invalid lockId "${raw}"`)
  return n
}

function customerSuffix(fields: Record<string, any>, suffix: 'inn' | 'út'): string {
  const name = String(fields[FLD.bookings.customerName] || '').trim()
  // TTLock name max 20 chars — truncate customer to leave room for " inn"/" út".
  const room = 20 - (suffix.length + 1)
  const truncated = name.length > room ? name.slice(0, room) : name
  return `${truncated} ${suffix}`
}

async function revoke(lock: LockerRecord, keyboardPwdIdStr: string): Promise<void> {
  const lockId = ttlockId(lock)
  const keyboardPwdId = Number(keyboardPwdIdStr)
  if (!Number.isFinite(keyboardPwdId)) return
  try {
    await deletePasscode(lockId, keyboardPwdId)
  } catch (err) {
    // If the code's already gone (already deleted, or expired and purged),
    // TTLock errors but we don't care — log and move on.
    if (err instanceof TTLockError) {
      console.warn('[lockers/sync] revoke ignored', err.message)
      return
    }
    throw err
  }
}
