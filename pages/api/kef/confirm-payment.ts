/**
 * POST /api/kef/confirm-payment { bookingId }
 *
 * Redirect-path safety net for the confirmation email: when the customer lands
 * on /kef/payment-success, this fires the booking-confirmation email (with the
 * manage-order link) if the booking is already Paid. It does NOT mark a booking
 * Paid — that's the Rapyd-signed webhook's job. Idempotent (the mailer no-ops
 * if already sent), so it can race the webhook safely.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { findKefBooking } from '../../../utils/kefBooking'
import { sendKefConfirmation } from '../../../utils/kefConfirmationMailer'
import { FLD } from '../../../utils/kefLockersAirtable'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { bookingId } = (req.body || {}) as { bookingId?: string }
  if (!bookingId) return res.status(400).json({ message: 'Missing bookingId' })

  try {
    const lead = await findKefBooking(bookingId)
    if (!lead) return res.status(404).json({ message: 'Booking not found' })
    const status = (lead.fields as any)[FLD.bookings.paymentStatus] as string | undefined
    if (status === 'Paid') {
      await sendKefConfirmation(lead.id)
    }
    return res.status(200).json({ status: status || 'Pending' })
  } catch (err) {
    console.error('[KEF confirm-payment] failed:', err)
    return res.status(200).json({ status: 'unknown' })
  }
}
