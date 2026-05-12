import { NextApiRequest, NextApiResponse } from 'next'
import { getTable, minifyItems } from '../../../utils/airtable'
import { findOrCreateCustomer, sendInvoice } from '../../../modules/paydayAPI'

// This handler updates a specific records paid status to true. It should only be called by a Rapyd webhook.
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

    // Fire-and-await the Payday invoice if Kennitala is present and not already invoiced.
    // Failures are logged but never break the webhook ack — Rapyd retries (or any later
    // re-invocation) will re-check the idempotency flag and skip if already sent.
    await maybeSendPaydayInvoice(table, record!.id, record!.fields)

    res.status(200).json(record)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'error in updating results' })
  }
}

async function maybeSendPaydayInvoice(
  table: ReturnType<typeof getTable>,
  airtableRecordId: string,
  fields: Record<string, any>
): Promise<void> {
  try {
    const kennitala = String(fields['Kennitala'] ?? '').trim()
    if (!kennitala) return
    if (fields['Payday Invoice Sent'] === true) return

    const name = String(fields['Nafn viðskiptavinar'] ?? '').trim()
    const email = String(fields['Tölvupóstfang'] ?? '').trim()
    // Heimilisfang is the bag pickup address, not the billing address — we
    // intentionally don't pass it; Payday resolves the registry address by ssn.
    const grossAmount = Number(fields['Upphæð'] ?? 0)
    const bagCount = Number(fields['Töskufjöldi_no'] ?? 0)
    const oddSizeCount = Number(fields['Töskufjöldi_no_yfirstærð'] ?? 0)
    const totalBags = bagCount + oddSizeCount

    if (!email || !name || grossAmount <= 0 || totalBags <= 0) {
      console.warn(
        `[payday] skip invoice for ${airtableRecordId}: missing required field`,
        { hasName: !!name, hasEmail: !!email, grossAmount, totalBags }
      )
      return
    }

    const customer = await findOrCreateCustomer({
      ssn: kennitala.replace(/\D/g, ''),
      name,
      email,
    })

    const invoice = await sendInvoice({
      customerId: customer.id,
      description: 'Töskuþjónusta',
      quantity: totalBags,
      grossUnitPriceIsk: grossAmount / totalBags,
    })

    await table.update(airtableRecordId, {
      'Payday Invoice Sent': true,
      'Payday Invoice ID': invoice.id,
    })

    console.log(
      `[payday] invoice ${invoice.id} sent to ${email} for record ${airtableRecordId}`
    )
  } catch (err) {
    console.error('[payday] invoice send failed (will retry on next webhook):', err)
  }
}
