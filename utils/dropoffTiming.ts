/**
 * Hours from now until a booking's drop-off, from the BSI Storage
 * `ArrivalDate` (+ optional `Arrival time`). Returns null if unparseable.
 * Used to gate self-service edits/cancellations against the 24h policy window.
 */
const parseTimeToMinutes = (t?: string): number | null => {
  if (!t) return null
  const trimmed = t.trim()
  const ampm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(trimmed)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = parseInt(ampm[2], 10)
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0
    return h * 60 + m
  }
  const h24 = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (h24) {
    const h = parseInt(h24[1], 10)
    const m = parseInt(h24[2], 10)
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return h * 60 + m
  }
  return null
}

export const hoursUntilDropoff = (date?: string, time?: string): number | null => {
  if (!date) return null
  const ms = new Date(date).getTime()
  if (isNaN(ms)) return null
  const mins = parseTimeToMinutes(time) ?? 0
  return (ms + mins * 60_000 - Date.now()) / 3_600_000
}
