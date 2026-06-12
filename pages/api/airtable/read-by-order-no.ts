import { NextApiRequest, NextApiResponse } from 'next'
import { getOrdersLookupTable, getMinifiedItem } from '../../../utils/airtable'
import { requireInternalSecret } from '../../../utils/internalApiAuth'

/**
 * Finds an order by Pöntunarnúmer (fx) — the order number = last 5 chars of Record ID.
 * Uses Airtable filterByFormula for server-side filtering (much faster than fetching all).
 * GET /api/airtable/read-by-order-no?orderNo=IYixC
 *
 * SERVER-ONLY: gated by requireInternalSecret(). The legitimate caller is
 * the getServerSideProps in pages/orders/[orderNo].tsx — see
 * utils/internalApiAuth.ts.
 *
 * Response shape is restricted to ORDER_PAGE_FIELDS — we never return PII
 * the public order page doesn't need to render (Kennitala, Rapyd Payment
 * ID, Payday Invoice ID, etc.), even though the auth check should make
 * that moot. Defense in depth: if the auth check is ever weakened or
 * accidentally bypassed, the field allowlist still keeps the sensitive
 * fields off the wire.
 */

// Allowlist: exactly the fields consumed by pages/orders/[orderNo].tsx
// (verified by Grep of `fields[...]` accesses in the page). When the page
// learns to display a new field, ADD it here — otherwise it won't render.
const ORDER_PAGE_FIELDS = [
  // Status & service type
  'Order Status',
  'Status',
  'Annað (comment)',
  'Requested service',
  // Customer (no Kennitala — never expose SSN to the client)
  'Nafn viðskiptavinar',
  'First Name (fx)',
  'Last Name (fx)',
  'Tölvupóstfang',
  'Símanúmer',
  // Bags & pricing (no Rapyd Payment ID, no Payday fields)
  'Töskufjöldi_no',
  'Töskufjöldi_no_yfirstærð',
  'Upphæð',
  'Tip Amount',
  'Greitt',
  'Greiðslustaða',
  // Pickup
  'Heimilisfang',
  'Short Address',
  'Dagsetning pick-up',
  'Tímasetning',
  // Delivery
  'Delivery Address',
  'Delivery date',
  'Delivery Time-window',
  // Flight
  'Dagsetning flugs',
  'Flugfélag',
  'Flugnúmer',
  // Linked tables (IDs only — the orders page fetches details separately)
  'Optimo Stops',
  'Tag numbers',
  // Reference for Fast-Track lookups
  'Pöntunarnúmer (fx)',
] as const

function pickAllowedFields(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of ORDER_PAGE_FIELDS) {
    if (k in fields) out[k] = fields[k]
  }
  return out
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!requireInternalSecret(req, res)) return

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

    const minified = getMinifiedItem(records[0])
    res.status(200).json({
      id: minified.id,
      fields: pickAllowedFields(minified.fields),
    })
  } catch (error: any) {
    console.error('read-by-order-no error:', error)
    res.status(500).json({ message: 'Error reading order', error: error?.message })
  }
}
