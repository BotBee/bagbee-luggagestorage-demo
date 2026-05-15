import { NextApiRequest, NextApiResponse } from 'next'
import { getOrdersLookupTable } from '../../../utils/airtable'
import { FALLBACK_TRANSPORT_PRICING } from '../../../common/transportConstants'
import type {
  KefAvailability,
  KefDriverWindow,
  KefShiftAvailability,
} from '../../../common/transportTypes'
import { loadActiveShifts, TransportShift } from '../../../utils/transportLockerShifts'

// Returns per-shift KEF activity for a given date.
//
// Shifts are read from `KEF Locker Operations Rules` (KEF Operation base
// applEhUp3t8XHzp6r), so an operator can change shift timing or per-shift
// locker count without a redeploy. Default rules: Noon 12:00 / Evening 22:00,
// 2 lockers per shift.
//
// The client resolves the final pickup mode using the customer's flight
// landing time:
//   pickup-delivery — landing's 3h window overlaps a real driver window on
//                     this date (an existing paid KEF booking's
//                     Tímasetning). Driver is already at arrivals; new
//                     customer hands bags over directly.
//   locker          — no overlap, but the shift the landing falls into has
//                     `available > 0`. Year-round.
//   unavailable     — no overlap AND the shift is full (or landing is past
//                     the last shift). Form shows "contact us" copy.

const validateDate = (s: unknown): string | null => {
  if (typeof s !== 'string') return null
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

// Parse a time-window string like '06:00 - 08:00' or
// '08:00 - 12:00 (flexible for the driver)' into start/end hours in 24h
// decimal form. Returns null for anything that doesn't match the expected
// 'HH:MM - HH:MM' shape (e.g. 'After 17:00 (BSÍ luggage locker)').
const parseSlotTimes = (slot: string): { startHour: number; endHour: number } | null => {
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(slot.trim())
  if (!m) return null
  const startHour = parseInt(m[1], 10) + parseInt(m[2], 10) / 60
  const endHour = parseInt(m[3], 10) + parseInt(m[4], 10) / 60
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return null
  return { startHour, endHour }
}

// Decide which shift an existing booking should count against. The booking's
// pickup window (Tímasetning) drives this — its start hour is the customer's
// landing hour for KEF pickups. Returns null when the booking doesn't fall
// into any known shift (e.g. landing after the last shift, or unparseable).
const shiftForBooking = (
  pickupSlot: string,
  shifts: TransportShift[],
): TransportShift | null => {
  const parsed = parseSlotTimes(pickupSlot)
  if (!parsed) return null
  for (const s of shifts) {
    if (parsed.startHour < s.pickupHourDecimal) return s
  }
  return null
}

// Loose flag: does this booking reference the BagBee locker drop-off? The
// transport mapper writes a `[LOCKER]` marker into the booking comments, so
// look for that first; fall back to legacy 'locker' substring matches for
// any older rows that pre-date the marker.
const isLockerBooking = (
  ref: string,
  pickup: string,
  delivery: string,
  comment: string,
): boolean => {
  if (/\[LOCKER\]/i.test(comment)) return true
  return /locker/i.test(ref) || /locker/i.test(pickup) || /locker/i.test(delivery)
}

const fallbackShape = (
  shifts: TransportShift[],
  inLockerSeason: boolean,
): KefAvailability => ({
  shifts: shifts.map((s) => ({
    name: s.name,
    pickupHourDecimal: s.pickupHourDecimal,
    pickupTimeHHmm: s.pickupTimeHHmm,
    capacity: s.capacity,
    assigned: 0,
    available: s.capacity,
  })),
  driverWindows: [],
  lockersInUse: 0,
  lockerCapacity: shifts.reduce((sum, s) => sum + s.capacity, 0) ||
    FALLBACK_TRANSPORT_PRICING.lockerCapacityPerDay,
  inLockerSeason,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  const date = validateDate(req.query.date)
  if (!date) {
    return res.status(400).json({ message: 'Missing or invalid `date` (YYYY-MM-DD)' })
  }

  const month = parseInt(date.slice(5, 7), 10)
  const inLockerSeason =
    month >= FALLBACK_TRANSPORT_PRICING.lockerSeasonStartMonth &&
    month <= FALLBACK_TRANSPORT_PRICING.lockerSeasonEndMonth

  let shifts: TransportShift[]
  try {
    shifts = await loadActiveShifts()
  } catch (error) {
    console.error('[api][transport][kef-availability] rule load failed', error)
    // Fail open: use the legacy single-bucket model so bookings don't break.
    return res.status(200).json(fallbackShape([], inLockerSeason))
  }

  try {
    const table = getOrdersLookupTable()
    const dateSlash = date.replace(/-/g, '/')

    const formula = `AND(
      {Greiðslustaða} = "Greitt",
      OR(
        AND(
          OR(FIND("Keflav", LOWER({Heimilisfang})), FIND("KEF", UPPER({Heimilisfang}))),
          OR({Dagsetning pick-up} = "${dateSlash}", {Dagsetning pick-up} = "${date}")
        ),
        AND(
          OR(FIND("Keflav", LOWER({Delivery Address})), FIND("KEF", UPPER({Delivery Address}))),
          OR({Delivery date} = "${dateSlash}", {Delivery date} = "${date}")
        )
      )
    )`

    const records = await table
      .select({
        filterByFormula: formula,
        maxRecords: 50,
        fields: [
          'Reference',
          'Heimilisfang',
          'Delivery Address',
          'Tímasetning',
          'Delivery Time-window',
          'Annað (comment)',
        ],
      })
      .firstPage()

    // Union of driver windows (any KEF leg's time window — pickup OR
    // delivery contributes). Used by the client to detect "driver already
    // at arrivals" pickup-delivery mode.
    const driverWindows: KefDriverWindow[] = []
    // Per-shift assigned counter — bookings that look like locker mode.
    const assignedByShift = new Map<string, number>(
      shifts.map((s) => [s.name, 0]),
    )
    let lockersInUse = 0

    for (const r of records) {
      const heimilis = String(r.fields.Heimilisfang ?? '')
      const delivery = String(r.fields['Delivery Address'] ?? '')
      const pickupSlot = String(r.fields['Tímasetning'] ?? '')
      const deliverySlot = String(r.fields['Delivery Time-window'] ?? '')
      const ref = String(r.fields.Reference ?? '')
      const comment = String(r.fields['Annað (comment)'] ?? '')

      if (/keflav|kef/i.test(heimilis)) {
        const parsed = parseSlotTimes(pickupSlot)
        if (parsed) driverWindows.push({ ...parsed, label: pickupSlot })
      }
      if (/keflav|kef/i.test(delivery)) {
        const parsed = parseSlotTimes(deliverySlot)
        if (parsed) driverWindows.push({ ...parsed, label: deliverySlot })
      }

      // Locker counting — only KEF pickups land in lockers (KEF deliveries
      // use the driver-to-checkin route). Match the pickup leg only.
      if (
        /keflav|kef/i.test(heimilis) &&
        isLockerBooking(ref, heimilis, delivery, comment)
      ) {
        lockersInUse += 1
        const shift = shiftForBooking(pickupSlot, shifts)
        if (shift) {
          assignedByShift.set(shift.name, (assignedByShift.get(shift.name) ?? 0) + 1)
        }
      }
    }

    const shiftAvailability: KefShiftAvailability[] = shifts.map((s) => {
      const assigned = assignedByShift.get(s.name) ?? 0
      return {
        name: s.name,
        pickupHourDecimal: s.pickupHourDecimal,
        pickupTimeHHmm: s.pickupTimeHHmm,
        capacity: s.capacity,
        assigned,
        available: Math.max(0, s.capacity - assigned),
      }
    })

    const result: KefAvailability = {
      shifts: shiftAvailability,
      driverWindows,
      lockersInUse,
      lockerCapacity: shifts.reduce((sum, s) => sum + s.capacity, 0) ||
        FALLBACK_TRANSPORT_PRICING.lockerCapacityPerDay,
      inLockerSeason,
    }
    return res.status(200).json(result)
  } catch (error) {
    console.error('[api][transport][kef-availability] failed', error)
    return res.status(200).json(fallbackShape(shifts, inLockerSeason))
  }
}
