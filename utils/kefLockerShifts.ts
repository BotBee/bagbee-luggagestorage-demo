/**
 * KEF locker operational shifts.
 *
 * BagBee offers locker access in two shifts per day per locker:
 *
 *   Day shift:   13:00 → 22:00  (same calendar day)
 *   Night shift: 23:00 → 12:00  (spans midnight into the next day)
 *
 * Each customer drop-off and each pickup falls inside one of those shifts.
 * The TTLock passcode for that event is valid for the entire shift window —
 * customer doesn't get a narrower slot than the shift itself.
 *
 * Iceland is on Atlantic/Reykjavik time (UTC+0, no DST), so wall-clock time
 * equals UTC. We don't need a tz library — JavaScript Date methods using UTC
 * already match Reykjavik local time.
 */

export type ShiftKind = 'day' | 'night'

export interface Shift {
  kind: ShiftKind
  /** Epoch ms — shift start (e.g. 13:00 or 23:00 Reykjavik wall-clock). */
  startMs: number
  /** Epoch ms — shift end (22:00 or 12:00 next day). */
  endMs: number
  /** ISO date of the calendar day the shift starts on. */
  startDateIso: string
  /** Short label for naming and logging, e.g. "2026-05-13 day", "2026-05-13 night". */
  label: string
}

const DAY_START_HOUR = 13
const DAY_END_HOUR = 22
const NIGHT_START_HOUR = 23
const NIGHT_END_HOUR = 12 // next day

/** ms since epoch for the given Reykjavik wall-clock Y/M/D + hour. */
function ms(year: number, month: number, day: number, hour: number): number {
  // Reykjavik = UTC, so Date.UTC produces the right epoch.
  return Date.UTC(year, month, day, hour, 0, 0, 0)
}

/** Format a Date as YYYY-MM-DD using UTC components (== Reykjavik local). */
function isoDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Given an event datetime, return the shift it falls into. Throws if the
 * event lands in a "dead zone" between shifts (12:00-12:59 or 22:00-22:59) —
 * those windows have no locker access by design.
 */
export function shiftForEvent(eventDate: Date): Shift {
  const hour = eventDate.getUTCHours()
  const year = eventDate.getUTCFullYear()
  const month = eventDate.getUTCMonth()
  const day = eventDate.getUTCDate()

  if (hour >= DAY_START_HOUR && hour < DAY_END_HOUR) {
    // Day shift on `day`.
    const startMs = ms(year, month, day, DAY_START_HOUR)
    const endMs = ms(year, month, day, DAY_END_HOUR)
    return {
      kind: 'day',
      startMs,
      endMs,
      startDateIso: isoDate(new Date(startMs)),
      label: `${isoDate(new Date(startMs))} day`,
    }
  }

  if (hour >= NIGHT_START_HOUR) {
    // 23:00-23:59 → night shift starts on `day`, ends next day at 12:00.
    const startMs = ms(year, month, day, NIGHT_START_HOUR)
    const endMs = ms(year, month, day + 1, NIGHT_END_HOUR)
    return {
      kind: 'night',
      startMs,
      endMs,
      startDateIso: isoDate(new Date(startMs)),
      label: `${isoDate(new Date(startMs))} night`,
    }
  }

  if (hour < NIGHT_END_HOUR) {
    // 00:00-11:59 → night shift that started on the previous day.
    const startMs = ms(year, month, day - 1, NIGHT_START_HOUR)
    const endMs = ms(year, month, day, NIGHT_END_HOUR)
    return {
      kind: 'night',
      startMs,
      endMs,
      startDateIso: isoDate(new Date(startMs)),
      label: `${isoDate(new Date(startMs))} night`,
    }
  }

  // Dead zones: 12:00-12:59 (between shifts) or 22:00-22:59 (between shifts).
  throw new Error(
    `Event datetime ${eventDate.toISOString()} (hour=${hour}) falls outside ` +
      `KEF locker shift windows (day 13-22, night 23-12). Bookings must fall ` +
      `inside one of those shifts.`
  )
}
