import { NextApiRequest, NextApiResponse } from 'next'
import { getFastTrackTable } from '../../../utils/airtable'

export type FastTrackPassenger = { firstName: string; lastName: string }
export type FastTrackRecord = {
  id: string
  passengers: FastTrackPassenger[]
  flightDate: string | null
  paidAmount: number | null
}

/**
 * Fetch paid Fast-Track records for a given orderNo (5-char Pöntunarnúmer).
 * Returns one entry per paid Fast-Track row — multiple rows can exist if the
 * customer bought Fast-Track in more than one transaction.
 *
 * GET /api/airtable/fast-track-by-order-no?orderNo=XXXXX
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const orderNo = String(req.query.orderNo || '')
  if (!orderNo || !/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.status(400).json({ message: 'invalid orderNo' })
  }

  try {
    const table = getFastTrackTable()
    const records = await table
      .select({
        filterByFormula: `AND({order number} = '${orderNo}', {Greiddi} = TRUE())`,
      })
      .all()

    const fastTracks: FastTrackRecord[] = records.map((record) => {
      const f = record.fields as Record<string, any>
      const passengers: FastTrackPassenger[] = []
      for (let i = 1; i <= 4; i++) {
        const firstName = String(f[`Passenger ${i} First Name`] || '').trim()
        const lastName = String(f[`Passenger ${i} Last Name`] || '').trim()
        if (firstName || lastName) {
          passengers.push({ firstName, lastName })
        }
      }
      const rawDate = f['Flight date']
      const flightDate = rawDate ? String(rawDate) : null
      const rawAmount = f['Upphæð']
      const paidAmount = typeof rawAmount === 'number' ? rawAmount : null

      return {
        id: record.id,
        passengers,
        flightDate,
        paidAmount,
      }
    })

    res.status(200).json({ fastTracks })
  } catch (error) {
    console.error('[fast-track-by-order-no] error', error)
    res.status(500).json({ message: 'error reading fast-track records' })
  }
}
