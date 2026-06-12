import https from 'https'
import { NextApiRequest, NextApiResponse } from 'next'
import Airtable, { FieldSet, Table } from 'airtable'
import { generateRandomString, sign } from '../../../common/rapyd-helper'
import getAppConfig from '../../../modules/config'
import {
  BIKERENT_MAX_ITEMS,
  BIKERENT_REFERENCE,
  calcBikerentPrice,
} from '../../../utils/bikerentPricing'
import { deriveStorageType } from '../../../utils/storagePricing'
import { fetchClosedDates, firstClosedDate } from '../../../utils/closedDates'

// BikeRent bookings are stored in the writable BSI Storage table, tagged
// Reference = 'bikerent.is'. The dedicated BSI BikeRent table is externally
// synced, so the API cannot create rows in it. Bike-box counts map onto the
// storage Luggage (bike boxes) / Backpack (folded boxes) number fields; the
// full breakdown goes in the note.
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
  rapydAccessKey: string,
): Promise<any> => {
  const path = '/v1/checkout'
  const body = {
    amount,
    currency: 'ISK',
    country: 'IS',
    language: 'EN',
    complete_payment_url: `${SITE_URL}/bikerent/payment-success?bookingId=${bookingId}`,
    error_payment_url: `${SITE_URL}/bikerent/payment-cancel?bookingId=${bookingId}`,
    // Wallets (Apple Pay) complete inline and follow complete_checkout_url, NOT
    // complete_payment_url — without these they land on the homepage.
    complete_checkout_url: `${SITE_URL}/bikerent/payment-success?bookingId=${bookingId}`,
    cancel_checkout_url: `${SITE_URL}/bikerent/payment-cancel?bookingId=${bookingId}`,
    merchant_reference_id: `bagbee-bikerent-${bookingId}`,
    // tableType lets the shared Rapyd webhook route this payment to the
    // BikeRent table (it also handles 'day-storage' and plain storage).
    metadata: { bookingId, tableType: 'bikerent' },
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
          idempotency: `${bookingId}-bikerent`,
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

type CheckoutBody = {
  name?: string
  email?: string
  phone?: string
  hardBoxes?: number
  foldedBoxes?: number
  dropoffDate?: string
  dropoffTime?: string
  pickupDate?: string
  pickupTime?: string
  lateCheckout?: boolean
  comment?: string
}

/**
 * Create a BikeRent bike-box storage booking (bikerent.is embed popup) and a
 * Rapyd checkout for it. The booking lands in the BSI BikeRent table with
 * Payment Status = Pending; the webhook / payment-success confirm flips it to
 * Paid. Total is computed server-side (the client value is never trusted).
 *
 * POST /api/bikerent/checkout
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const {
    publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
  } = getAppConfig()

  const b = (req.body || {}) as CheckoutBody
  const hardBoxes = Number(b.hardBoxes) || 0
  const foldedBoxes = Number(b.foldedBoxes) || 0

  if (!Number.isInteger(hardBoxes) || !Number.isInteger(foldedBoxes) || hardBoxes < 0 || foldedBoxes < 0) {
    return res.status(400).json({ message: 'Invalid item counts' })
  }
  if (hardBoxes + foldedBoxes < 1) {
    return res.status(400).json({ message: 'At least one box is required' })
  }
  if (hardBoxes + foldedBoxes > BIKERENT_MAX_ITEMS) {
    return res.status(400).json({ message: `Maximum ${BIKERENT_MAX_ITEMS} boxes` })
  }
  if (!b.dropoffDate || !b.pickupDate) {
    return res.status(400).json({ message: 'Drop-off and pick-up dates are required' })
  }
  if (!b.name || !b.email) {
    return res.status(400).json({ message: 'Name and email are required' })
  }

  // Reject drop-off / pick-up on a staff-closed day. Fail open on lookup error.
  try {
    const closed = await fetchClosedDates('BikeRent')
    const hit = firstClosedDate(closed, b.dropoffDate, b.pickupDate)
    if (hit) {
      return res
        .status(409)
        .json({ message: `We are closed for bookings on ${hit}. Please choose another date.` })
    }
  } catch (e) {
    console.error('[BikeRent checkout] closed-date check failed (allowing booking):', e)
  }

  const price = calcBikerentPrice({
    dropoffDate: b.dropoffDate,
    pickupDate: b.pickupDate,
    hardBoxes,
    foldedBoxes,
    dropoffTime: b.dropoffTime,
  })
  if (!Number.isFinite(price.total) || price.total <= 0) {
    return res.status(400).json({ message: 'Invalid booking — nothing to charge' })
  }

  const note = [
    `[BikeRent.is bike-box storage]`,
    `Bike boxes/bags: ${hardBoxes} · Folded boxes: ${foldedBoxes}`,
    `Base fee: ${price.base.toLocaleString()} kr`,
    `Bike boxes/bags: ${hardBoxes} × 1000 kr × ${price.days} day(s) = ${price.hardCost.toLocaleString()} kr`,
    `Folded boxes: ${foldedBoxes} × 5000 kr = ${price.foldedCost.toLocaleString()} kr`,
    ...(price.afterHoursCost > 0
      ? [`After-hours drop-off (${b.dropoffTime}): ${price.afterHoursCost.toLocaleString()} kr`]
      : []),
    `Total: ${price.total.toLocaleString()} kr`,
    ...(b.comment ? [`Customer note: ${b.comment}`] : []),
  ].join('\n')

  try {
    const table = getStorageTable()

    // Map bike-box booking onto BSI Storage fields. Luggage = bike boxes/bags,
    // Backpack = folded boxes; the note carries the readable breakdown.
    const created = await table.create([
      {
        fields: {
          Name: b.name,
          Email: b.email,
          PhoneNumber: b.phone || '',
          Luggage: hardBoxes,
          'Backpack / Purse (ISK 1000 pr. item)': foldedBoxes,
          ArrivalDate: b.dropoffDate,
          'Arrival time': b.dropoffTime || '',
          'Departure date': b.pickupDate,
          'Departure time': b.pickupTime || '',
          'Late check-out (ISK 500 pr. bag)': !!b.lateCheckout,
          Athugasemd: note,
          'Total Amount ISK': price.total,
          // Always set Type of storage from the shared rules (same-day vs
          // multi-day vs after-5pm locker). These are existing select options,
          // so no typecast is needed.
          'Type of storage': deriveStorageType({
            arrivalDate: b.dropoffDate,
            departureDate: b.pickupDate,
            late: !!b.lateCheckout,
          }),
          Reference: BIKERENT_REFERENCE,
          'Payment Status': 'Pending',
        } as FieldSet,
      },
    ])
    const bookingId = created[0].id

    const checkout = await createRapydCheckout(
      price.total,
      bookingId,
      rapydBaseUrl as string,
      rapydAccessKey as string,
    )
    const checkoutId: string | undefined = checkout.data?.id
    const redirectUrl: string | undefined = checkout.data?.redirect_url

    if (checkoutId) {
      await table.update(bookingId, { 'Rapyd Checkout ID': checkoutId } as FieldSet)
    }

    if (!redirectUrl) {
      return res.status(500).json({ message: 'Failed to create payment link' })
    }

    return res.status(200).json({ bookingId, redirectUrl })
  } catch (err) {
    console.error('[BikeRent checkout] Failed:', err)
    return res.status(500).json({ message: (err as Error).message || 'Checkout failed' })
  }
}
