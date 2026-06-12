/**
 * KEF airport bike-box locker pricing (the luggagelockers.is-embeddable form).
 * VAT-inclusive flat prices — no tax handling here (partner: adjust later).
 *
 * Model (per bike box; max 2 boxes = 2 lockers, one box per locker):
 *   - KEF drop-off (customer drops the box into the airport locker): 5,000/box
 *   - Storage: 1,000/box/day
 *   - Return → KEF locker (customer collects at KEF): +10,000/box
 *   - Return → BSÍ bus terminal: no KEF fee (0)
 *   - Each PIN window includes 3h free; extra hours 1,000/hr/box. The drop-off
 *     window always applies; the pickup window only applies for a KEF return
 *     (a BSÍ return has no airport-locker pickup).
 *
 * Worked example: 1 box, 7 days, KEF→KEF, default 3h windows =
 *   5,000 + 7×1,000 + 10,000 = 22,000.
 */

export const KEF_DROPOFF_PER_BOX = 5000
export const KEF_STORAGE_PER_BOX_PER_DAY = 1000
export const KEF_RETURN_KEF_PER_BOX = 10000
export const KEF_RETURN_BSI_PER_BOX = 0
export const KEF_WINDOW_BASE_HOURS = 3
export const KEF_EXTRA_HOUR_PER_BOX = 1000
export const KEF_MAX_BOXES = 2

/** Locker physical capacity copy (also surfaced in /transport). */
export const KEF_LOCKER_DIMENSIONS = 'H 192 × W 41 × D 92 cm'
export const KEF_LOCKER_CAPACITY_TEXT =
  'about 3 suitcases — or 2 golf sets, 1 bike box, or 2–3 ski bags'

/** Source label written to the booking (tags the new paid bike-box flow). */
export const KEF_REFERENCE = 'KEF bike box storage'

export type KefReturnLocation = 'kef' | 'bsi'

export type KefPricingInputs = {
  boxes?: number
  dropoffDate?: string
  pickupDate?: string
  returnLocation?: KefReturnLocation
  /** Total drop-off window length in hours (min 3). */
  dropoffWindowHours?: number
  /** Total pickup window length in hours (min 3) — only billed for KEF return. */
  pickupWindowHours?: number
}

/** Whole calendar days between two ISO dates, min 1. */
export const daysBetween = (a?: string, b?: string): number => {
  if (!a || !b) return 0
  const s = new Date(a).getTime()
  const e = new Date(b).getTime()
  if (isNaN(s) || isNaN(e) || e < s) return 0
  return Math.max(1, Math.ceil((e - s) / 86400000))
}

/** Billable extra hours beyond the free 3h base, never negative. */
const extraHours = (windowHours?: number): number =>
  Math.max(0, Math.round(Number(windowHours) || KEF_WINDOW_BASE_HOURS) - KEF_WINDOW_BASE_HOURS)

export const calcKefPrice = (v: KefPricingInputs) => {
  const boxes = Math.max(0, Math.min(KEF_MAX_BOXES, Number(v.boxes) || 0))
  const days = daysBetween(v.dropoffDate, v.pickupDate) || 1
  const returnKef = v.returnLocation !== 'bsi' // default to KEF return

  const dropoffFee = boxes * KEF_DROPOFF_PER_BOX
  const storage = boxes * KEF_STORAGE_PER_BOX_PER_DAY * days
  const returnFee = boxes * (returnKef ? KEF_RETURN_KEF_PER_BOX : KEF_RETURN_BSI_PER_BOX)

  const dropoffExtra = extraHours(v.dropoffWindowHours) * KEF_EXTRA_HOUR_PER_BOX * boxes
  // Pickup window only exists (and is billed) for a KEF-locker return.
  const pickupExtra = returnKef
    ? extraHours(v.pickupWindowHours) * KEF_EXTRA_HOUR_PER_BOX * boxes
    : 0
  const windowExtra = dropoffExtra + pickupExtra

  return {
    boxes,
    days,
    dropoffFee,
    storage,
    returnFee,
    dropoffExtra,
    pickupExtra,
    windowExtra,
    total: dropoffFee + storage + returnFee + windowExtra,
  }
}
