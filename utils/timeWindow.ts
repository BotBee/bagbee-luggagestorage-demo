// Normalize partner-supplied time-window strings to "HH:MM - HH:MM"
// format before they hit Airtable.
//
// Why this matters: downstream Make scenarios (Push Order to OptimoRoute -
// LIVE) split this field on "-" to extract twFrom / twTo for the
// OptimoRoute `create_order` call. The PICKUP-side mapper has a fallback
// (twTo defaults to "23:59" when the split's second half is empty), so
// single-time input like "11:15" creates a valid order. The DELIVERY-side
// mapper has NO fallback — it sends an empty twTo, OR rejects the
// `create_order` call, and the delivery half of a Pickup & Delivery
// order silently fails to appear in OR.
//
// Easiest fix is here, in the partner-portal write path: if the partner
// types "11:45" (one time) we expand to "11:45 - 12:45" so both Make
// formulas see a proper range. Already-formatted ranges pass through
// untouched.

/**
 * Add one hour to an HH:MM string (24-hour clock). Returns empty string
 * if input isn't a parseable HH:MM.
 */
const addOneHour = (hhmm: string): string => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return ''
  const hh = Number(m[1])
  if (!Number.isFinite(hh) || hh < 0 || hh > 23) return ''
  const next = (hh + 1) % 24
  return `${String(next).padStart(2, '0')}:${m[2]}`
}

/**
 * Normalize "11:15", "11:15 - 12:00", "11:15-12:00", "11:15 -", etc. into
 * "HH:MM - HH:MM". Unparseable input is returned trimmed-as-is so we
 * never destroy data the partner entered.
 */
export const normalizeTimeWindow = (raw: string | null | undefined): string => {
  if (!raw) return ''
  const s = String(raw).trim()
  if (!s) return ''

  if (s.includes('-')) {
    const parts = s.split('-').map((p) => p.trim())
    const start = parts[0] || ''
    const end = parts.slice(1).join('-').trim() // tolerate odd formatting
    if (start && end) return `${start} - ${end}`
    if (start && !end) {
      // "11:15 -" → expand the open end by one hour.
      const expanded = addOneHour(start)
      return expanded ? `${start} - ${expanded}` : s
    }
    return s
  }

  // Single time, no dash. Expand to a 1-hour window starting at the
  // typed time — matches the most common partner intent for "I want
  // bags delivered around 11:45".
  const expanded = addOneHour(s)
  if (expanded) return `${s} - ${expanded}`
  return s
}
