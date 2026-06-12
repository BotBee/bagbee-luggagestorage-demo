import https from 'https'
import { NextApiRequest, NextApiResponse } from 'next'
import Airtable, { FieldSet } from 'airtable'
import { generateRandomString, sign } from '../../../common/rapyd-helper'
import getAppConfig from '../../../modules/config'
import { notifyConfirmationEmail } from '../../../utils/notifyConfirmation'

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

  const { bookingId, kind } = (req.body || {}) as {
    bookingId?: string
    kind?: 'initial' | 'topup'
  }
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

    // -------------------------------------------------------------
    // Top-up confirmation path (self-service edit payment)
    // -------------------------------------------------------------
    if (kind === 'topup') {
      const pendingCheckoutId = record.fields['Pending Top-up Checkout ID'] as
        | string
        | undefined
      if (!pendingCheckoutId) {
        // No pending edit — webhook (or a prior confirm-topup) already
        // applied it and cleared the field. Idempotent OK.
        return res.status(200).json({ status: 'applied', alreadyApplied: true })
      }

      const topupCheckout = await getRapydCheckout(
        pendingCheckoutId,
        rapydBaseUrl as string,
        rapydAccessKey as string,
      )
      const topupPayment = topupCheckout?.data?.payment
      const topupMetadata = topupCheckout?.data?.metadata ?? {}

      if (topupPayment?.paid !== true) {
        return res.status(409).json({
          status: 'pending',
          message: 'Top-up payment not yet confirmed by Rapyd',
        })
      }

      let topup: Record<string, unknown>
      try {
        topup = JSON.parse(topupMetadata.topup || '{}')
      } catch {
        return res.status(500).json({ message: 'Invalid top-up metadata' })
      }

      const { applyStorageEdit } = await import('./[id]/edit')
      // Prefer the newTotal stamped into metadata by the edit endpoint (already
      // computed with the booking's rate profile); fall back to recomputing
      // from the record's Reference for older checkouts.
      const metaTotal = Number(topupMetadata.newTotal)
      let newTotal = Number.isFinite(metaTotal) && metaTotal > 0 ? metaTotal : NaN
      if (!Number.isFinite(newTotal)) {
        const { calcStoragePrice, getStorageRates } = await import(
          '../../../utils/storagePricing'
        )
        newTotal = calcStoragePrice(
          topup as any,
          getStorageRates(record.fields['Reference'] as string | undefined),
        ).total
      }
      await applyStorageEdit(table, bookingId, topup as any, newTotal)
      await table
        .update(bookingId, { 'Pending Top-up Checkout ID': '' } as FieldSet)
        .catch(() => undefined)
      return res.status(200).json({ status: 'applied', newTotal })
    }

    // -------------------------------------------------------------
    // Initial booking confirmation path
    // -------------------------------------------------------------

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
      'Paid?': true,
      'Rapyd Payment ID': paymentId,
    } as FieldSet)

    // Instantly trigger the Make confirmation-email scenario.
    await notifyConfirmationEmail(bookingId)

    // Storage confirmation email is sent by the Airtable automation "Payment
    // confirmation for BSI storage" (triggers on Paid?). We do NOT send from
    // code — that storageMailer path was test scaffolding and caused duplicate
    // emails.

    return res.status(200).json({ status: 'Paid', paymentId })
  } catch (err) {
    console.error('[Storage confirm-payment] Failed:', err)
    return res.status(500).json({ message: 'Could not confirm payment' })
  }
}
