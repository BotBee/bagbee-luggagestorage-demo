// Read a paid BikeRent booking out of Airtable and dispatch the customer
// confirmation email — once. Called from both /api/payment/webhooks and
// /api/bikerent/confirm-payment; idempotent via the `Confirmation Email Sent`
// checkbox. Mirrors utils/storageConfirmationDispatch.ts.

import { FieldSet, Table } from 'airtable'
import { sendBikerentConfirmation } from './bikerentMailer'

export async function maybeSendBikerentConfirmation(
  table: Table<FieldSet>,
  bookingId: string,
): Promise<void> {
  let record
  try {
    record = await table.find(bookingId)
  } catch (err) {
    console.error('[bikerent-confirmation] Booking not found:', bookingId, err)
    return
  }
  const f = record.fields as Record<string, any>

  if (f['Confirmation Email Sent'] === true) return

  const customerEmail = (f['Email'] as string | undefined)?.trim()
  if (!customerEmail) {
    console.warn('[bikerent-confirmation] No customer email on booking — skipping:', bookingId)
    return
  }

  // BikeRent bookings are stored in BSI Storage; read the mapped fields.
  await sendBikerentConfirmation({
    bookingId,
    bookingNumber: f['Booking Number'] as string | undefined,
    customerName: f['Name'] as string | undefined,
    customerEmail,
    dropoffDate: f['ArrivalDate'] as string | undefined,
    dropoffTime: f['Arrival time'] as string | undefined,
    pickupDate: f['Departure date'] as string | undefined,
    pickupTime: f['Departure time'] as string | undefined,
    hardBoxes: Number(f['Luggage']) || 0,
    foldedBoxes: Number(f['Backpack / Purse (ISK 1000 pr. item)']) || 0,
    totalIsk: Number(f['Total Amount ISK']) || 0,
    lateCheckout: !!f['Late check-out (ISK 500 pr. bag)'],
  })

  await table
    .update(bookingId, { 'Confirmation Email Sent': true } as FieldSet)
    .catch((err) => console.error('[bikerent-confirmation] Failed to mark sent flag:', err))
}
