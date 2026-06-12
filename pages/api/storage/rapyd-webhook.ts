import { createHmac } from 'crypto'
import Airtable, { FieldSet } from 'airtable'
import { NextApiRequest, NextApiResponse } from 'next'
import getAppConfig from '../../../modules/config'

export const config = { api: { bodyParser: false } }

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'

const getRawBody = (req: NextApiRequest): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const rawBody = await getRawBody(req)
    const payload = JSON.parse(rawBody.toString())

    // Fail closed: if the webhook secret isn't configured, refuse every
    // request. The old `if (webhookSecret)` made signature verification
    // optional — without the env var, a forged POST to this endpoint
    // could mark any storage booking as paid without anyone paying. We
    // would rather a misconfigured deploy 500 (loud) than silently
    // accept unauthenticated traffic (quiet → real money lost).
    const webhookSecret = process.env.RAPYD_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error(
        '[Storage Rapyd Webhook] RAPYD_WEBHOOK_SECRET is not set; refusing request'
      )
      return res.status(500).end()
    }
    const sig = req.headers['rapyd-signature'] as string
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
    if (sig !== expected) {
      console.error('[Storage Rapyd Webhook] Signature mismatch')
      return res.status(401).end()
    }

    const eventType: string = payload.type
    const data = payload.data

    if (
      eventType === 'PAYMENT_COMPLETED' ||
      eventType === 'CHECKOUT_PAYMENT_COMPLETED'
    ) {
      const bookingId: string | undefined =
        data?.metadata?.bookingId || data?.payment?.metadata?.bookingId
      const paymentId: string | undefined = data?.id || data?.payment?.id

      if (bookingId) {
        const {
          serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
        } = getAppConfig()
        Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
        const table = Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)
        await table.update(bookingId, {
          'Payment Status': 'Paid',
          ...(paymentId ? { 'Rapyd Payment ID': paymentId } : {}),
        } as FieldSet)
        console.log('[Storage Rapyd Webhook] Marked paid:', bookingId)
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('[Storage Rapyd Webhook] Error:', err)
    return res.status(500).end()
  }
}
