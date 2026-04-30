import { NextApiRequest, NextApiResponse } from 'next'
import { AirtableOrder } from '../../../common/types'
import {
  getMinifiedItem,
  getPostalCodeCutoffs,
  getTable,
  parseSlotStartHour,
} from '../../../utils/airtable'

// Iceland postcodes are exactly 3 digits. We extract the first 3-digit token
// from the formatted address (Heimilisfang) which Google Places returns in
// the form "<street> <number>, <postcode> <city>, <country>". This is a
// safety net for stale client state / dev-tools edits — the client also
// stores the postal code from Places `addressComponents` and we'd ideally
// trust that, but the AirtableOrder shape doesn't carry it through.
const extractIcelandicPostcode = (address: string | undefined | null): string | null => {
  if (typeof address !== 'string') return null
  const match = /\b(\d{3})\b/.exec(address)
  return match ? match[1] : null
}

// Narrow server-side guard. The strict required-field checks were rolled back
// on 2026-04-30 after they flagged legitimate bookings (root cause still under
// investigation — most likely a code path where the Airtable payload is built
// from booking-state shapes the validator didn't anticipate). What's kept:
// the date-sanity check, which is the single most important safeguard against
// the Apr 29 partial-order incident — that order ended up with `Dagsetning
// flugs = today` because dayjs(undefined)/`new Date()` silently fell back to
// today's date. Past-date is the only deterministic signal of that class of
// bug, and rejecting on it doesn't false-positive on real bookings.
const validateOrderPayload = (item: AirtableOrder): string[] => {
  const problems: string[] = []
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const parseYmd = (s: unknown): Date | null => {
    if (typeof s !== 'string') return null
    const m = /^(\d{4})[\/-](\d{2})[\/-](\d{2})$/.exec(s.trim())
    if (!m) return null
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    return isNaN(d.getTime()) ? null : d
  }
  const flightDate = parseYmd(item?.['Dagsetning flugs'] as unknown)
  const pickupDate = parseYmd(item?.['Dagsetning pick-up'] as unknown)
  if (flightDate && flightDate.getTime() < today.getTime()) {
    problems.push('flight date is in the past')
  }
  if (pickupDate && pickupDate.getTime() < today.getTime()) {
    problems.push('pickup date is in the past')
  }
  return problems
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const item = req.body as AirtableOrder
  try {
    const payloadProblems = validateOrderPayload(item)
    if (payloadProblems.length > 0) {
      console.warn(
        '[api][create] rejecting payload with missing/invalid fields',
        payloadProblems,
        {
          name: item?.['Nafn viðskiptavinar'],
          email: item?.Tölvupóstfang,
          flightDate: item?.['Dagsetning flugs'],
          pickupDate: item?.['Dagsetning pick-up'],
        },
      )
      return res.status(400).json({
        message: `Order is missing required fields: ${payloadProblems.join('; ')}`,
        problems: payloadProblems,
      })
    }

    // Server-side postal-code validation: catches stale state, URL tampering
    // and dev-tools edits. Empty/unknown postcode falls back to the legacy
    // capacity-only behaviour (the availability API enforced that already).
    const postalCode = extractIcelandicPostcode(item?.Heimilisfang)
    const slotLabel = item?.Tímasetning
    if (postalCode && typeof slotLabel === 'string' && slotLabel.trim() !== '') {
      const rules = await getPostalCodeCutoffs()
      const rule = rules[postalCode]
      if (rule) {
        if (rule.service === false) {
          console.warn(
            '[api][create] rejecting unserviced postcode',
            postalCode,
            slotLabel,
          )
          return res.status(400).json({
            message: `Postal code ${postalCode} is not currently serviced for pickup.`,
          })
        }
        // The 3-hour "any-time" 19:00 - 22:00 slot is exempt from the
        // earliest/latest postcode cutoffs (matches availability API).
        const ANY_TIME_SLOT = '19:00 - 22:00'
        const slotIsAnyTime = slotLabel.trim() === ANY_TIME_SLOT
        const earliest = rule.earliestSlotStartHour
        const latest = rule.latestSlotStartHour
        const slotStart = parseSlotStartHour(slotLabel)
        if (!slotIsAnyTime && slotStart != null) {
          if (earliest != null && slotStart < earliest) {
            console.warn(
              '[api][create] rejecting slot before postcode earliest',
              postalCode,
              slotLabel,
              earliest,
            )
            return res.status(400).json({
              message: `Slot ${slotLabel} is not available for postal code ${postalCode}.`,
            })
          }
          if (latest != null && slotStart > latest) {
            console.warn(
              '[api][create] rejecting slot past postcode cutoff',
              postalCode,
              slotLabel,
              latest,
            )
            return res.status(400).json({
              message: `Slot ${slotLabel} is not available for postal code ${postalCode}.`,
            })
          }
        }
      }
    }

    const table = getTable()
    const newRecord = await table.create([{ fields: item }])
    res.status(200).json(getMinifiedItem(newRecord[0]))
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error })
  }
}
