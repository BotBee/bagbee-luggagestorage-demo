import { NextApiRequest, NextApiResponse } from 'next'
import { AirtableFastTrackOrder } from '../../../../common/types'
import { getMinifiedItem, getFastTrackTable } from '../../../../utils/airtable'
import { lookupDiscountCode } from '../../../../utils/discountCodes'

// The exact field set the standalone /fast-track flow sends — the keys of
// mapToFastTrackOrder's output (common/mapper.ts) / the
// AirtableFastTrackOrder type. The raw body was previously written to
// Airtable verbatim, which let a tampered request set any field on the
// Fast-Track table.
const FAST_TRACK_FIELDS = [
  'Flight date',
  'Málstaðall',
  'AirlineCode',
  'FlightNumber',
  'Email',
  'Destination',
  'Kennitala',
  'Greiddi',
  'Upphæð',
  'Afsláttarkóði',
  'Athugasemd',
  'Passenger 1 First Name',
  'Passenger 1 Last Name',
  'Passenger 2 First Name',
  'Passenger 2 Last Name',
  'Passenger 3 First Name',
  'Passenger 3 Last Name',
  'Passenger 4 First Name',
  'Passenger 4 Last Name',
] as const

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Copy only allowlisted fields — never write the raw body to Airtable.
  const raw = (req.body ?? {}) as Record<string, unknown>
  const picked: Record<string, unknown> = {}
  for (const key of FAST_TRACK_FIELDS) {
    if (raw[key] !== undefined) picked[key] = raw[key]
  }
  const item = picked as unknown as AirtableFastTrackOrder

  try {
    // A Fast-Track order may legitimately arrive pre-paid ONLY via a 100%
    // gift-card discount (mapper.ts sets Greiddi from is100PercentDiscount
    // and the flow skips the Rapyd checkout). Verify that claim server-side
    // — otherwise anyone could POST Greiddi: true and get free Fast-Track.
    if (item.Greiddi === true) {
      const code =
        typeof item.Afsláttarkóði === 'string' ? item.Afsláttarkóði : ''
      const lookup = code
        ? await lookupDiscountCode('Afslattarkodar Fast Track', code).catch(
            () => null
          )
        : null
      if (!lookup?.valid || lookup.discount !== 100) {
        console.warn(
          '[api][fast-track/create] rejecting prepaid claim without a valid 100% discount code',
          { code }
        )
        return res.status(400).json({
          message: 'Order claims to be prepaid without a valid 100% discount code.',
        })
      }
    }

    const table = getFastTrackTable()
    const newRecord = await table.create([{ fields: item }])
    res.status(200).json(getMinifiedItem(newRecord[0]))
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to create Fast-Track order' })
  }
}
