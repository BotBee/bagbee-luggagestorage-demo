import https from 'https'
import { NextApiRequest, NextApiResponse } from 'next'
import Airtable, { FieldSet, Table } from 'airtable'
import { generateRandomString, sign } from '../../../common/rapyd-helper'
import getAppConfig from '../../../modules/config'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'
const SITE_URL = 'https://www.bagbee.is'

const getStorageTable = (): Table<FieldSet> => {
  const {
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
  } = getAppConfig()
  Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
  return Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)
}

const createRapydCheckout = (
  amount: number,
  bookingId: string,
  rapydBaseUrl: string,
  rapydAccessKey: string
): Promise<any> => {
  const path = '/v1/checkout'
  const body = {
    amount,
    currency: 'ISK',
    country: 'IS',
    language: 'EN',
    complete_payment_url: `${SITE_URL}/storage/payment-success?bookingId=${bookingId}`,
    error_payment_url: `${SITE_URL}/storage/payment-cancel?bookingId=${bookingId}`,
    // Server-side fallback: marks payment Paid even if browser redirect fails
    webhook_url: `${SITE_URL}/api/storage/rapyd-webhook`,
    metadata: { bookingId },
  }
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
  } = getAppConfig()

  const { totalAmountIsk, ...fields } = req.body as Record<string, unknown>

  try {
    const table = getStorageTable()

    // 1. Create Airtable record with Pending payment status
    const created = await table.create([
      {
        fields: {
          ...fields,
          'Payment Status': 'Pending',
          'Total Amount ISK': totalAmountIsk,
        } as FieldSet,
      },
    ])
    const bookingId = created[0].id

    // 2. Create Rapyd checkout
    const checkout = await createRapydCheckout(
      Number(totalAmountIsk),
      bookingId,
      rapydBaseUrl as string,
      rapydAccessKey as string
    )

    const checkoutId: string | undefined = checkout.data?.id
    const redirectUrl: string | undefined = checkout.data?.redirect_url

    // 3. Save checkout ID back to the record
    if (checkoutId) {
      await table.update(bookingId, { 'Rapyd Checkout ID': checkoutId } as FieldSet)
    }

    return res.status(200).json({ bookingId, redirectUrl })
  } catch (err) {
    console.error('[Storage checkout] Failed:', err)
    return res.status(500).json({ message: (err as Error).message || 'Checkout failed' })
  }
}
