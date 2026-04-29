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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const item = req.body as AirtableOrder
  try {
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
