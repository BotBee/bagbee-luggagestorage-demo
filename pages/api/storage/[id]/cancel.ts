import Airtable, { FieldSet } from 'airtable'
import { NextApiRequest, NextApiResponse } from 'next'
import getAppConfig from '../../../../modules/config'
import { refundStorageBooking } from '../../../../utils/rapydRefund'
import { hoursUntilDropoff } from '../../../../utils/dropoffTiming'
import { notifyBookingEvent } from '../../../../utils/notifyConfirmation'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'

/**
 * Customer-initiated cancel + auto-refund.
 *
 * Called from `/storage/[id]` when the customer hits "Cancel booking". Wraps
 * the refund flow that the browser used to do in two calls (POST refund +
 * PATCH status) — that two-call flow was broken since `/api/storage/refund`
 * now requires a server-side secret header.
 *
 * Behaviour by current status:
 *   Cancelled / Refunded → idempotent no-op, returns 200
 *   Paid                 → Rapyd refund first, then mark Refunded
 *   Pending              → just mark Cancelled (nothing to refund)
 *   anything else        → 409
 *
 * If a Paid booking is missing its `Rapyd Payment ID` (legacy or stuck
 * record) we still mark it Cancelled rather than leaving the customer
 * stranded — CS will reconcile manually. That's logged loudly.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { id } = req.query as { id?: string }
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Missing booking id' })
  }

  const {
    publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
  } = getAppConfig()

  try {
    Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
    const table = Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)

    let record
    try {
      record = await table.find(id)
    } catch {
      return res.status(404).json({ message: 'Booking not found' })
    }

    const currentStatus = record.fields['Payment Status'] as string | undefined

    // Idempotent terminal states
    if (currentStatus === 'Cancelled') {
      return res.status(200).json({ status: 'Cancelled' })
    }
    if (currentStatus === 'Refunded') {
      return res.status(200).json({ status: 'Refunded' })
    }

    if (currentStatus === 'Paid') {
      // Policy: full refund only when cancelling 24h+ before drop-off. Inside
      // 24h the booking is cancelled with NO automatic refund.
      const hoursUntil = hoursUntilDropoff(
        record.fields['ArrivalDate'] as string,
        record.fields['Arrival time'] as string,
      )
      if (hoursUntil !== null && hoursUntil < 24) {
        await table.update(id, { 'Payment Status': 'Cancelled', 'Paid?': false } as FieldSet)
        await notifyBookingEvent(id, 'cancelled', false)
        return res.status(200).json({ status: 'Cancelled', refunded: false, lateCancel: true })
      }

      const result = await refundStorageBooking(
        table,
        id,
        rapydBaseUrl as string,
        rapydAccessKey as string,
      )
      if (result.status === 'refunded') {
        // refundStorageBooking flipped status to 'Refunded' + unticked Paid?
        await notifyBookingEvent(id, 'cancelled', true)
        return res.status(200).json({ status: 'Refunded', refunded: true })
      }
      if (result.status === 'already_refunded') {
        return res.status(200).json({ status: 'Refunded', refunded: true })
      }
      if (result.status === 'no_payment') {
        // Paid but no payment ID — mark Cancelled and let CS reconcile.
        console.warn(
          '[Storage cancel] Paid booking has no Rapyd Payment ID — manual refund required:',
          id,
        )
        await table.update(id, { 'Payment Status': 'Cancelled', 'Paid?': false } as FieldSet)
        await notifyBookingEvent(id, 'cancelled', false)
        return res.status(200).json({
          status: 'Cancelled',
          warning: 'Manual refund required — payment ID missing',
        })
      }
    }

    if (currentStatus === 'Pending') {
      await table.update(id, { 'Payment Status': 'Cancelled', 'Paid?': false } as FieldSet)
      await notifyBookingEvent(id, 'cancelled', false)
      return res.status(200).json({ status: 'Cancelled' })
    }

    return res
      .status(409)
      .json({ message: `Cannot cancel from status "${currentStatus ?? 'unknown'}"` })
  } catch (err) {
    console.error('[Storage cancel] Failed:', err)
    return res.status(500).json({ message: 'Cancel failed' })
  }
}
