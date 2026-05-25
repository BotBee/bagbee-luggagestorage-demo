import { NextApiRequest, NextApiResponse } from 'next'
import { getOrdersLookupTable } from '../../../utils/airtable'
import { maybeSendPaydayInvoiceForOrder } from '../../../utils/paydayInvoice'
import { requireInternalSecret } from '../../../utils/internalApiAuth'

/**
 * Optimistic "mark paid" called by /orders/[orderNo] when the customer
 * lands with ?paid=true. The Rapyd webhook also flips Greitt to true via
 * /api/payment/webhooks, but there's a race between the redirect and the
 * webhook firing — without this call the customer can briefly see status
 * "Pending" on a paid order. Idempotent: if Greitt is already true we
 * no-op so duplicate calls (page reload, double-redirect) are harmless.
 *
 * Setting Greitt: true is enough to flip the formula-driven Order Status
 * field from "Pending" to "Confirmed". Don't write to Order Status —
 * Airtable returns 422 and aborts the whole patch (caused the prod
 * webhook outage on Apr 22 2026).
 *
 * SERVER-ONLY: gated by requireInternalSecret(). The legitimate caller is
 * the getServerSideProps in pages/orders/[orderNo].tsx — see
 * utils/internalApiAuth.ts. Anyone hitting this directly without the
 * x-internal-secret header gets a 403.
 *
 * POST /api/airtable/mark-paid-by-order-no
 * Body: { orderNo: 'XXXXX' }  (the 5-char Pöntunarnúmer (fx) value)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ message: 'Method not allowed' })
  }

  if (!requireInternalSecret(req, res)) return

  const orderNo = (req.body?.orderNo as string) || (req.query.orderNo as string)
  if (!orderNo || !/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.status(400).json({ message: 'orderNo is required (alphanumeric)' })
  }

  try {
    const table = getOrdersLookupTable()
    const records = await table
      .select({
        filterByFormula: `{Pöntunarnúmer (fx)} = '${orderNo}'`,
        maxRecords: 1,
      })
      .firstPage()

    if (records.length === 0) {
      return res.status(404).json({ message: 'Order not found' })
    }

    const record = records[0]
    if (record.fields['Greitt'] === true) {
      return res.status(200).json({ alreadyPaid: true })
    }

    await table.update(record.id, {
      Greitt: true,
      Greiðslustaða: 'Greitt',
    })
    // Send Payday invoice if Kennitala filled. Idempotent — safe against
    // the same flow racing /api/payment/webhooks (Rapyd's webhook).
    await maybeSendPaydayInvoiceForOrder(table, record.id, record.fields)
    return res.status(200).json({ marked: true })
  } catch (error: any) {
    console.error('[api][airtable][mark-paid-by-order-no] error', error)
    return res.status(500).json({ message: 'Failed to mark paid', error: error?.message })
  }
}
