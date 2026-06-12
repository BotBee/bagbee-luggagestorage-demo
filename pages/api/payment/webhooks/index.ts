import { NextApiRequest, NextApiResponse } from 'next'
import Airtable, { FieldSet } from 'airtable'
import { getFastTrackTable, getTable, minifyItems } from '../../../../utils/airtable'
import { sign } from '../../../../common/rapyd-helper'
import { maybeSendPaydayInvoiceForOrder } from '../../../../utils/paydayInvoice'
import getAppConfig from '../../../../modules/config'
import { notifyConfirmationEmail } from '../../../../utils/notifyConfirmation'
import { Readable } from 'stream'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'
// BikeRent bookings are stored in the BSI Storage table too (the dedicated
// BSI BikeRent table is externally synced and not API-writable).
const BSI_BIKERENT_TABLE_ID = 'tblMJtxJiHFDi3TTk'

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

    // Rapyd signs against the *exact* URL configured in their dashboard.
    // `req.headers.host` is unreliable on Vercel — can be a vercel-internal
    // hostname, an apex (`bagbee.is`) vs `www.bagbee.is`, etc. So we try a
    // small set of canonical URLs in priority order. First one whose signature
    // matches wins. RAPYD_WEBHOOK_URL overrides for self-hosted / staging.
    const candidateUrls = [
      process.env.RAPYD_WEBHOOK_URL,
      'https://www.bagbee.is/api/payment/webhooks',
      'https://bagbee.is/api/payment/webhooks',
      new URL(req.url || '', `https://${req.headers.host}`).toString(),
    ].filter(Boolean) as string[]

    const incomingSig = String(req.headers['signature'] || '')
    const salt = String(req.headers['salt'])
    const timestamp = Number(req.headers['timestamp'])

    let signatureValid = false
    for (const url of candidateUrls) {
      const expected = sign('', url, salt, timestamp, request)
      if (expected === incomingSig) {
        signatureValid = true
        console.log('[api][payment][webhooks] signature ok via', url)
        break
      }
    }

    if (!signatureValid) {
      console.warn(
        '[api][payment][webhooks] Invalid signature; host=%s url=%s tried=%j',
        req.headers.host,
        req.url,
        candidateUrls,
      )
      return res.status(400).json({ message: 'Invalid signature' })
    }

    if (request.type === 'PAYMENT_COMPLETED' || request.type === 'CHECKOUT_PAYMENT_COMPLETED') {
      console.log('[api][payment][webhooks] metadata:', request.data.metadata)
      console.log('[api][payment][webhooks] payment id:', request.data.id)

      // Storage booking — identified by metadata.bookingId
      const meta = request.data.metadata ?? request.data.payment?.metadata ?? {}

      // Cruise day-storage add-on — one payment covers TWO records: the
      // Pickup & Delivery dispatch order (baggage table) and the BSÍ storage
      // hold. Handle both and return before the single-record paths below (the
      // storage path would otherwise swallow this via metadata.bookingId).
      if (meta.tableType === 'day-storage') {
        const dsPaymentId: string | undefined = request.data.id || request.data.payment?.id
        const dsBillingCountry = extractBillingCountry(request.data)
        let dsError: unknown = null

        // BSÍ storage record FIRST and independently: it must carry the
        // Payment Status + Rapyd Payment ID so the storage refund flow
        // (utils/rapydRefund → reads 'Rapyd Payment ID') can issue refunds.
        // Done in its own try so a failure marking the dispatch order paid
        // can't leave the storage record without its payment id.
        if (meta.bookingId) {
          try {
            const {
              serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
            } = getAppConfig()
            Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
            const storageTable = Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)
            await storageTable.update(meta.bookingId, {
              'Payment Status': 'Paid',
              'Paid?': true,
              ...(dsPaymentId ? { 'Rapyd Payment ID': dsPaymentId } : {}),
            } as FieldSet)
            // Instantly trigger the Make confirmation-email scenario.
            await notifyConfirmationEmail(meta.bookingId)
          } catch (error) {
            dsError = error
            console.error('[api][payment][webhooks] day-storage: storage update failed', error)
          }
        }

        // Dispatch order (baggage table): Greitt + payment id + Payday invoice.
        if (meta.recordId) {
          try {
            await UpdatePaidStatus(meta.recordId, 'baggage', dsPaymentId, dsBillingCountry)
          } catch (error) {
            dsError = error
            console.error('[api][payment][webhooks] day-storage: order update failed', error)
          }
        }

        if (dsError) {
          return res.status(500).json({ message: 'Error updating day-storage records' })
        }
        return res.status(200).json({ message: 'Payment success' })
      }

      // BikeRent (bikerent.is) — own table. Intercept before the generic
      // storage bookingId path below (which assumes the BSI Storage table).
      if (meta.tableType === 'bikerent' && meta.bookingId) {
        const brBookingId: string = meta.bookingId
        const brPaymentId: string | undefined = request.data.id || request.data.payment?.id
        try {
          const {
            serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
          } = getAppConfig()
          Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
          const brTable = Airtable.base(airtableBaseId)(BSI_BIKERENT_TABLE_ID)

          if (meta.kind === 'topup') {
            const topup = JSON.parse(meta.topup || '{}')
            const { applyBikerentEdit } = await import('../../bikerent/[id]/edit')
            const metaTotal = Number(meta.newTotal)
            let newTotal = Number.isFinite(metaTotal) && metaTotal > 0 ? metaTotal : NaN
            if (!Number.isFinite(newTotal)) {
              const { calcBikerentPrice } = await import('../../../../utils/bikerentPricing')
              newTotal = calcBikerentPrice(topup).total
            }
            await applyBikerentEdit(brTable, brBookingId, topup, newTotal)
            await brTable
              .update(brBookingId, { 'Pending Top-up Checkout ID': '' } as FieldSet)
              .catch(() => undefined)
            console.log('[api][payment][webhooks] bikerent top-up applied:', brBookingId, 'newTotal', newTotal)
          } else {
            await brTable.update(brBookingId, {
              'Payment Status': 'Paid',
              'Paid?': true,
              ...(brPaymentId ? { 'Rapyd Payment ID': brPaymentId } : {}),
            } as FieldSet)
            console.log('[api][payment][webhooks] bikerent booking marked paid:', brBookingId)
            await notifyConfirmationEmail(brBookingId)
            // Confirmation email is sent by the Make scenario "BSI Storage —
            // payment confirmation email" (triggers on Paid?). Not from code.
          }
        } catch (error) {
          console.error('[api][payment][webhooks] Error processing bikerent payment', error)
          return res.status(500).json({ message: 'Error updating bikerent record' })
        }
        return res.status(200).json({ message: 'Payment success' })
      }

      // KEF bike-box lockers — own base (applEhUp3t8XHzp6r), one row per box.
      // Intercept before the generic storage bookingId path.
      if (meta.tableType === 'kef' && meta.bookingId) {
        const kefPaymentId: string | undefined = request.data.id || request.data.payment?.id
        try {
          const { updateKefRows } = await import('../../../../utils/kefBooking')
          const { FLD } = await import('../../../../utils/kefLockersAirtable')
          let ids: string[]
          try {
            const parsed = JSON.parse(meta.orderRowIds || '[]')
            ids = Array.isArray(parsed) && parsed.length ? parsed : [meta.bookingId]
          } catch {
            ids = [meta.bookingId]
          }
          if (meta.kind === 'topup') {
            const { applyKefEdit } = await import('../../kef/[id]/edit')
            await applyKefEdit(meta.bookingId, JSON.parse(meta.edit || '{}'))
            console.log('[api][payment][webhooks] KEF top-up applied:', meta.bookingId)
          } else {
            await updateKefRows(ids, {
              [FLD.bookings.paymentStatus]: 'Paid',
              [FLD.bookings.paid]: true,
              ...(kefPaymentId ? { [FLD.bookings.rapydPaymentId]: kefPaymentId } : {}),
            })
            console.log('[api][payment][webhooks] KEF booking marked paid:', ids.join(','))
            // Booking-confirmation email (with the manage-order link).
            const { sendKefConfirmation } = await import('../../../../utils/kefConfirmationMailer')
            await sendKefConfirmation(meta.bookingId).catch((e) =>
              console.error('[api][payment][webhooks] KEF confirmation email failed', e),
            )
          }
        } catch (error) {
          console.error('[api][payment][webhooks] Error processing KEF payment', error)
          return res.status(500).json({ message: 'Error updating KEF booking' })
        }
        return res.status(200).json({ message: 'Payment success' })
      }

      const bookingId: string | undefined = meta.bookingId
      if (bookingId) {
        const paymentId: string | undefined = request.data.id || request.data.payment?.id
        const kind: string | undefined = meta.kind
        try {
          const {
            serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
          } = getAppConfig()
          Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
          const table = Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)

          if (kind === 'topup') {
            // A self-service edit charged the customer for the difference.
            // The proposed changes ride along as a JSON-encoded metadata field;
            // apply them to the booking now that Rapyd has confirmed payment.
            try {
              const topup = JSON.parse(meta.topup || '{}')
              const { applyStorageEdit } = await import('../../storage/[id]/edit')
              // Prefer the explicit newTotal the edit endpoint stamped into the
              // checkout metadata (already computed with this booking's rate
              // profile). Fall back to recomputing from the record's Reference
              // for older checkouts created before newTotal was carried.
              const metaTotal = Number(meta.newTotal)
              let newTotal = Number.isFinite(metaTotal) && metaTotal > 0 ? metaTotal : NaN
              if (!Number.isFinite(newTotal)) {
                const { calcStoragePrice, getStorageRates } = await import(
                  '../../../../utils/storagePricing'
                )
                const rec = await table.find(bookingId)
                newTotal = calcStoragePrice(
                  topup,
                  getStorageRates(rec.fields['Reference'] as string | undefined),
                ).total
              }
              await applyStorageEdit(table, bookingId, topup, newTotal)
              // Clear the parked checkout id — edit is finalised.
              await table.update(bookingId, {
                'Pending Top-up Checkout ID': '',
              } as FieldSet).catch(() => undefined)
              console.log('[api][payment][webhooks] storage top-up applied:', bookingId, 'newTotal', newTotal)
            } catch (err) {
              console.error('[api][payment][webhooks] Top-up parse/apply failed:', err)
              return res.status(500).json({ message: 'Top-up apply failed' })
            }
          } else {
            // Initial booking — mark Paid, tick the legacy "Paid?" checkbox
            // (kept in sync so Airtable views/automations that filter on it
            // still work), and write the Rapyd payment id.
            await table.update(bookingId, {
              'Payment Status': 'Paid',
              'Paid?': true,
              ...(paymentId ? { 'Rapyd Payment ID': paymentId } : {}),
            } as FieldSet)
            console.log('[api][payment][webhooks] storage booking marked paid:', bookingId)
            await notifyConfirmationEmail(bookingId)
            // Storage confirmation email is sent by the Airtable automation
            // "Payment confirmation for BSI storage" (triggers on Paid?). We
            // do NOT send from code — that storageMailer path was test
            // scaffolding and caused duplicate emails.
          }
        } catch (error) {
          console.error('[api][payment][webhooks] Error processing storage payment', error)
          return res.status(500).json({ message: 'Error updating storage record' })
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
