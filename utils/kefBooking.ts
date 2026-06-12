/**
 * KEF bike-box booking helpers for the paid, self-serve form — capacity,
 * locker assignment, and row create/read/update against the KEF Lockers 2025
 * table. Feeds the existing TTLock PIN pipeline (sync.ts).
 *
 * Capacity model (confirmed with the partner 2026-06-04):
 *   - A box occupies a physical locker only during its DROP-OFF window and
 *     (for a KEF return) its PICKUP window — it's free during storage.
 *   - Two bookings conflict on a locker when those windows overlap, plus a
 *     turnaround buffer so the locker can be cleared between customers.
 *   - One box per locker; two lockers total.
 *   - One Airtable row PER BOX (the PIN pipeline is one PIN per row); rows of a
 *     single order share their Rapyd Checkout ID as the group key.
 */
import { FieldSet, Records } from 'airtable'
import {
  FLD,
  KEF_BOOKINGS_TABLE,
  getBase,
  loadLockers,
  type BookingRecord,
} from './kefLockersAirtable'
import { shiftForEvent } from './kefLockerShifts'
import { deletePasscode, TTLockError } from './ttlock'

/** Physical lockers, one box each (Right, Left). Stable assets in `Lockers`. */
export const KEF_LOCKER_IDS = ['rec4PbeTTi8YfPCLO', 'recXrxSNAYKpjTCaH'] as const
/** Gap required between two bookings reusing the same locker (Phase 1 safety;
 *  the Phase 2 flight+lock monitor lets us tighten this later). */
export const KEF_TURNAROUND_BUFFER_MS = 3 * 60 * 60 * 1000
/** How long a Pending (unpaid) booking holds its locker before it frees up. */
export const KEF_PENDING_HOLD_MS = 30 * 60 * 1000

export type LockerAssignment = { lockerIn: string; lockerOut: string | null }

const getTable = () => getBase()(KEF_BOOKINGS_TABLE)

/** Build a Reykjavik (== UTC) ISO datetime from a YYYY-MM-DD + "HH:MM". */
export const isoDateTime = (date: string, time: string): string => {
  const m = /^(\d{1,2}):(\d{2})/.exec((time || '').trim())
  const hh = (m ? m[1] : '0').padStart(2, '0')
  const mm = m ? m[2] : '00'
  return `${date}T${hh}:${mm}:00.000Z`
}

type Hold = { lockerId: string; start: number; end: number }

/** Occupied locker intervals across all active bookings (excluding one order). */
async function loadHolds(excludeCheckoutId?: string): Promise<Hold[]> {
  const base = getBase()
  const rows: BookingRecord[] = []
  await base(KEF_BOOKINGS_TABLE)
    .select({
      // Not cancelled, and either Paid or a still-fresh Pending hold. Legacy
      // rows with no datetimes are skipped below.
      filterByFormula: `AND(
        NOT({Cancelled}),
        NOT({Payment Status} = 'Refunded'),
        NOT({RemoteLock sync status} = 'Revoked')
      )`,
      pageSize: 100,
      returnFieldsByFieldId: true,
    })
    .eachPage((page: Records<FieldSet>, next: () => void) => {
      rows.push(...(page as unknown as BookingRecord[]))
      next()
    })

  const holds: Hold[] = []
  for (const r of rows) {
    const f = r.fields as Record<string, any>
    if (excludeCheckoutId && f[FLD.bookings.rapydCheckoutId] === excludeCheckoutId) continue
    // NOTE: Pending (unpaid) rows still hold their locker. Abandoned carts are
    // rare and short-lived; a 30-min Pending sweep is a Phase-2 refinement
    // (KEF_PENDING_HOLD_MS is defined for it).

    const addHold = (lockerIds: string[] | undefined, startIso?: string, endIso?: string) => {
      const lockerId = lockerIds?.[0]
      if (!lockerId || !startIso) return
      const start = Date.parse(startIso)
      if (isNaN(start)) return
      let end = endIso ? Date.parse(endIso) : NaN
      if (isNaN(end)) {
        // Legacy / shift booking with no explicit window end — occupy the shift.
        try {
          end = shiftForEvent(new Date(start)).endMs
        } catch {
          end = start + 60 * 60 * 1000 // 1h fallback
        }
      }
      holds.push({ lockerId, start, end })
    }
    addHold(
      f[FLD.bookings.lockerIn] as string[] | undefined,
      f[FLD.bookings.checkInDatetime] as string | undefined,
      f[FLD.bookings.checkInWindowEnd] as string | undefined,
    )
    addHold(
      f[FLD.bookings.lockerOut] as string[] | undefined,
      f[FLD.bookings.checkOutDatetime] as string | undefined,
      f[FLD.bookings.checkOutWindowEnd] as string | undefined,
    )
  }
  return holds
}

/** Lockers free for [start,end] given existing holds + the turnaround buffer. */
const freeLockers = (holds: Hold[], start: number, end: number): string[] =>
  KEF_LOCKER_IDS.filter((lockerId) => {
    const conflicts = holds.some(
      (h) =>
        h.lockerId === lockerId &&
        h.start < end + KEF_TURNAROUND_BUFFER_MS &&
        start < h.end + KEF_TURNAROUND_BUFFER_MS,
    )
    return !conflicts
  })

export type WindowReq = { start: number; end: number }

/**
 * Decide whether `boxes` boxes can be booked, and assign lockers. Returns one
 * assignment per box, or null with a reason if capacity is short.
 */
export async function assignLockers(opts: {
  boxes: number
  dropoff: WindowReq
  pickup: WindowReq | null // null = BSÍ return (no KEF pickup locker)
  excludeCheckoutId?: string
}): Promise<{ assignments: LockerAssignment[] } | { error: string; freeDropoff: number }> {
  const { boxes, dropoff, pickup, excludeCheckoutId } = opts
  const holds = await loadHolds(excludeCheckoutId)

  const freeIn = freeLockers(holds, dropoff.start, dropoff.end)
  if (freeIn.length < boxes) {
    return { error: 'drop-off', freeDropoff: freeIn.length }
  }
  let freeOut: string[] = []
  if (pickup) {
    freeOut = freeLockers(holds, pickup.start, pickup.end)
    if (freeOut.length < boxes) {
      return { error: 'pickup', freeDropoff: freeIn.length }
    }
  }

  const assignments: LockerAssignment[] = []
  for (let i = 0; i < boxes; i++) {
    assignments.push({ lockerIn: freeIn[i], lockerOut: pickup ? freeOut[i] : null })
  }
  return { assignments }
}

/** Free locker counts for the form UI / availability endpoint. */
export async function checkAvailability(
  dropoff: WindowReq,
  pickup: WindowReq | null,
): Promise<{ freeDropoff: number; freePickup: number; maxBoxes: number }> {
  const holds = await loadHolds()
  const freeDropoff = freeLockers(holds, dropoff.start, dropoff.end).length
  const freePickup = pickup
    ? freeLockers(holds, pickup.start, pickup.end).length
    : KEF_LOCKER_IDS.length
  return {
    freeDropoff,
    freePickup,
    maxBoxes: Math.min(freeDropoff, freePickup, KEF_LOCKER_IDS.length),
  }
}

export type KefRowInput = {
  customerName: string
  email: string
  phone: string
  amount: number
  checkInIso: string
  checkInEndIso: string
  checkOutIso: string | null
  checkOutEndIso: string | null
  lockerIn: string
  lockerOut: string | null
  returnLocation: 'KEF airport' | 'BSÍ terminal'
  arrivalFlight?: string
  departureFlight?: string
  comment?: string
  rapydCheckoutId?: string
}

/** Create the per-box Pending rows for an order. Returns the created records. */
export async function createKefRows(rowInputs: KefRowInput[]): Promise<BookingRecord[]> {
  const table = getTable()
  const payloads = rowInputs.map((r) => {
    const fields: Record<string, any> = {
      [FLD.bookings.customerName]: r.customerName,
      [FLD.bookings.email]: r.email,
      [FLD.bookings.phone]: r.phone,
      [FLD.bookings.amount]: r.amount,
      [FLD.bookings.boxes]: 1,
      [FLD.bookings.typeOfService]: 'KEF bike box storage',
      [FLD.bookings.paymentStatus]: 'Pending',
      [FLD.bookings.checkInDatetime]: r.checkInIso,
      [FLD.bookings.checkInWindowEnd]: r.checkInEndIso,
      [FLD.bookings.lockerIn]: [r.lockerIn],
      [FLD.bookings.returnLocation]: r.returnLocation,
      [FLD.bookings.syncStatus]: 'Pending',
    }
    if (r.checkOutIso) fields[FLD.bookings.checkOutDatetime] = r.checkOutIso
    if (r.checkOutEndIso) fields[FLD.bookings.checkOutWindowEnd] = r.checkOutEndIso
    if (r.lockerOut) fields[FLD.bookings.lockerOut] = [r.lockerOut]
    if (r.arrivalFlight) fields[FLD.bookings.arrivalFlight] = r.arrivalFlight
    if (r.departureFlight) fields[FLD.bookings.departureFlight] = r.departureFlight
    if (r.comment) fields[FLD.bookings.customerComment] = r.comment
    if (r.rapydCheckoutId) fields[FLD.bookings.rapydCheckoutId] = r.rapydCheckoutId
    return { fields: fields as FieldSet }
  })
  const created = await table.create(payloads)
  return created as unknown as BookingRecord[]
}

/** All rows of an order, by shared Rapyd Checkout ID. */
export async function loadOrderRows(rapydCheckoutId: string): Promise<BookingRecord[]> {
  const base = getBase()
  const rows = await base(KEF_BOOKINGS_TABLE)
    .select({
      filterByFormula: `{Rapyd Checkout ID} = "${rapydCheckoutId}"`,
      maxRecords: 10,
      returnFieldsByFieldId: true,
    })
    .firstPage()
  return rows as unknown as BookingRecord[]
}

/** Resolve a booking by the 5-char Booking number (or a full rec id). Always
 *  returns fields keyed by field ID (so FLD reads work). */
export async function findKefBooking(idOrCode: string): Promise<BookingRecord | null> {
  const base = getBase()
  const isRecId = /^rec[A-Za-z0-9]{14}$/.test(idOrCode)
  const formula = isRecId
    ? `RECORD_ID() = "${idOrCode}"`
    : `{Booking number} = "${idOrCode}"`
  const rows = await base(KEF_BOOKINGS_TABLE)
    .select({ filterByFormula: formula, maxRecords: 1, returnFieldsByFieldId: true })
    .firstPage()
  return (rows[0] as unknown as BookingRecord) || null
}

export async function updateKefRows(
  ids: string[],
  fields: Record<string, any>,
): Promise<void> {
  const table = getTable()
  await table.update(ids.map((id) => ({ id, fields: fields as FieldSet })))
}

/**
 * Revoke any issued TTLock PINs (drop-off + pickup) for the given rows. Safe to
 * call when no PIN exists. Ignores "already gone" TTLock errors.
 */
export async function revokePinsForRows(rows: BookingRecord[]): Promise<void> {
  const lockers = await loadLockers()
  const ttlockByLockerId = new Map(
    lockers.map((l) => [l.id, Number((l.fields as any)[FLD.lockers.ttlockLockId])]),
  )
  for (const r of rows) {
    const f = r.fields as Record<string, any>
    const pairs: Array<[any, string | undefined]> = [
      [f[FLD.bookings.keyboardPwdIdIn], (f[FLD.bookings.lockerIn] as string[] | undefined)?.[0]],
      [f[FLD.bookings.keyboardPwdIdOut], (f[FLD.bookings.lockerOut] as string[] | undefined)?.[0]],
    ]
    for (const [pwdId, lockerId] of pairs) {
      if (!pwdId || !lockerId) continue
      const ttlock = ttlockByLockerId.get(lockerId)
      const keyboardPwdId = Number(pwdId)
      if (!ttlock || !Number.isFinite(ttlock) || !Number.isFinite(keyboardPwdId)) continue
      try {
        await deletePasscode(ttlock, keyboardPwdId)
      } catch (e) {
        if (!(e instanceof TTLockError)) throw e
      }
    }
  }
}

/** Clear PIN fields + reset sync so the cron re-issues for a new window. */
export const PIN_RESET_FIELDS: Record<string, any> = {
  [FLD.bookings.pinIn]: '',
  [FLD.bookings.pinOut]: '',
  [FLD.bookings.keyboardPwdIdIn]: '',
  [FLD.bookings.keyboardPwdIdOut]: '',
  [FLD.bookings.syncStatus]: 'Pending',
}
