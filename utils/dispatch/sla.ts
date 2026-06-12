// Service-Level-Agreement risk computation. For each pickup we compare
// the predicted ETA against the customer's time window and assign a
// risk band the dashboard color-codes (green/amber/red/blue).
//
// Bands:
//   ok        — comfortably inside the window (>30 min slack to close)
//   tight     — inside the window but <30 min before close
//   late      — predicted arrival is past window close
//   early     — predicted arrival is before window start (driver waits)
//   unknown   — no time window on the order

export type SlaBand = 'ok' | 'tight' | 'late' | 'early' | 'unknown'

export type SlaResult = {
  band: SlaBand
  slackMin: number | null // minutes vs window close; negative = past close
  windowStart: number | null
  windowEnd: number | null
}

const TIGHT_MIN = 30

export function parseTimeSlot(
  slot: string | undefined | null,
  dateIso: string,
): [number, number] | null {
  if (!slot) return null
  const m = String(slot).match(
    /^\s*(\d{1,2})(?::(\d{2}))?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*$/,
  )
  if (!m) return null
  const [, h1, m1 = '00', h2, m2 = '00'] = m
  const y = Number(dateIso.slice(0, 4))
  const mo = Number(dateIso.slice(5, 7)) - 1
  const d = Number(dateIso.slice(8, 10))
  const start = Math.floor(Date.UTC(y, mo, d, Number(h1), Number(m1)) / 1000)
  const end = Math.floor(Date.UTC(y, mo, d, Number(h2), Number(m2)) / 1000)
  return [start, end]
}

export function computeSla(
  arrivalSec: number,
  timeSlot: string | undefined | null,
  dateIso: string,
): SlaResult {
  const tw = parseTimeSlot(timeSlot, dateIso)
  if (!tw) {
    return { band: 'unknown', slackMin: null, windowStart: null, windowEnd: null }
  }
  const [start, end] = tw
  const slackMin = Math.round((end - arrivalSec) / 60)
  let band: SlaBand
  if (arrivalSec < start) band = 'early'
  else if (arrivalSec > end) band = 'late'
  else if (slackMin < TIGHT_MIN) band = 'tight'
  else band = 'ok'
  return { band, slackMin, windowStart: start, windowEnd: end }
}

export const SLA_COLORS: Record<SlaBand, string> = {
  ok: '#16a34a',
  tight: '#f59e0b',
  late: '#dc2626',
  early: '#2563eb',
  unknown: '#9ca3af',
}

export const SLA_LABELS: Record<SlaBand, string> = {
  ok: 'On schedule',
  tight: 'Tight',
  late: 'After window',
  early: 'Early — driver waits',
  unknown: 'No window',
}
