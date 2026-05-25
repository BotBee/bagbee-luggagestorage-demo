import { NextApiRequest, NextApiResponse } from 'next'
import { timingSafeEqual } from 'crypto'
import { getTable, minifyItems } from '../../../utils/airtable'
import { maybeSendPaydayInvoiceForOrder } from '../../../utils/paydayInvoice'

// Legacy handler — kept for any external integrations (Zapier zaps,
// scripts) still pointing here. Rapyd's canonical webhook is
// /api/payment/webhooks which calls the shared UpdatePaidStatus.
//
// External callers MUST send the shared secret in the `x-api-secret`
// header. The secret lives in the PAID_STATUS_API_SECRET Vercel env var.
// Fails closed: if the env var is unset, every request is rejected with
// 500 (we'd rather an integration loudly break than silently accept
// unauthenticated traffic — this endpoint marks orders paid AND sends
// real Payday invoices, so the blast radius is high).
//
// Migration path for any Zaps currently pointing here:
//   1. Add the `x-api-secret` header with the shared secret to the
//      Zap's HTTP-request step, OR
//   2. Re-point the Zap at /api/payment/webhooks with a real Rapyd
//      signature, OR
//   3. Decide the Zap is no longer needed and delete it.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const expected = process.env.PAID_STATUS_API_SECRET
  if (!expected) {
    console.error(
      '[update-paid-status] PAID_STATUS_API_SECRET is not set; refusing request'
    )
    return res.status(500).json({ message: 'Server misconfigured' })
  }

  const headerVal = req.headers['x-api-secret']
  const provided = Array.isArray(headerVal) ? headerVal[0] : headerVal
  if (typeof provided !== 'string' || provided.length === 0) {
    return res.status(403).json({ message: 'Forbidden' })
  }
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  const recordId = req.body as string

  try {
    const table = getTable()
    const records = await table.select().all()
    const record = minifyItems(records).find(
      (x) => x.fields['Record ID'] === recordId
    )
    if (!record) {
      return res.status(404).json({ message: 'Record not found' })
    }
    // update paid status by recordId
    await table.update(record.id, { Greiðslustaða: 'Greitt', Greitt: true })

    // Payday invoice (idempotent via the "Payday Invoice Sent" flag).
    await maybeSendPaydayInvoiceForOrder(table, record.id, record.fields)

    res.status(200).json(record)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'error in updating results' })
  }
}
