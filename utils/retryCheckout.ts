import https from 'https'
import { generateRandomString, sign } from '../common/rapyd-helper'

const SITE_URL = 'https://www.bagbee.is'

/**
 * Create a FRESH Rapyd checkout for an EXISTING Pending booking so the customer
 * can retry payment without re-filling the form (feedback item: "If payment
 * fails, offer to try again payment, not fill everything out again").
 *
 * Mirrors the metadata/redirect shape of each product's initial checkout so the
 * shared Rapyd webhook routes the payment correctly:
 *   - storage  → metadata { bookingId }                (generic storage branch)
 *   - bikerent → metadata { bookingId, tableType }     (bikerent branch)
 *
 * A unique idempotency key + merchant_reference_id is used per attempt so Rapyd
 * issues a new checkout rather than returning the stale/expired one.
 */
export const createRetryCheckout = (opts: {
  amount: number
  bookingId: string
  product: 'storage' | 'bikerent'
  rapydBaseUrl: string
  rapydAccessKey: string
}): Promise<any> => {
  const { amount, bookingId, product, rapydBaseUrl, rapydAccessKey } = opts
  const successUrl = `${SITE_URL}/${product}/payment-success?bookingId=${bookingId}`
  const cancelUrl = `${SITE_URL}/${product}/payment-cancel?bookingId=${bookingId}`
  const nonce = Date.now()
  const path = '/v1/checkout'
  const body = {
    amount,
    currency: 'ISK',
    country: 'IS',
    language: 'EN',
    complete_payment_url: successUrl,
    error_payment_url: cancelUrl,
    // Wallets (Apple Pay) complete inline and follow complete_checkout_url.
    complete_checkout_url: successUrl,
    cancel_checkout_url: cancelUrl,
    merchant_reference_id: `bagbee-${product}-${bookingId}-retry-${nonce}`,
    metadata:
      product === 'bikerent'
        ? { bookingId, tableType: 'bikerent' }
        : { bookingId },
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
          idempotency: `${bookingId}-${product}-retry-${nonce}`,
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
            reject(new Error(`Rapyd non-JSON ${res.statusCode}: ${data.slice(0, 200)}`))
          }
        })
      },
    )
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}
