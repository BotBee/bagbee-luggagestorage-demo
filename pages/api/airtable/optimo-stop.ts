import { NextApiRequest, NextApiResponse } from 'next'
import { getOptimoStopsTable } from '../../../utils/airtable'

const SCHEDULED_AT_FIELD_ID = 'fldjE1YgXR5vEQL1l'

/**
 * Fetches the scheduledAt time from a specific Optimo stop record (the pickup one).
 * Accepts a comma-separated list of stop record IDs and an order number,
 * returns the scheduledAt for the PICKUP stop (not the delivery -D one).
 *
 * GET /api/airtable/optimo-stop?orderNo=IYixC&stopIds=rec1,rec2
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const orderNo = req.query.orderNo as string
  const stopIdsParam = req.query.stopIds as string

  if (!orderNo || !stopIdsParam) {
    return res
      .status(400)
      .json({ message: 'orderNo and stopIds are required' })
  }

  if (!/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.status(400).json({ message: 'invalid orderNo' })
  }

  const stopIds = stopIdsParam
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^rec[a-zA-Z0-9]+$/.test(s))

  if (stopIds.length === 0) {
    return res.status(400).json({ message: 'no valid stopIds' })
  }

  try {
    const table = getOptimoStopsTable()

    // Fetch each stop by ID — no scanning, no filtering
    const stops = await Promise.all(
      stopIds.map((id) =>
        table.find(id).catch(() => null)
      )
    )

    // Find the PICKUP stop (the one matching orderNo exactly, no -D suffix)
    const pickup = stops.find((stop) => {
      if (!stop) return false
      const fields = stop.fields as Record<string, any>
      // The order reference might be in any field — check all values
      for (const val of Object.values(fields)) {
        if (val == null) continue
        if (Array.isArray(val)) {
          if (val.some((v) => String(v).trim() === orderNo)) return true
        } else if (String(val).trim() === orderNo) {
          return true
        }
      }
      return false
    })

    if (!pickup) {
      return res.status(404).json({ message: 'Pickup stop not found' })
    }

    // Re-fetch with field IDs so we can read scheduledAt by its ID
    const pickupWithFieldIds = await table
      .select({
        filterByFormula: `RECORD_ID() = '${pickup.id}'`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      })
      .firstPage()

    const fields = pickupWithFieldIds[0]?.fields as Record<string, any>
    const scheduledAt = fields?.[SCHEDULED_AT_FIELD_ID] ?? null

    res.status(200).json({ scheduledAt })
  } catch (error: any) {
    console.error('Optimo stop error:', error)
    res
      .status(500)
      .json({ message: 'Error reading optimo stop', error: error?.message })
  }
}
