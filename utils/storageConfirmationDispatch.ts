// Read a paid storage booking out of Airtable and dispatch the customer
// confirmation email — but only if it hasn't already been sent.
//
// Called from BOTH:
//   - /api/payment/webhooks (Rapyd webhook path — fires for every payment)
//   - /api/storage/confirm-payment (browser redirect path)
//
// The two paths can race. Idempotency is enforced by the Airtable
// `Confirmation Email Sent` checkbox — first call wins, the second is a
// no-op. We update the checkbox AFTER the send so a transient SMTP error
// can still retry on the next call.

import { FieldSet, Table } from 'airtable'
import { sendStorageConfirmation } from './storageMailer'

export async function maybeSendStorageConfirmation(
  table: Table<FieldSet>,
  bookingId: string,
): Promise<void> {
  let record
  try {
    record = await table.find(bookingId)
  } catch (err) {
    console.error('[storage-confirmation] Booking not found:', bookingId, err)
    return
  }
  const f = record.fields as Record<string, any>

  if (f['Confirmation Email Sent'] === true) {
    return // already sent — nothing to do
  }

  const customerEmail = (f['Email'] as string | undefined)?.trim()
  if (!customerEmail) {
    console.warn(
      '[storage-confirmation] No customer email on booking — skipping:',
      bookingId,
    )
    return
  }

  await sendStorageConfirmation({
    bookingId,
    bookingNumber: f['Booking Number'] as string | undefined,
    customerName: f['Name'] as string | undefined,
    customerEmail,
    arrivalDate: f['ArrivalDate'] as string | undefined,
    arrivalTime: f['Arrival time'] as string | undefined,
    departureDate: f['Departure date'] as string | undefined,
    departureTime: f['Departure time'] as string | undefined,
    luggage: Number(f['Luggage']) || 0,
    backpacks: Number(f['Backpack / Purse (ISK 1000 pr. item)']) || 0,
    totalIsk: Number(f['Total Amount ISK']) || 0,
    delivery: !!f['Delivery Service'],
    hotelName: f['Hotel or Cruise ship name'] as string | undefined,
    hotelAddress: f['Delivery Address'] as string | undefined,
  })

  // Mark sent — best-effort. If this fails the next call may resend, which
  // is preferable to silently dropping the email on a transient Airtable
  // error.
  await table
    .update(bookingId, { 'Confirmation Email Sent': true } as FieldSet)
    .catch((err) =>
      console.error('[storage-confirmation] Failed to mark sent flag:', err),
    )
}
