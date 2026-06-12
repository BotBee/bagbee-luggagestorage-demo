// Normalize partner-supplied phone numbers to E.164 (+<cc><number>) before
// they're written to Airtable.
//
// Why: project managers type phones however they're used to ("899-4957",
// "899 4957", "(354) 899 4957", "+354 899 4957"). Downstream automations —
// SMS to the customer, dispatch handoff, the Optimoroute Bot, the
// Icelandair check-in skill — all expect a stable E.164 string. Without
// normalization, "899-4957" gets stored, the SMS gateway tries to send to
// a literal "899-4957" and fails silently. Normalizing on the write path
// makes the upstream input format irrelevant.
//
// Defaults to Iceland (354) when no international prefix is detected,
// because that's the case for the vast majority of partner bookings.
// International numbers are preserved when they arrive with a "+" or "00"
// prefix.
//
// Failure mode: if libphonenumber can't parse the input as a valid number
// (typo, garbage), we return the trimmed raw input so the field is never
// silently emptied — Runar can spot and fix it in Airtable.

import { parsePhoneNumberFromString } from 'libphonenumber-js'

export function normalizePhone(
  raw: string | null | undefined,
  defaultCountry: 'IS' | 'GB' | 'US' | 'DE' = 'IS',
): string {
  if (!raw) return ''
  const trimmed = String(raw).trim()
  if (!trimmed) return ''
  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry)
    if (parsed && parsed.isValid()) {
      return parsed.format('E.164')
    }
  } catch {
    /* fall through to raw return */
  }
  return trimmed
}
