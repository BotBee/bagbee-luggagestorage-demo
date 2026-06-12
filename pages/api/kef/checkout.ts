/**
 * POST /api/kef/checkout — create a KEF bike-box booking (one row per box, in
 * the KEF Lockers 2025 table) and a Rapyd checkout. Capacity is re-checked
 * server-side and lockers are assigned here (authoritative). The booking lands
 * Pending; the webhook flips it to Paid, and sync.ts issues the exact-window
 * TTLock PINs. Total is recomputed server-side (client value never trusted).
 */
import https from 'https'
import { NextApiRequest, NextApiResponse } from 'next'
import { generateRandomString, sign } from '../../../common/rapyd-helper'
import getAppConfig from '../../../modules/config'
import { calcKefPrice, KEF_MAX_BOXES } from '../../../utils/kefPricing'
import {
  assignLockers,
  createKefRows,
  isoDateTime,
  updateKefRows,
  type KefRowInput,
  type WindowReq,
} from '../../../utils/kefBooking'
import { FLD } from '../../../utils/kefLockersAirtable'

const SITE_URL = 'https://www.bagbee.is'

type Body = {
  boxes?: number
  name?: string
  email?: string
  phone?: string
  dropoffDate?: string
  dropoffTime?: string
  dropoffHours?: number
  returnLocation?: 'kef' | 'bsi'
  pickupDate?: string
  pickupTime?: string
  pickupHours?: number
  arrivalFlight?: string
  departureFlight?: string
  comment?: string
}

const createRapydCheckout = (
  amount: number,
  bookingId: string,
  orderRowIds: string[],
  rapydBaseUrl: string,
  rapydAccessKey: string,
): Promise<any> => {
  const path = '/v1/checkout'
  const success = `${SITE_URL}/kef/payment-success?bookingId=${bookingId}`
  const cancel = `${SITE_URL}/kef/payment-cancel?bookingId=${bookingId}`
  const body = {
    amount,
    currency: 'ISK',
    country: 'IS',
    language: 'EN',
    complete_payment_url: success,
    error_payment_url: cancel,
    complete_checkout_url: success,
    cancel_checkout_url: cancel,
    merchant_reference_id: `bagbee-kef-${bookingId}`,
    metadata: { bookingId, tableType: 'kef', orderRowIds: JSON.stringify(orderRowIds) },
  }
  const salt = generateRandomString(8)
  const timestamp = Math.round(Date.now() / 1000)
  const signature = sign('POST', path, salt, timestamp, body)
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body)
    const r = https.request(
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
          idempotency: `${bookingId}-kef`,
        },
      },
      (resp) => {
        let data = ''
        resp.on('data', (c) => (data += c))
        resp.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (resp.statusCode !== 200) return reject(parsed)
            resolve(parsed)
          } catch {
            reject(new Error(`Rapyd non-JSON ${resp.statusCode}: ${data.slice(0, 200)}`))
          }
        })
      },
    )
    r.on('error', reject)
    r.write(bodyStr)
    r.end()
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const {
    publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
  } = getAppConfig()

  const b = (req.body || {}) as Body
  const boxes = Math.floor(Number(b.boxes) || 0)
  const isKef = b.returnLocation !== 'bsi'
  const dropoffHours = Math.max(3, Math.floor(Number(b.dropoffHours) || 3))
  const pickupHours = Math.max(3, Math.floor(Number(b.pickupHours) || 3))

  // ---- validation --------------------------------------------------------
  if (!Number.isInteger(boxes) || boxes < 1 || boxes > KEF_MAX_BOXES) {
    return res.status(400).json({ message: `Choose 1–${KEF_MAX_BOXES} bike boxes` })
  }
  if (!b.name || !b.email) {
    return res.status(400).json({ message: 'Name and email are required' })
  }
  if (!b.dropoffDate || !b.dropoffTime) {
    return res.status(400).json({ message: 'Drop-off date and time are required' })
  }
  if (!b.pickupDate) {
    return res.status(400).json({ message: 'Pick-up date is required' })
  }
  if (isKef && !b.pickupTime) {
    return res.status(400).json({ message: 'Pick-up time is required for an airport return' })
  }
  if (new Date(b.pickupDate).getTime() < new Date(b.dropoffDate).getTime()) {
    return res.status(400).json({ message: 'Pick-up must be on or after drop-off' })
  }

  // ---- windows -----------------------------------------------------------
  const dropoffStart = Date.parse(isoDateTime(b.dropoffDate, b.dropoffTime))
  if (isNaN(dropoffStart) || dropoffStart < Date.now()) {
    return res.status(400).json({ message: 'Drop-off must be in the future' })
  }
  const dropoff: WindowReq = { start: dropoffStart, end: dropoffStart + dropoffHours * 3600000 }
  let pickup: WindowReq | null = null
  if (isKef) {
    const ps = Date.parse(isoDateTime(b.pickupDate, b.pickupTime as string))
    if (isNaN(ps)) return res.status(400).json({ message: 'Invalid pick-up time' })
    pickup = { start: ps, end: ps + pickupHours * 3600000 }
  }

  // ---- price (server-authoritative, VAT-inclusive) -----------------------
  const price = calcKefPrice({
    boxes,
    dropoffDate: b.dropoffDate,
    pickupDate: b.pickupDate,
    returnLocation: isKef ? 'kef' : 'bsi',
    dropoffWindowHours: dropoffHours,
    pickupWindowHours: pickupHours,
  })
  if (!Number.isFinite(price.total) || price.total <= 0) {
    return res.status(400).json({ message: 'Invalid booking — nothing to charge' })
  }
  const perBox = Math.round(price.total / boxes)

  try {
    // ---- capacity + locker assignment (authoritative) --------------------
    const assigned = await assignLockers({ boxes, dropoff, pickup })
    if ('error' in assigned) {
      const where = assigned.error === 'pickup' ? 'pick-up' : 'drop-off'
      return res.status(409).json({
        message:
          assigned.freeDropoff === 0
            ? `Both lockers are booked around your ${where} time. Please choose another time or date.`
            : `Only ${assigned.freeDropoff} locker is free around your ${where} time — reduce the number of boxes or pick another time.`,
      })
    }

    // ---- create one Pending row per box ----------------------------------
    const rowInputs: KefRowInput[] = assigned.assignments.map((a) => ({
      customerName: b.name as string,
      email: b.email as string,
      phone: b.phone || '',
      amount: perBox,
      checkInIso: new Date(dropoff.start).toISOString(),
      checkInEndIso: new Date(dropoff.end).toISOString(),
      checkOutIso: pickup ? new Date(pickup.start).toISOString() : null,
      checkOutEndIso: pickup ? new Date(pickup.end).toISOString() : null,
      lockerIn: a.lockerIn,
      lockerOut: a.lockerOut,
      returnLocation: isKef ? 'KEF airport' : 'BSÍ terminal',
      arrivalFlight: b.arrivalFlight,
      departureFlight: b.departureFlight,
      comment: b.comment,
    }))
    const rows = await createKefRows(rowInputs)
    const rowIds = rows.map((r) => r.id)
    const leadId = rowIds[0]

    // ---- Rapyd checkout for the whole order ------------------------------
    const checkout = await createRapydCheckout(
      price.total,
      leadId,
      rowIds,
      rapydBaseUrl as string,
      rapydAccessKey as string,
    )
    const checkoutId: string | undefined = checkout.data?.id
    const redirectUrl: string | undefined = checkout.data?.redirect_url

    if (checkoutId) {
      // Group key for the manage page + webhook fallback.
      await updateKefRows(rowIds, { [FLD.bookings.rapydCheckoutId]: checkoutId })
    }
    if (!redirectUrl) {
      return res.status(500).json({ message: 'Failed to create payment link' })
    }

    return res.status(200).json({ bookingId: leadId, redirectUrl })
  } catch (err) {
    console.error('[KEF checkout] Failed:', err)
    return res.status(500).json({ message: (err as Error).message || 'Checkout failed' })
  }
}
