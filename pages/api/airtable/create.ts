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

// Server-side validation of the order payload. Last line of defence against
// client-side state-shape bugs — if any of these guards trip, the bug is
// upstream (Zustand snapshot staleness, partial store reset, etc.) but we
// don't want a half-blank record landing in Airtable and being routed for
// pickup. Required fields + sanity-check dates are not earlier than today
// (Iceland time). See incident note in common/mapper.ts validateBookingForOrder.
const validateOrderPayload = (item: AirtableOrder): string[] => {
  const problems: string[] = []
  const isNonEmptyString = (v: unknown): v is string =>
    typeof v === 'string' && v.trim() !== ''

  if (!isNonEmptyString(item?.['Nafn viðskiptavinar'])) {
    problems.push('customer name is required')
  }
  if (!isNonEmptyString(item?.Tölvupóstfang)) {
    problems.push('customer email is required')
  }
  if (!isNonEmptyString(item?.Símanúmer)) {
    problems.push('customer phone number is required')
  }
  if (!isNonEmptyString(item?.Heimilisfang)) {
    problems.push('pickup address is required')
  }
  if (!isNonEmptyString(item?.Tímasetning)) {
    problems.push('pickup time window is required')
  }
  if (!isNonEmptyString(item?.Flugnúmer)) {
    problems.push('flight number is required')
  }
  if (!isNonEmptyString(item?.Flugfélag)) {
    problems.push('airline is required')
  }

  // Date sanity. Reject anything missing, unparseable, or older than today
  // in Iceland (UTC). Date strings come in as 'YYYY/MM/DD' from mapToOrder.
  // The only way today could be valid is via an admin/manual workflow we
  // don't have — every customer-created order is for tomorrow or later.
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
  if (!flightDate) problems.push('flight date is missing or invalid')
  else if (flightDate.getTime() < today.getTime()) {
    problems.push('flight date is in the past')
  }
  if (!pickupDate) problems.push('pickup date is missing or invalid')
  else if (pickupDate.getTime() < today.getTime()) {
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
