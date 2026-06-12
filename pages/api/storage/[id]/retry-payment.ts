import Airtable, { FieldSet } from 'airtable'
import { NextApiRequest, NextApiResponse } from 'next'
import getAppConfig from '../../../../modules/config'
import { createRetryCheckout } from '../../../../utils/retryCheckout'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'

/**
 * Re-open a Rapyd checkout for an existing Pending storage booking so the
 * customer can retry a failed/cancelled payment without re-entering anything.
 *
 * POST /api/storage/[id]/retry-payment  →  { redirectUrl }
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

    const status = record.fields['Payment Status'] as string | undefined
    if (status === 'Paid' || status === 'Refunded') {
      return res.status(409).json({ message: 'This booking is already paid.', status })
    }
    if (status === 'Cancelled') {
      return res.status(409).json({ message: 'This booking was cancelled.', status })
    }

    const amount = Number(record.fields['Total Amount ISK']) || 0
    if (!(amount > 0)) {
      return res.status(400).json({ message: 'Nothing to charge on this booking.' })
    }

    const checkout = await createRetryCheckout({
      amount,
      bookingId: id,
      product: 'storage',
      rapydBaseUrl: rapydBaseUrl as string,
      rapydAccessKey: rapydAccessKey as string,
    })
    const checkoutId: string | undefined = checkout.data?.id
    const redirectUrl: string | undefined = checkout.data?.redirect_url

    if (checkoutId) {
      await table.update(id, { 'Rapyd Checkout ID': checkoutId } as FieldSet)
    }
    if (!redirectUrl) {
      return res.status(500).json({ message: 'Failed to create payment link' })
    }

    return res.status(200).json({ redirectUrl })
  } catch (err) {
    console.error('[Storage retry] Failed:', err)
    return res.status(500).json({ message: 'Could not restart payment.' })
  }
}
