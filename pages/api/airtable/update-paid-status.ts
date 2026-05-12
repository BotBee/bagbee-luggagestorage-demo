import { NextApiRequest, NextApiResponse } from 'next'
import { getTable, minifyItems } from '../../../utils/airtable'
import { maybeSendPaydayInvoiceForOrder } from '../../../utils/paydayInvoice'

// Legacy handler — kept for any external integrations still pointing here.
// Rapyd's canonical webhook is /api/payment/webhooks (see UpdatePaidStatus).
// Can we send in an auth bearer token via the webhook and verify it here to secure this endpoint?
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const recordId = req.body as string

  try {
    const table = getTable()
    const records = await table.select().all()
    const record = minifyItems(records).find(
      (x) => x.fields['Record ID'] === recordId
    )
    // update paid status by recordId
    await table.update(record!.id, { Greiðslustaða: 'Greitt', Greitt: true })

    // Payday invoice (idempotent via the "Payday Invoice Sent" flag).
    await maybeSendPaydayInvoiceForOrder(table, record!.id, record!.fields)

    res.status(200).json(record)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'error in updating results' })
  }
}
