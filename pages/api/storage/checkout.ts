import https from 'https'
import { NextApiRequest, NextApiResponse } from 'next'
import Airtable, { FieldSet, Table } from 'airtable'
import { generateRandomString, sign } from '../../../common/rapyd-helper'
import getAppConfig from '../../../modules/config'
import {
  BAGBEE_REFERENCE,
  calcStoragePrice,
  deriveStorageType,
  getStorageRates,
  LUGGAGE_LOCKERS_REFERENCE,
} from '../../../utils/storagePricing'
import { fetchClosedDates, firstClosedDate, sourceToScope } from '../../../utils/closedDates'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'
const SITE_URL = 'https://www.bagbee.is'

// Only these client-supplied fields are written to Airtable (union of what
// the /luggagestorage form and the luggage-lockers embed send, plus the
// legacy Flight fields the pricing inputs read). Everything else is
// server-owned — spreading raw req.body let a tampered request set
// privileged fields like `Paid?` (skipping payment AND muting the
// unconfirmed-booking alert), Rapyd IDs, or `Dropped off`.
const ALLOWED_BOOKING_FIELDS = [
  'Name',
  'Email',
  'PhoneNumber',
  'Luggage',
  'Backpack / Purse (ISK 1000 pr. item)',
  'ArrivalDate',
  'Arrival time',
  'Departure date',
  'Departure time',
  'Delivery Service',
  'Delivery Address',
  'Late check-out (ISK 500 pr. bag)',
  'Hotel or Cruise ship name',
  'Athugasemd',
  'Flight Date',
  'Flight number',
] as const

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
  rapydAccessKey: string
): Promise<any> => {
  const path = '/v1/checkout'
  const body = {
    amount,
    currency: 'ISK',
    country: 'IS',
    language: 'EN',
    complete_payment_url: `${SITE_URL}/storage/payment-success?bookingId=${bookingId}`,
    error_payment_url: `${SITE_URL}/storage/payment-cancel?bookingId=${bookingId}`,
    // Wallets (Apple Pay) complete inline on the checkout page and follow
    // complete_checkout_url, NOT complete_payment_url — without these the
    // customer lands on the site homepage. Mirror the payment URLs.
    complete_checkout_url: `${SITE_URL}/storage/payment-success?bookingId=${bookingId}`,
    cancel_checkout_url: `${SITE_URL}/storage/payment-cancel?bookingId=${bookingId}`,
    // Surfaces in the Rapyd dashboard under "Merchant reference id" so storage
    // payments are identifiable at a glance — the other 4 Rapyd flows already
    // set this. Without it, storage shows "Not available" and looks orphaned.
    merchant_reference_id: `bagbee-storage-${bookingId}`,
    metadata: { bookingId },
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
          idempotency: Date.now().toString(),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          const parsed = JSON.parse(data)
          if (res.statusCode !== 200) return reject(parsed)
          resolve(parsed)
        })
      }
    )
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const {
    publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
  } = getAppConfig()

  // `source` tags partner-originated bookings (e.g. the luggagelockers.is embed
  // popup). It picks the rate profile + the Reference written to Airtable.
  const body = req.body as Record<string, unknown>
  const source = body.source

  // Copy only allowlisted fields — never spread the raw body into Airtable.
  // (The client-sent totalAmountIsk is likewise ignored; the total is
  // recomputed server-side below.)
  const fields: Record<string, unknown> = {}
  for (const key of ALLOWED_BOOKING_FIELDS) {
    if (body[key] !== undefined) fields[key] = body[key]
  }

  // Map the trusted `source` to a Reference + rate profile server-side. The
  // client never gets to pick its own price tier — only a known source does.
  // Every booking is tagged: partner popup → its domain; otherwise bagbee.is.
  const reference =
    source === 'luggage-lockers' ? LUGGAGE_LOCKERS_REFERENCE : BAGBEE_REFERENCE
  const rates = getStorageRates(reference)

  try {
    const table = getStorageTable()

    // Derive Type of storage server-side so it's authoritative even when the
    // client form omits it (e.g. legacy chatbot bookings or third-party
    // integrations hitting this endpoint).
    const priceInputs = {
      arrivalDate: fields['ArrivalDate'] as string,
      departureDate: fields['Departure date'] as string,
      luggage: Number(fields['Luggage']) || 0,
      backpacks: Number(fields['Backpack / Purse (ISK 1000 pr. item)']) || 0,
      late: !!fields['Late check-out (ISK 500 pr. bag)'],
      delivery: !!fields['Delivery Service'],
      flightDate: fields['Flight Date'] as string | undefined,
    }
    const storageType = deriveStorageType(priceInputs)

    // Reject bookings whose drop-off or pick-up falls on a staff-closed day
    // (Airtable "Closed Dates"). Fail open if the lookup errors — never block
    // a booking on a transient Airtable hiccup.
    try {
      const closed = await fetchClosedDates(sourceToScope(reference))
      const hit = firstClosedDate(closed, priceInputs.arrivalDate, priceInputs.departureDate)
      if (hit) {
        return res
          .status(409)
          .json({ message: `We are closed for bookings on ${hit}. Please choose another date.` })
      }
    } catch (e) {
      console.error('[Storage checkout] closed-date check failed (allowing booking):', e)
    }

    // Recompute the total server-side from the booking inputs + rate profile.
    // The client-sent `totalAmountIsk` is NOT trusted (a tampered request could
    // otherwise set its own price). For BagBee's own form this yields the same
    // number; for partner sources it applies the partner's published rates.
    const total = calcStoragePrice(priceInputs, rates).total
    if (!Number.isFinite(total) || total <= 0) {
      return res.status(400).json({ message: 'Invalid booking — nothing to charge' })
    }

    // 1. Create Airtable record with Pending payment status
    const created = await table.create([
      {
        fields: {
          ...fields,
          ...(reference ? { Reference: reference } : {}),
          'Payment Status': 'Pending',
          'Total Amount ISK': total,
          'Type of storage': storageType,
        } as FieldSet,
      },
    ])
    const bookingId = created[0].id

    // 2. Create Rapyd checkout (server-computed total — never the client value)
    const checkout = await createRapydCheckout(
      total,
      bookingId,
      rapydBaseUrl as string,
      rapydAccessKey as string
    )

    const checkoutId: string | undefined = checkout.data?.id
    const redirectUrl: string | undefined = checkout.data?.redirect_url

    // 3. Save checkout ID back to the record
    if (checkoutId) {
      await table.update(bookingId, { 'Rapyd Checkout ID': checkoutId } as FieldSet)
    }

    return res.status(200).json({ bookingId, redirectUrl })
  } catch (err) {
    console.error('[Storage checkout] Failed:', err)
    return res.status(500).json({ message: (err as Error).message || 'Checkout failed' })
  }
}
