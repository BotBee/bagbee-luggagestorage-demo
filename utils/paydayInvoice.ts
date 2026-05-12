import type { FieldSet, Table } from 'airtable'
import { findOrCreateCustomer, sendInvoice } from '../modules/paydayAPI'

/**
 * Idempotent: send a Payday invoice for an Airtable order if it has a
 * Kennitala filled and hasn't already been invoiced.
 *
 * Called from every code path that flips Greitt → true:
 *   - /api/payment/webhooks (Rapyd's canonical PAYMENT_COMPLETED webhook)
 *   - /api/airtable/mark-paid-by-order-no (optimistic from success page)
 *   - /api/airtable/update-paid-status (legacy/surcharge path)
 *
 * Failures are logged but never thrown — the calling handler should always
 * be able to return 200/whatever to its caller regardless of Payday state.
 * Re-runs are safe: the "Payday Invoice Sent" Airtable flag prevents
 * duplicate invoices when multiple paths race.
 */
export async function maybeSendPaydayInvoiceForOrder(
  table: Table<FieldSet>,
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
