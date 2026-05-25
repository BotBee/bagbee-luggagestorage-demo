import https from 'https'
import { FieldSet, Table } from 'airtable'
import { generateRandomString, sign } from '../common/rapyd-helper'

/**
 * Wraps Rapyd's POST /v1/refunds. Used by both the secret-protected refund
 * endpoint (called by Airtable automations) and the customer-facing cancel
 * endpoint (called from the order page).
 *
 * Stable idempotency key per paymentId means accidental double-calls don't
 * issue two refunds — Rapyd returns the existing refund instead.
 */
const callRapydRefund = (
  paymentId: string,
  rapydBaseUrl: string,
  rapydAccessKey: string,
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
          idempotency: `${paymentId}-refund`,
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
    req.write(bodyStr)
    req.end()
  })
}

export type RefundResult =
  | { status: 'refunded'; refund: any; paymentId: string }
  | { status: 'no_payment'; message: string }
  | { status: 'already_refunded' }

/**
 * Refund the storage booking. Idempotent:
 *   - already 'Refunded'        → returns 'already_refunded' (no Rapyd call)
 *   - no Rapyd Payment ID       → returns 'no_payment'
 *   - otherwise                  → Rapyd refund + Airtable status update
 *
 * The caller is responsible for any auth / permission checks before calling
 * this. This helper only knows about the booking + payment relationship.
 */
export async function refundStorageBooking(
  table: Table<FieldSet>,
  bookingId: string,
  rapydBaseUrl: string,
  rapydAccessKey: string,
): Promise<RefundResult> {
  const record = await table.find(bookingId)
  const currentStatus = record.fields['Payment Status'] as string | undefined
  if (currentStatus === 'Refunded') return { status: 'already_refunded' }

  const paymentIdRaw = record.fields['Rapyd Payment ID'] as string | undefined
  if (!paymentIdRaw) return { status: 'no_payment', message: 'No payment ID on record' }

  // Legacy refunds appended " (refunded)" to the field — treat those as done.
  if (paymentIdRaw.includes('(refunded)')) return { status: 'already_refunded' }

  const paymentId = paymentIdRaw.trim()
  const refund = await callRapydRefund(paymentId, rapydBaseUrl, rapydAccessKey)

  await table.update(bookingId, {
    'Payment Status': 'Refunded',
    'Rapyd Payment ID': `${paymentId} (refunded)`,
  } as FieldSet)

  return { status: 'refunded', refund: refund.data, paymentId }
}
