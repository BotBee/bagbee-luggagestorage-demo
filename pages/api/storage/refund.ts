import Airtable from 'airtable'
import { NextApiRequest, NextApiResponse } from 'next'
import getAppConfig from '../../../modules/config'
import { refundStorageBooking } from '../../../utils/rapydRefund'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'

/**
 * Secret-protected refund endpoint. Used by the Airtable automation that
 * picks up `Payment Status` flipping to `Cancelled` and reconciles via Rapyd.
 *
 * For customer-initiated cancels (where exposing a secret to the browser is
 * not acceptable) use POST `/api/storage/[id]/cancel` instead — that endpoint
 * does the same refund via the shared helper, auth'd by virtue of being
 * server-to-server.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const {
    publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl, storageRefundSecret },
  } = getAppConfig()

  // Require secret header — prevents anyone with a bookingId from triggering refunds
  const providedSecret = req.headers['x-refund-secret']
  if (!storageRefundSecret || providedSecret !== storageRefundSecret) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  const { bookingId } = req.body as { bookingId: string }
  if (!bookingId) return res.status(400).json({ message: 'bookingId required' })

  try {
    Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
    const table = Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)

    const result = await refundStorageBooking(
      table,
      bookingId,
      rapydBaseUrl as string,
      rapydAccessKey as string,
    )

    if (result.status === 'no_payment') {
      return res
        .status(400)
        .json({ message: 'No payment ID on record — cannot refund' })
    }
    if (result.status === 'already_refunded') {
      return res.status(200).json({ success: true, alreadyRefunded: true })
    }
    return res.status(200).json({ success: true, refund: result.refund })
  } catch (err) {
    console.error('[Storage refund] Failed:', err)
    return res.status(500).json({ message: 'Refund failed' })
  }
}
