import https from 'https'
import { NextApiRequest, NextApiResponse } from 'next'
import Airtable, { FieldSet } from 'airtable'
import { generateRandomString, sign } from '../../../common/rapyd-helper'
import getAppConfig from '../../../modules/config'
import { calcBikerentPrice } from '../../../utils/bikerentPricing'
import { notifyConfirmationEmail } from '../../../utils/notifyConfirmation'

// BikeRent rows live in the writable BSI Storage table (Reference='bikerent.is').
const BSI_BIKERENT_TABLE_ID = 'tblMJtxJiHFDi3TTk'

/**
 * Called by /bikerent/payment-success after Rapyd redirects back. Verifies the
 * checkout with Rapyd directly (webhook fallback) and finalises the booking.
 * Mirrors /api/storage/confirm-payment.
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
        headers: { 'content-Type': 'application/json', salt, timestamp, signature, access_key: rapydAccessKey },
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
            reject(new Error(`Rapyd non-JSON (${res.statusCode}): ${data.slice(0, 200)}`))
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

  const { bookingId, kind } = (req.body || {}) as { bookingId?: string; kind?: 'initial' | 'topup' }
  if (!bookingId || typeof bookingId !== 'string') {
    return res.status(400).json({ message: 'bookingId required' })
  }

  try {
    Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
    const table = Airtable.base(airtableBaseId)(BSI_BIKERENT_TABLE_ID)

    let record
    try {
      record = await table.find(bookingId)
    } catch {
      return res.status(404).json({ message: 'Booking not found' })
    }

    const currentStatus = record.fields['Payment Status'] as string | undefined

    // ── Top-up confirmation (self-service edit) ──
    if (kind === 'topup') {
      const pendingCheckoutId = record.fields['Pending Top-up Checkout ID'] as string | undefined
      if (!pendingCheckoutId) {
        return res.status(200).json({ status: 'applied', alreadyApplied: true })
      }
      const topupCheckout = await getRapydCheckout(pendingCheckoutId, rapydBaseUrl as string, rapydAccessKey as string)
      const topupPayment = topupCheckout?.data?.payment
      const topupMetadata = topupCheckout?.data?.metadata ?? {}
      if (topupPayment?.paid !== true) {
        return res.status(409).json({ status: 'pending', message: 'Top-up payment not yet confirmed by Rapyd' })
      }
      let topup: Record<string, unknown>
      try {
        topup = JSON.parse(topupMetadata.topup || '{}')
      } catch {
        return res.status(500).json({ message: 'Invalid top-up metadata' })
      }
      const { applyBikerentEdit } = await import('./[id]/edit')
      const metaTotal = Number(topupMetadata.newTotal)
      const newTotal =
        Number.isFinite(metaTotal) && metaTotal > 0 ? metaTotal : calcBikerentPrice(topup as any).total
      await applyBikerentEdit(table, bookingId, topup as any, newTotal)
      await table.update(bookingId, { 'Pending Top-up Checkout ID': '' } as FieldSet).catch(() => undefined)
      return res.status(200).json({ status: 'applied', newTotal })
    }

    // ── Initial booking confirmation ──
    if (currentStatus === 'Paid' || currentStatus === 'Refunded') {
      return res.status(200).json({ status: currentStatus, alreadyConfirmed: true })
    }

    const checkoutId = record.fields['Rapyd Checkout ID'] as string | undefined
    if (!checkoutId) {
      return res.status(400).json({ message: 'No checkout on this booking' })
    }
    const checkout = await getRapydCheckout(checkoutId, rapydBaseUrl as string, rapydAccessKey as string)
    const payment = checkout?.data?.payment
    const paid = payment?.paid === true
    const paymentId: string | undefined = payment?.id
    if (!paid || !paymentId) {
      return res.status(409).json({ status: currentStatus, message: 'Payment not yet confirmed by Rapyd' })
    }

    await table.update(bookingId, {
      'Payment Status': 'Paid',
      'Paid?': true,
      'Rapyd Payment ID': paymentId,
    } as FieldSet)

    // Instantly trigger the Make confirmation-email scenario.
    await notifyConfirmationEmail(bookingId)

    // Confirmation email is sent by the Make scenario "BSI Storage — payment
    // confirmation email" (triggers on Paid?). Not from code.

    return res.status(200).json({ status: 'Paid', paymentId })
  } catch (err) {
    console.error('[BikeRent confirm-payment] Failed:', err)
    return res.status(500).json({ message: 'Could not confirm payment' })
  }
}
