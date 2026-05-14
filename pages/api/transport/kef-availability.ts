import { NextApiRequest, NextApiResponse } from 'next'
import { getOrdersLookupTable } from '../../../utils/airtable'
import { FALLBACK_TRANSPORT_PRICING } from '../../../common/transportConstants'
import type { KefAvailability, KefDriverWindow } from '../../../common/transportTypes'

// Returns the raw KEF activity on a given date so the client can resolve the
// final pickup mode using the customer's flight landing time. The mode
// decision lives on the client because it depends on whether the customer's
// 3-hour pick-up window overlaps a real driver window:
//
//   pickup-delivery — at least one paid KEF booking on this date has a
//                     Tímasetning window the customer's landing falls in.
//                     The driver is already at arrivals; new customer hands
//                     bags over directly. (Was called 'arrival-service'
//                     internally; dispatch labels it 'Pickup & Delivery'.)
//   locker          — no overlap with any driver window, and at least one
//                     of the two Bike Pit lockers is free. Year-round.
//   unavailable     — no overlap AND both lockers booked for this date.
//                     The form shows a contact-us message; ops arranges
//                     manually.
//
// `inLockerSeason` is still returned for diagnostic / future use, but the
// client no longer gates the locker option on it.
// KefAvailability + KefDriverWindow live in common/transportTypes.ts so
// client code can import them without pulling this server module's
// dependencies through Next.js's bundler graph.

const validateDate = (s: unknown): string | null => {
  if (typeof s !== 'string') return null
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

// Parse a time-window string like '06:00 - 08:00' or
// '08:00 - 12:00 (flexible for the driver)' into start/end hours in 24h
// decimal form. Returns null for anything that doesn't match the expected
// 'HH:MM - HH:MM' shape (e.g. 'After 17:00 (BSÍ luggage locker)' — that's
// a BSI marker, not a KEF slot, so it shouldn't surface here anyway).
const parseSlotTimes = (slot: string): { startHour: number; endHour: number } | null => {
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(slot.trim())
  if (!m) return null
  const startHour = parseInt(m[1], 10) + parseInt(m[2], 10) / 60
  const endHour = parseInt(m[3], 10) + parseInt(m[4], 10) / 60
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return null
  return { startHour, endHour }
}

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
  const lockerCapacity = FALLBACK_TRANSPORT_PRICING.lockerCapacityPerDay

  try {
    const table = getOrdersLookupTable()
    // Nýtt/óflokkað stores dates as YYYY/MM/DD (slash separator). Match both
    // forms because a few legacy rows used dashes.
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
        ],
      })
      .firstPage()

    // Build the union of driver windows. A single booking can contribute up
    // to two windows: one for the pickup leg (if KEF) and one for the
    // delivery leg (if KEF). We don't dedupe overlapping windows here —
    // the client overlap check tolerates duplicates.
    const driverWindows: KefDriverWindow[] = []
    for (const r of records) {
      const heimilis = String(r.fields.Heimilisfang ?? '')
      const delivery = String(r.fields['Delivery Address'] ?? '')
      const pickupSlot = String(r.fields['Tímasetning'] ?? '')
      const deliverySlot = String(r.fields['Delivery Time-window'] ?? '')

      if (/keflav|kef/i.test(heimilis)) {
        const parsed = parseSlotTimes(pickupSlot)
        if (parsed) driverWindows.push({ ...parsed, label: pickupSlot })
      }
      if (/keflav|kef/i.test(delivery)) {
        const parsed = parseSlotTimes(deliverySlot)
        if (parsed) driverWindows.push({ ...parsed, label: deliverySlot })
      }
    }

    // Locker count — look for the literal 'Locker' marker in Reference, or
    // in either address field (loose match by design; v1).
    const lockersInUse = records.filter((r) => {
      const ref = String(r.fields.Reference ?? '')
      const pickup = String(r.fields.Heimilisfang ?? '')
      const delivery = String(r.fields['Delivery Address'] ?? '')
      return /locker/i.test(ref) || /locker/i.test(pickup) || /locker/i.test(delivery)
    }).length

    const result: KefAvailability = {
      driverWindows,
      lockersInUse,
      lockerCapacity,
      inLockerSeason,
    }
    return res.status(200).json(result)
  } catch (error) {
    console.error('[api][transport][kef-availability] failed', error)
    // Fail open: tell the client there are no driver windows but lockers
    // are theoretically available. The customer flow degrades to locker
    // copy rather than blocking the booking entirely.
    const fallback: KefAvailability = {
      driverWindows: [],
      lockersInUse: 0,
      lockerCapacity,
      inLockerSeason,
    }
    return res.status(200).json(fallback)
  }
}
