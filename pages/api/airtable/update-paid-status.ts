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
    const paydayResult = await maybeSendPaydayInvoice(table, record!.id, record!.fields)

    res.status(200).json({ ...record, _paydayDebug: paydayResult })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'error in updating results' })
  }
}

async function maybeSendPaydayInvoice(
  table: ReturnType<typeof getTable>,
  airtableRecordId: string,
  fields: Record<string, any>
): Promise<Record<string, any>> {
  const trace: Record<string, any> = { step: 'start' }
  try {
    const kennitala = String(fields['Kennitala'] ?? '').trim()
    if (!kennitala) {
      trace.step = 'skip_no_kennitala'
      return trace
    }
    if (fields['Payday Invoice Sent'] === true) {
      trace.step = 'skip_already_sent'
      return trace
    }

    const name = String(fields['Nafn viðskiptavinar'] ?? '').trim()
    const email = String(fields['Tölvupóstfang'] ?? '').trim()
    const grossAmount = Number(fields['Upphæð'] ?? 0)
    const bagCount = Number(fields['Töskufjöldi_no'] ?? 0)
    const oddSizeCount = Number(fields['Töskufjöldi_no_yfirstærð'] ?? 0)
    const totalBags = bagCount + oddSizeCount

    trace.fieldsRead = { hasName: !!name, hasEmail: !!email, grossAmount, totalBags, kennitala }
    trace.envPresent = {
      baseUrl: !!process.env.PAYDAY_BASE_URL,
      clientId: !!process.env.PAYDAY_CLIENT_ID,
      clientSecret: !!process.env.PAYDAY_CLIENT_SECRET,
    }

    if (!email || !name || grossAmount <= 0 || totalBags <= 0) {
      trace.step = 'skip_missing_field'
      console.warn(
        `[payday] skip invoice for ${airtableRecordId}: missing required field`,
        trace.fieldsRead
      )
      return trace
    }

    trace.step = 'find_or_create_customer'
    const customer = await findOrCreateCustomer({
      ssn: kennitala.replace(/\D/g, ''),
      name,
      email,
    })
    trace.customerId = customer.id

    trace.step = 'send_invoice'
    const invoice = await sendInvoice({
      customerId: customer.id,
      description: 'Töskuþjónusta',
      quantity: totalBags,
      grossUnitPriceIsk: grossAmount / totalBags,
    })
    trace.invoiceId = invoice.id

    trace.step = 'stamp_airtable'
    await table.update(airtableRecordId, {
      'Payday Invoice Sent': true,
      'Payday Invoice ID': invoice.id,
    })

    trace.step = 'success'
    console.log(
      `[payday] invoice ${invoice.id} sent to ${email} for record ${airtableRecordId}`
    )
    return trace
  } catch (err: any) {
    trace.error = String(err?.message ?? err)
    trace.errorStack = String(err?.stack ?? '').split('\n').slice(0, 5)
    console.error('[payday] invoice send failed (will retry on next webhook):', err)
    return trace
  }
}
