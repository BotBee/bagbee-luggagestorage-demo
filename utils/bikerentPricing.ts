/**
 * Shared BikeRent (bikerent.is) bike-box storage pricing. Used by:
 *   - /pages/embed/bikerent.tsx           (client, booking popup)
 *   - /pages/api/bikerent/checkout.ts     (server, initial booking)
 *   - /pages/api/bikerent/[id]/edit.ts    (server, edit + top-up flow)
 *   - /pages/storage|bikerent self-service edit preview
 *
 * Single source of truth — when prices change, change them here.
 *
 * Published bikerent.is model:
 *   - One base fee of 5000 ISK per booking (charged when the booking has any
 *     item).
 *   - Hard/soft bike boxes & bags: +1000 ISK per item per day.
 *   - Folded cardboard boxes: a flat +5000 ISK per box (covers up to 31 days).
 *   - After-hours drop-off (drop-off time after 17:00, up to 22:00): a flat
 *     +10,000 ISK surcharge. BikeRent only — staff stay late to receive boxes.
 */

export const BIKERENT_BASE_FEE = 5000 // per booking, any item
export const BIKERENT_HARD_PER_DAY = 1000 // per hard/soft box/bag per day
export const BIKERENT_FOLDED_FLAT = 5000 // per folded cardboard box (flat)
export const BIKERENT_AFTERHOURS_FEE = 10000 // flat, after-hours drop-off (17:00–22:00)
export const BIKERENT_MAX_ITEMS = 20

/** Normal manned drop-off/pick-up hours (24h "HH:MM"). */
export const BIKERENT_NORMAL_OPEN = '06:45'
export const BIKERENT_NORMAL_CLOSE = '17:00'
/** After-hours drop-off window (drop-off only). */
export const BIKERENT_AFTERHOURS_CLOSE = '22:00'

/** Source label written to the BSI Storage `Reference` field for bike bookings. */
export const BIKERENT_REFERENCE = 'bikerent.is'

/** Minutes-from-midnight for a "HH:MM" (24h) or "h:mm AM/PM" string; null if unparseable. */
const timeToMinutes = (t?: string): number | null => {
  if (!t) return null
  const s = t.trim()
  const ampm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = parseInt(ampm[2], 10)
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0
    return h * 60 + m
  }
  const h24 = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (h24) return parseInt(h24[1], 10) * 60 + parseInt(h24[2], 10)
  return null
}

/**
 * After-hours drop-off = drop-off time strictly after 17:00 (and within the
 * 22:00 window). At exactly 17:00 the booking is still normal hours.
 */
export const isAfterHoursDropoff = (dropoffTime?: string): boolean => {
  const mins = timeToMinutes(dropoffTime)
  if (mins === null) return false
  return mins > 17 * 60 && mins <= 22 * 60
}

export type BikerentInputs = {
  dropoffDate?: string
  pickupDate?: string
  /** Hard/soft bike boxes & bags (per-day). */
  hardBoxes?: number
  /** Folded cardboard boxes (flat). */
  foldedBoxes?: number
  /** Drop-off time ("HH:MM"). Drives the after-hours surcharge. */
  dropoffTime?: string
}

/** Whole calendar days between two ISO dates, min 1. Mirrors storagePricing. */
export const daysBetween = (a?: string, b?: string): number => {
  if (!a || !b) return 0
  const s = new Date(a).getTime()
  const e = new Date(b).getTime()
  if (isNaN(s) || isNaN(e) || e < s) return 0
  return Math.max(1, Math.ceil((e - s) / 86400000))
}

export const calcBikerentPrice = (v: BikerentInputs) => {
  const days = daysBetween(v.dropoffDate, v.pickupDate) || 1
  const hard = Number(v.hardBoxes) || 0
  const folded = Number(v.foldedBoxes) || 0
  // Base fee applies only when there's a hard bike box/bag. Folded-only
  // bookings skip the base fee (flat 5000/box covers them).
  const base = hard > 0 ? BIKERENT_BASE_FEE : 0
  const hardCost = hard * BIKERENT_HARD_PER_DAY * days
  const foldedCost = folded * BIKERENT_FOLDED_FLAT
  // After-hours drop-off surcharge — only when the booking has an item.
  const hasItems = hard > 0 || folded > 0
  const afterHoursCost =
    hasItems && isAfterHoursDropoff(v.dropoffTime) ? BIKERENT_AFTERHOURS_FEE : 0
  return {
    days,
    base,
    hardCost,
    foldedCost,
    afterHoursCost,
    total: base + hardCost + foldedCost + afterHoursCost,
  }
}
