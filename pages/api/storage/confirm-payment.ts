import https from 'https'
import { NextApiRequest, NextApiResponse } from 'next'
import Airtable, { FieldSet } from 'airtable'
import { generateRandomString, sign } from '../../../common/rapyd-helper'
import getAppConfig from '../../../modules/config'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'

/**
 * Called by `/storage/payment-success` after Rapyd redirects the customer back
 * post-payment. It asks Rapyd whether the checkout was actually paid (the
 * source of truth) and — if so — marks the Airtable booking Paid and writes
 * `Rapyd Payment ID` for future refunds.
 *
 * This closes two issues:
 *   1. The previous flow had the browser PATCH `Payment Status: 'Paid'`
 *      against an unauthenticated endpoint. Anyone with a record ID could
 *      mark bookings paid; now the server verifies with Rapyd directly.
 *   2. The previous flow never wrote `Rapyd Payment ID` from the redirect
 *      path — only the webhook did. If the webhook missed (signature
 *      mismatch, transient error), refunds for that booking later failed
 *      with "No payment ID on record". Now redirect + webhook both write it.
 *
 * Idempotent: returns 200 with the current status if already Paid/Refunded.
 */

const getRapydCheckout = (
  checkoutId: string,
  rapydBaseUrl: string,
  rapydAccessKey: string,
): Promise<any> => {
  const path = `/v1/checkout/${checkoutId}`
  const salt = generateRandomString(8)
  const timestamp = Math.round(Date.now() / 1000)
  const signature = sign('GET', path, salt, timestamp, '')

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: rapydBaseUrl,
        port: 443,
        path,
        method: 'GET',
        headers: {
          'content-Type': 'application/json',
          salt,
          timestamp,
          signature,
          access_key: rapydAccessKey,
        },
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (res.statusCode !== 200) return reject(parsed)
            resolve(parsed)
          } catch {
            reject(
              new Error(
                `Rapyd returned non-JSON (${res.statusCode}): ${data.slice(0, 200)}`,
              ),
            )
          }
        })
      },
    )
    req.on('error', reject)
    req.end()
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const {
    publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
  } = getAppConfig()

  const { bookingId } = (req.body || {}) as { bookingId?: string }
  if (!bookingId || typeof bookingId !== 'string') {
    return res.status(400).json({ message: 'bookingId required' })
  }

  try {
    Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
    const table = Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)

    let record
    try {
      record = await table.find(bookingId)
    } catch {
      return res.status(404).json({ message: 'Booking not found' })
    }

    const currentStatus = record.fields['Payment Status'] as string | undefined

    // Already finalised — webhook or a prior confirm-payment call beat us here.
    if (currentStatus === 'Paid' || currentStatus === 'Refunded') {
      return res.status(200).json({ status: currentStatus, alreadyConfirmed: true })
    }

    const checkoutId = record.fields['Rapyd Checkout ID'] as string | undefined
    if (!checkoutId) {
      return res.status(400).json({ message: 'No checkout on this booking' })
    }

    const checkout = await getRapydCheckout(
      checkoutId,
      rapydBaseUrl as string,
      rapydAccessKey as string,
    )
    const payment = checkout?.data?.payment
    const paid = payment?.paid === true
    const paymentId: string | undefined = payment?.id

    if (!paid || !paymentId) {
      // Customer was redirected back but Rapyd hasn't actually captured the
      // payment yet (or it failed). Don't flip Airtable — let the webhook
      // (which fires when Rapyd is done) handle it. UI can poll or just show
      // a "still processing" message.
      return res
        .status(409)
        .json({ status: currentStatus, message: 'Payment not yet confirmed by Rapyd' })
    }

    await table.update(bookingId, {
      'Payment Status': 'Paid',
      'Rapyd Payment ID': paymentId,
    } as FieldSet)

    return res.status(200).json({ status: 'Paid', paymentId })
  } catch (err) {
    console.error('[Storage confirm-payment] Failed:', err)
    return res.status(500).json({ message: 'Could not confirm payment' })
  }
}
