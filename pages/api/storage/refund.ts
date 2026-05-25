import https from 'https'
import Airtable, { FieldSet } from 'airtable'
import { NextApiRequest, NextApiResponse } from 'next'
import { generateRandomString, sign } from '../../../common/rapyd-helper'
import getAppConfig from '../../../modules/config'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'

const rapydRefund = (
  paymentId: string,
  rapydBaseUrl: string,
  rapydAccessKey: string
): Promise<any> => {
  const path = '/v1/refunds'
  const body = { payment: paymentId }
  const salt = generateRandomString(8)
  const timestamp = Math.round(Date.now() / 1000)
  const signature = sign('POST', path, salt, timestamp, body)

  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body)
    const req = https.request(
      {
        hostname: rapydBaseUrl,
        port: 443,
        path,
        method: 'POST',
        headers: {
          'content-Type': 'application/json',
          salt,
          timestamp,
          signature,
          access_key: rapydAccessKey,
          idempotency: Date.now().toString(),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          const parsed = JSON.parse(data)
          if (res.statusCode !== 200) return reject(parsed)
          resolve(parsed)
        })
      }
    )
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

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
    const record = await table.find(bookingId)
    const paymentId = record.fields['Rapyd Payment ID'] as string

    if (!paymentId) {
      return res.status(400).json({ message: 'No payment ID on record — cannot refund' })
    }

    const refund = await rapydRefund(
      paymentId,
      rapydBaseUrl as string,
      rapydAccessKey as string
    )

    await table.update(bookingId, {
      'Payment Status': 'Refunded',
      'Rapyd Payment ID': `${paymentId} (refunded)`,
    } as FieldSet)

    return res.status(200).json({ success: true, refund: refund.data })
  } catch (err) {
    console.error('[Storage refund] Failed:', err)
    return res.status(500).json({ message: (err as Error).message || 'Refund failed' })
  }
}
