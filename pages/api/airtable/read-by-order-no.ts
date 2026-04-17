import { NextApiRequest, NextApiResponse } from 'next'
import { getOrdersLookupTable, getMinifiedItem } from '../../../utils/airtable'

/**
 * Finds an order by Pöntunarnúmer (fx) — the order number = last 5 chars of Record ID.
 * Uses Airtable filterByFormula for server-side filtering (much faster than fetching all).
 * GET /api/airtable/read-by-order-no?orderNo=IYixC
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const orderNo = (req.query.orderNo as string) || (req.body?.orderNo as string)

  if (!orderNo) {
    return res.status(400).json({ message: 'orderNo is required' })
  }

  // Sanitize: only allow alphanumeric (Airtable record IDs are alphanumeric)
  if (!/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.status(400).json({ message: 'invalid orderNo' })
  }

  try {
    const table = getOrdersLookupTable()

    // Filter by Pöntunarnúmer (fx) — the order number formula field
    const records = await table
      .select({
        filterByFormula: `{Pöntunarnúmer (fx)} = '${orderNo}'`,
        maxRecords: 1,
      })
      .firstPage()

    if (records.length === 0) {
      return res.status(404).json({ message: 'Order not found' })
    }

    res.status(200).json(getMinifiedItem(records[0]))
  } catch (error: any) {
    console.error('read-by-order-no error:', error)
    res.status(500).json({ message: 'Error reading order', error: error?.message })
  }
}
