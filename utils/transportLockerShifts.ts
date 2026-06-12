/**
 * BagBee Transport KEF-pickup shift logic.
 *
 * Distinct from utils/kefLockerShifts.ts which models the LuggageLockers
 * customer access windows (day 13–22 / night 23–12). This file models the
 * BagBee crew arrival shifts that drive the locker-mode availability
 * counter on the customer-facing /transport booking form:
 *
 *   Noon shift:    BagBee arrives at 12:00 to collect bags from the
 *                  morning-landing customers. Customer must land before
 *                  12:00 to use this shift.
 *   Evening shift: BagBee arrives at 22:00 to collect bags from the
 *                  afternoon / evening-landing customers (lands 12:00–
 *                  22:00). Customer must land between 12:00 and 22:00
 *                  to use this shift.
 *
 * Shift definitions are read from the `KEF Locker Operations Rules` table
 * in the KEF Operation Airtable base (applEhUp3t8XHzp6r). That's a
 * deliberate choice — operators can tweak shift timing or per-shift locker
 * count without a redeploy. See ../utils/kefLockersAirtable.ts.
 *
 * Iceland is on Atlantic/Reykjavik time (UTC+0, no DST) so wall-clock and
 * UTC match exactly — no tz library needed.
 */
import {
  loadLockerShiftRules,
  LockerShiftRule,
} from './kefLockersAirtable'

export interface TransportShift {
  recordId: string
  name: 'Noon' | 'Evening' | string
  pickupHourDecimal: number // 12 or 22 by default
  pickupTimeHHmm: string
  capacity: number
  alarmOffsetMinutes: number
  alarmEmail: string
}

/**
 * Parse an HH:MM string into a decimal hour. '12:00' → 12, '22:30' → 22.5.
 * Returns null for malformed input — defensive against operators editing
 * the rule table directly.
 */
export function parseHHmm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  const h = parseInt(m[1], 10) + parseInt(m[2], 10) / 60
  return Number.isFinite(h) ? h : null
}

export async function loadActiveShifts(): Promise<TransportShift[]> {
  const rules = await loadLockerShiftRules()
  return rules
    .map(toShift)
    .filter((s): s is TransportShift => s !== null)
    .sort((a, b) => a.pickupHourDecimal - b.pickupHourDecimal)
}

function toShift(r: LockerShiftRule): TransportShift | null {
  const decimal = parseHHmm(r.pickupTimeHHmm)
  if (decimal === null) return null
  return {
    recordId: r.recordId,
    name: r.shiftName,
    pickupHourDecimal: decimal,
    pickupTimeHHmm: r.pickupTimeHHmm,
    capacity: r.lockersPerShift,
    alarmOffsetMinutes: r.alarmOffsetMinutes,
    alarmEmail: r.alarmEmail,
  }
}

/**
 * Given a customer's flight landing hour (decimal, Reykjavik wall-clock),
 * return the shift their booking would land into — i.e. the next BagBee
 * crew arrival after the landing. Returns null when the landing is too
 * late for the day's last shift (e.g. lands at 22:30 with last shift at
 * 22:00).
 */
export function shiftForLandingHour(
  landingHour: number,
  shifts: TransportShift[],
): TransportShift | null {
  for (const s of shifts) {
    if (landingHour < s.pickupHourDecimal) return s
  }
  return null
}

/**
 * Format a (date, HH:MM) into an ISO string in Atlantic/Reykjavik time.
 * Reykjavik = UTC so we use Date.UTC directly.
 */
export function shiftPickupIso(
  shiftDate: string, // YYYY-MM-DD
  hhmm: string,
): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(shiftDate)
  if (!dm) return null
  const tm = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!tm) return null
  const d = new Date(
    Date.UTC(
      Number(dm[1]),
      Number(dm[2]) - 1,
      Number(dm[3]),
      Number(tm[1]),
      Number(tm[2]),
      0,
      0,
    ),
  )
  return d.toISOString()
}
