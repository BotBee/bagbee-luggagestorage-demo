/**
 * Ping the Make scenario "BSI Storage — payment confirmation email" the instant
 * a booking is marked Paid, so the customer's confirmation email goes out in
 * ~1 second instead of waiting for a polling interval.
 *
 * The Make scenario is webhook-triggered: it receives `{ recordId }`, looks the
 * record up, and (if not already emailed) sends the source-branded confirmation
 * and ticks `Confirmation Email Sent`. Dedup lives in Make (the search formula
 * filters out already-sent records), so calling this more than once for the
 * same booking is safe.
 *
 * Fire-and-forget + never throws — a failed ping must never break the payment
 * flow. If the webhook is unreachable, the booking is still marked Paid; you'd
 * just re-send manually (or could re-add a polling fallback).
 */
const FALLBACK_WEBHOOK_URL =
  'https://hook.eu1.make.com/jv6d6eto3n11txydomkk4gk57u6lqrl5'

export async function notifyConfirmationEmail(recordId?: string): Promise<void> {
  const url = process.env.MAKE_CONFIRMATION_WEBHOOK_URL || FALLBACK_WEBHOOK_URL
  if (!url || !recordId) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId }),
    })
  } catch (err) {
    console.error('[confirmation-webhook] ping failed for', recordId, err)
  }
}

/**
 * Ping the Make scenario "BSI Storage — update & cancel emails" when a paid
 * booking is edited or cancelled. The scenario routes on `event`:
 *   - 'updated'   → "your booking has been updated" email (with new summary)
 *   - 'cancelled' → "your booking has been cancelled" email; the refund line is
 *                   driven by `refunded` ('true' → full refund issued).
 *
 * Fire-and-forget + never throws — a failed ping must never break the
 * edit/cancel flow.
 */
const FALLBACK_EVENT_WEBHOOK_URL =
  'https://hook.eu1.make.com/6mmhewrct64kvhsbak2ehbj1svxm1vyy'

export async function notifyBookingEvent(
  recordId: string | undefined,
  event: 'updated' | 'cancelled',
  refunded?: boolean,
): Promise<void> {
  const url = process.env.MAKE_BOOKING_EVENT_WEBHOOK_URL || FALLBACK_EVENT_WEBHOOK_URL
  if (!url || !recordId) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, event, refunded: refunded ? 'true' : 'false' }),
    })
  } catch (err) {
    console.error('[booking-event-webhook] ping failed for', recordId, event, err)
  }
}
