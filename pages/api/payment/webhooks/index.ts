import { NextApiRequest, NextApiResponse } from 'next'
import Airtable, { FieldSet } from 'airtable'
import { getFastTrackTable, getTable, minifyItems } from '../../../../utils/airtable'
import { sign } from '../../../../common/rapyd-helper'
import { maybeSendPaydayInvoiceForOrder } from '../../../../utils/paydayInvoice'
import getAppConfig from '../../../../modules/config'
import { Readable } from 'stream'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'

export const config = {
  api: {
    bodyParser: false,
  },
}

async function buffer(readable: Readable) {
  const chunks = []
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      console.warn('[api][payment][webhooks] method not allowed', req.method)
      return res.status(405).json({ message: 'Method not allowed' })
    }

    console.log('[api][payment][webhooks] webhook triggered')
    const buf = await buffer(req)
    const rawRequest = buf.toString('utf8')
    const request = JSON.parse(rawRequest)

    const rapydSecret = process.env.RAPYD_SECRET_KEY
    const rapydAccessKey = process.env.RAPYD_ACCESS_KEY
    if (!rapydSecret || !rapydAccessKey) {
      console.log('[api][payment][webhooks] Rapyd secret or access key is missing')
      return res.status(500).json({ message: 'Internal server error' })
    }

    const signature = sign(
      '', // no method for webhooks
      new URL(req.url || '', `https://${req.headers.host}`).toString(),
      String(req.headers['salt']),
      Number(req.headers['timestamp']),
      request,
    )

    console.log('[api][payment][webhooks] signature', signature)

    if (req.headers['signature'] !== signature) {
      console.log('[api][payment][webhooks] Invalid signature')
      return res.status(400).json({ message: 'Invalid signature' })
    }

    if (request.type === 'PAYMENT_COMPLETED' || request.type === 'CHECKOUT_PAYMENT_COMPLETED') {
      console.log('[api][payment][webhooks] metadata:', request.data.metadata)
      console.log('[api][payment][webhooks] payment id:', request.data.id)

      // Storage booking — identified by metadata.bookingId
      const bookingId: string | undefined =
        request.data.metadata?.bookingId || request.data.payment?.metadata?.bookingId
      if (bookingId) {
        const paymentId: string | undefined = request.data.id || request.data.payment?.id
        try {
          const {
            serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
          } = getAppConfig()
          Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
          const table = Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)
          await table.update(bookingId, {
            'Payment Status': 'Paid',
            ...(paymentId ? { 'Rapyd Payment ID': paymentId } : {}),
          } as FieldSet)
          console.log('[api][payment][webhooks] storage booking marked paid:', bookingId)
        } catch (error) {
          console.error('[api][payment][webhooks] Error marking storage booking paid', error)
          return res.status(500).json({ message: 'Error updating storage paid status' })
        }
        return res.status(200).json({ message: 'Payment success' })
      }

      // Regular baggage / fast-track booking
      const billingCountry = extractBillingCountry(request.data)
      console.log('[api][payment][webhooks] billing country:', billingCountry ?? '(not found)')
      try {
        await UpdatePaidStatus(
          request.data.metadata.recordId,
          request.data.metadata.tableType,
          request.data.id,
          billingCountry,
        )
      } catch (error) {
        console.error('[api][payment][webhooks] Error updating paid status', error)
        return res.status(500).json({ message: 'Error updating paid status' })
      }
    } else {
      console.log('[api][payment][webhooks] Invalid request type', request.type)
      return res.status(400).json({ message: 'Invalid request type' })
    }

    return res.status(200).json({ message: 'Payment success' })
  } catch (error) {
    console.error('[api][payment][webhooks] Error processing payment', error)
    return res.status(500).json({ message: 'Error processing payment' })
  }
}

const UpdatePaidStatus = async (
  recordId: string,
  tableType: 'baggage' | 'fast-track',
  paymentId?: string,
  billingCountry?: string,
) => {
  if (!recordId) {
    console.log('[api][payment][webhooks] record is missing')
    return
  }
  const table = tableType === 'baggage' ? getTable() : getFastTrackTable()
  const records = await table.select().all()
  const record = minifyItems(records).find((x) => x.id === recordId)
  if (!record) {
    console.error(`[api][payment][webhooks] Record with id ${recordId} not found`)
    return
  }
  // update paid status and store Rapyd payment ID for refund tracking
  if (tableType === 'baggage') {
    await table.update(record.id, {
      Greiðslustaða: 'Greitt',
      Greitt: true,
      ...(paymentId ? { 'Rapyd Payment ID': paymentId } : {}),
      // Capture issuing country (or billing country) for passenger-origin
      // reporting in airline dashboards. Only written when Rapyd provides it
      // — leaves the field blank rather than overwriting with garbage.
      ...(billingCountry ? { 'Billing country': billingCountry } : {}),
    })
    // Send Payday invoice if this order has a Kennitala (B2B). Idempotent
    // via the "Payday Invoice Sent" flag — safe against the optimistic
    // mark-paid race from /api/airtable/mark-paid-by-order-no.
    await maybeSendPaydayInvoiceForOrder(table, record.id, record.fields)
  } else if (tableType === 'fast-track') {
    await table.update(record.id, {
      Greiddi: true,
      ...(paymentId ? { 'Rapyd Payment ID': paymentId } : {}),
    })
  }
  console.log('[api][payment][webhooks] updating paid status for record', recordId, 'paymentId', paymentId)
}

/**
 * Extract a 2- or 3-letter ISO country code from the Rapyd PAYMENT_COMPLETED
 * payload. Tries several known locations because Rapyd's payload shape varies
 * by payment method (card vs Apple Pay vs bank). Returns undefined if none
 * found — callers should treat that as "leave the Airtable field blank".
 *
 * Priority:
 *   1. payment_method_data.bin_details.country — card-issuing country (most
 *      reliable for cards; harder to spoof than a billing-address form field)
 *   2. payment_method_data.billing_address.country — when present
 *   3. payment_method_data.country — some wallet payments expose it here
 *   4. data.address.country / data.billing_address.country — top-level
 *      fallbacks seen in some Rapyd responses
 */
const extractBillingCountry = (data: unknown): string | undefined => {
  const get = (obj: unknown, path: string[]): unknown =>
    path.reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key]
      }
      return undefined
    }, obj)

  const candidates = [
    get(data, ['payment_method_data', 'bin_details', 'country']),
    get(data, ['payment_method_data', 'billing_address', 'country']),
    get(data, ['payment_method_data', 'country']),
    get(data, ['billing_address', 'country']),
    get(data, ['address', 'country']),
  ]

  for (const c of candidates) {
    if (typeof c === 'string') {
      const trimmed = c.trim().toUpperCase()
      // ISO 3166-1 alpha-2 is 2 chars; alpha-3 is 3. Anything else is junk.
      if (trimmed.length === 2 || trimmed.length === 3) return trimmed
    }
  }
  return undefined
}
