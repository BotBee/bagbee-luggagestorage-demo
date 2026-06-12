import https from 'https'
import Airtable, { FieldSet } from 'airtable'
import { NextApiRequest, NextApiResponse } from 'next'
import { generateRandomString, sign } from '../../../../common/rapyd-helper'
import getAppConfig from '../../../../modules/config'
import {
  calcStoragePrice,
  deriveStorageType,
  getStorageRates,
  StorageInputs,
} from '../../../../utils/storagePricing'
import { partialRefund } from '../../../../utils/rapydRefund'
import { notifyBookingEvent } from '../../../../utils/notifyConfirmation'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'
const SITE_URL = 'https://www.bagbee.is'

/**
 * Airtable field names. Kept in one place because field names drift over time
 * (and the booking-creation code has its own copies with subtle typos).
 */
const F = {
  arrivalDate: 'ArrivalDate',
  departureDate: 'Departure date',
  arrivalTime: 'Arrival time',
  departureTime: 'Departure time',
  luggage: 'Luggage',
  backpacks: 'Backpack / Purse (ISK 1000 pr. item)',
  late: 'Late check-out (ISK 500 pr. bag)',
  delivery: 'Delivery Service',
  totalAmount: 'Total Amount ISK',
  paymentStatus: 'Payment Status',
  paymentId: 'Rapyd Payment ID',
  storageType: 'Type of storage',
  pendingTopupCheckoutId: 'Pending Top-up Checkout ID',
  reference: 'Reference',
} as const

type EditInput = {
  arrivalDate?: string
  departureDate?: string
  arrivalTime?: string
  departureTime?: string
  luggage?: number
  backpacks?: number
  late?: boolean
  delivery?: boolean
}

/**
 * Parse the various time strings the booking flow has written over time
 * ("10:00 AM" from the new form, "10:00" from earlier flows) into minutes
 * since midnight. Returns null if unparseable.
 */
const parseTimeToMinutes = (t?: string): number | null => {
  if (!t) return null
  const trimmed = t.trim()
  const ampm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(trimmed)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = parseInt(ampm[2], 10)
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0
    return h * 60 + m
  }
  const h24 = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (h24) {
    const h = parseInt(h24[1], 10)
    const m = parseInt(h24[2], 10)
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return h * 60 + m
  }
  return null
}

/** Combine an ArrivalDate ("2026-06-18") + Arrival time → ms since epoch. */
const dropoffMillis = (date?: string, time?: string): number | null => {
  if (!date) return null
  const mins = parseTimeToMinutes(time) ?? 0
  const ms = new Date(date).getTime()
  if (isNaN(ms)) return null
  return ms + mins * 60_000
}

/** Issue a top-up Rapyd checkout for the (positive) price difference. */
const createTopupCheckout = (
  amount: number,
  bookingId: string,
  topup: EditInput,
  newTotal: number,
  rapydBaseUrl: string,
  rapydAccessKey: string,
): Promise<any> => {
  const path = '/v1/checkout'
  const body = {
    amount,
    currency: 'ISK',
    country: 'IS',
    language: 'EN',
    complete_payment_url: `${SITE_URL}/storage/payment-success?bookingId=${bookingId}&kind=topup`,
    error_payment_url: `${SITE_URL}/storage/payment-cancel?bookingId=${bookingId}`,
    // Apple Pay / wallets follow complete_checkout_url (inline completion).
    complete_checkout_url: `${SITE_URL}/storage/payment-success?bookingId=${bookingId}&kind=topup`,
    cancel_checkout_url: `${SITE_URL}/storage/payment-cancel?bookingId=${bookingId}`,
    merchant_reference_id: `bagbee-storage-${bookingId}-topup-${Date.now()}`,
    // Rapyd metadata values must be strings — JSON-stringify the proposed
    // changes here so the webhook + confirm-payment can apply them after
    // the customer pays. `newTotal` is carried explicitly (already computed
    // with this booking's rate profile) so the apply paths never have to
    // recompute — which would otherwise use BagBee's default rates and
    // mis-total a partner (e.g. Luggage Lockers) booking.
    metadata: {
      bookingId,
      kind: 'topup',
      topup: JSON.stringify(topup),
      newTotal: String(newTotal),
    },
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
          idempotency: `${bookingId}-topup-${Date.now()}`,
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

/**
 * Apply the merged inputs to the Airtable record — used both directly (for
 * unchanged-price and reduce-and-refund edits) and exported for the webhook
 * + confirm-payment paths after a top-up payment clears.
 */
export const applyStorageEdit = async (
  table: any,
  bookingId: string,
  merged: Required<Omit<EditInput, 'late' | 'delivery'>> & { late: boolean; delivery: boolean },
  newTotal: number,
): Promise<void> => {
  await table.update(bookingId, {
    [F.arrivalDate]: merged.arrivalDate,
    [F.departureDate]: merged.departureDate,
    [F.arrivalTime]: merged.arrivalTime,
    [F.departureTime]: merged.departureTime,
    [F.luggage]: merged.luggage,
    [F.backpacks]: merged.backpacks,
    [F.late]: merged.late,
    [F.delivery]: merged.delivery,
    [F.totalAmount]: newTotal,
    [F.storageType]: deriveStorageType(merged),
  } as FieldSet)
  // Send the "your booking has been updated" email (covers immediate edits and
  // edits applied after a top-up payment).
  await notifyBookingEvent(bookingId, 'updated')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { id } = req.query as { id?: string }
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Missing booking id' })
  }

  const {
    publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
  } = getAppConfig()

  const incoming = (req.body || {}) as EditInput

  try {
    Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
    const table = Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)

    let record
    try {
      record = await table.find(id)
    } catch {
      return res.status(404).json({ message: 'Booking not found' })
    }

    const f = record.fields as Record<string, any>

    // 1. Only paid bookings can be edited
    if (f[F.paymentStatus] !== 'Paid') {
      return res.status(409).json({ message: 'Only paid bookings can be edited' })
    }

    // 2. 12-hour cutoff before current drop-off
    const currentDropoff = dropoffMillis(
      f[F.arrivalDate] as string,
      f[F.arrivalTime] as string,
    )
    if (currentDropoff !== null) {
      const hoursUntil = (currentDropoff - Date.now()) / (1000 * 60 * 60)
      if (hoursUntil < 24) {
        return res.status(409).json({ message: 'Edits closed within 24 hours of drop-off' })
      }
    }

    // 3. Merge incoming fields onto existing — anything omitted keeps current value
    const merged = {
      arrivalDate: incoming.arrivalDate ?? (f[F.arrivalDate] as string),
      departureDate: incoming.departureDate ?? (f[F.departureDate] as string),
      arrivalTime: incoming.arrivalTime ?? (f[F.arrivalTime] as string),
      departureTime: incoming.departureTime ?? (f[F.departureTime] as string),
      luggage: incoming.luggage ?? Number(f[F.luggage]) ?? 0,
      backpacks: incoming.backpacks ?? Number(f[F.backpacks]) ?? 0,
      late: incoming.late ?? !!f[F.late],
      delivery: incoming.delivery ?? !!f[F.delivery],
      // Preserve existing Flight Date through edits so deriveStorageType
      // keeps emitting "Storage and Check-in" if it was already set.
      flightDate: (f['Flight Date'] as string) || undefined,
    }

    // 4. Sanity checks
    if (merged.luggage < 0 || merged.backpacks < 0) {
      return res.status(400).json({ message: 'Bag counts cannot be negative' })
    }
    if (Number(merged.luggage) + Number(merged.backpacks) === 0) {
      return res.status(400).json({ message: 'At least one bag required' })
    }
    // Edited drop-off must still be in the future
    const newDropoff = dropoffMillis(merged.arrivalDate, merged.arrivalTime)
    if (newDropoff !== null && newDropoff < Date.now()) {
      return res.status(400).json({ message: 'New drop-off time must be in the future' })
    }
    // Same-day check-out must be after check-in
    if (merged.arrivalDate === merged.departureDate) {
      const a = parseTimeToMinutes(merged.arrivalTime)
      const d = parseTimeToMinutes(merged.departureTime)
      if (a !== null && d !== null && d <= a) {
        return res.status(400).json({ message: 'Check-out must be after check-in on same-day bookings' })
      }
    }

    // 5. Price diff — use the booking's rate profile (partner bookings carry a
    //    Reference, e.g. "Luggage lockers", that selects partner pricing).
    const rates = getStorageRates(f[F.reference] as string | undefined)
    const oldTotal = Number(f[F.totalAmount]) || 0
    const newTotal = calcStoragePrice(merged as StorageInputs, rates).total
    const diff = newTotal - oldTotal

    if (diff === 0) {
      await applyStorageEdit(table, id, merged, newTotal)
      return res.status(200).json({ status: 'updated', newTotal, diff: 0 })
    }

    if (diff < 0) {
      const paymentIdRaw = f[F.paymentId] as string | undefined
      if (!paymentIdRaw) {
        // No payment ID — can't refund automatically. Still apply the change
        // (customer doesn't lose money), and log loudly so CS reconciles.
        console.warn('[Storage edit] Reducing paid booking with no payment ID:', id)
        await applyStorageEdit(table, id, merged, newTotal)
        return res.status(200).json({
          status: 'updated',
          newTotal,
          diff,
          warning: 'Refund needs manual processing — payment ID missing',
        })
      }
      try {
        await partialRefund(
          paymentIdRaw,
          Math.abs(diff),
          rapydBaseUrl as string,
          rapydAccessKey as string,
        )
      } catch (err) {
        console.error('[Storage edit] Partial refund failed:', err)
        return res.status(502).json({ message: 'Refund failed — booking unchanged' })
      }
      await applyStorageEdit(table, id, merged, newTotal)
      return res.status(200).json({ status: 'updated', newTotal, diff, refunded: Math.abs(diff) })
    }

    // diff > 0 — create a top-up checkout and let the customer pay it.
    // The proposed changes ride along in metadata and get applied by the
    // webhook (or confirm-payment redirect) once Rapyd confirms the payment.
    let checkout
    try {
      checkout = await createTopupCheckout(
        diff,
        id,
        merged,
        newTotal,
        rapydBaseUrl as string,
        rapydAccessKey as string,
      )
    } catch (err) {
      console.error('[Storage edit] Top-up checkout creation failed:', err)
      return res.status(502).json({ message: 'Could not create payment session' })
    }

    const redirectUrl: string | undefined = checkout.data?.redirect_url
    const topupCheckoutId: string | undefined = checkout.data?.id
    if (!redirectUrl) {
      return res.status(502).json({ message: 'Rapyd did not return a payment URL' })
    }

    // Park the checkout id on the record so confirm-topup can recover the
    // payment state if the webhook never fires. Webhook clears the field
    // once it applies the edit.
    if (topupCheckoutId) {
      try {
        await table.update(id, {
          [F.pendingTopupCheckoutId]: topupCheckoutId,
        } as FieldSet)
      } catch (err) {
        console.warn('[Storage edit] Could not store pending topup checkout id:', err)
        // Non-fatal — webhook can still apply the edit from metadata alone.
      }
    }

    return res.status(200).json({
      status: 'pending_payment',
      diff,
      newTotal,
      redirectUrl,
    })
  } catch (err) {
    console.error('[Storage edit] Failed:', err)
    return res.status(500).json({ message: 'Edit failed' })
  }
}
