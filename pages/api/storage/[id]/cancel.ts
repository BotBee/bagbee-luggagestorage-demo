import Airtable, { FieldSet } from 'airtable'
import { NextApiRequest, NextApiResponse } from 'next'
import getAppConfig from '../../../../modules/config'
import { refundStorageBooking } from '../../../../utils/rapydRefund'

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
      const result = await refundStorageBooking(
        table,
        id,
        rapydBaseUrl as string,
        rapydAccessKey as string,
      )
      if (result.status === 'refunded' || result.status === 'already_refunded') {
        // refundStorageBooking flipped status to 'Refunded' itself
        return res.status(200).json({ status: 'Refunded' })
      }
      if (result.status === 'no_payment') {
        // Paid but no payment ID — mark Cancelled and let CS reconcile.
        console.warn(
          '[Storage cancel] Paid booking has no Rapyd Payment ID — manual refund required:',
          id,
        )
        await table.update(id, { 'Payment Status': 'Cancelled' } as FieldSet)
        return res.status(200).json({
          status: 'Cancelled',
          warning: 'Manual refund required — payment ID missing',
        })
      }
    }

    if (currentStatus === 'Pending') {
      await table.update(id, { 'Payment Status': 'Cancelled' } as FieldSet)
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
