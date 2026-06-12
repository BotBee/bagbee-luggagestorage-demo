import { NextApiRequest, NextApiResponse } from 'next'
import Airtable, { FieldSet, Table } from 'airtable'
import { getOrdersLookupTable, getTable } from '../../../utils/airtable'
import {
  DAY_STORAGE_BSI_SLOTS,
  isCruisePortAddress,
} from '../../../common/transportConstants'
import getAppConfig from '../../../modules/config'
import {
  signRedirectParams,
  DAY_STORAGE_SIGNED_FIELDS,
} from '../../../utils/paymentRedirectSig'

// Cruise day-storage pricing (ISK). No pickup fee — the driver is already at
// the pier collecting the checked luggage. Two categories:
//   largeBags = luggage items (suitcases, sports bags) @ 2000
//   smallBags = backpacks / purses (≤50 cm w/ straps) @ 1500
// Source of truth — keep in sync with the order-page steppers and is/en locales.
const PRICE_PER_LARGE_BAG = 2000 // luggage items
const PRICE_PER_SMALL_BAG = 1500 // backpacks / purses
const MAX_TOTAL_BAGS = 10

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'
const BSI_DELIVERY_LABEL = 'BSÍ bus terminal (Flybus)'

const getStorageTable = (): Table<FieldSet> => {
  const {
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
  } = getAppConfig()
  Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
  return Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)
}

const VALID_BSI_SLOTS = new Set(DAY_STORAGE_BSI_SLOTS.map((s) => s.value))

/**
 * Cruise day-storage add-on. Sold post-payment from /orders/{code} to
 * disembarkation passengers whose check-in pickup is a cruise terminal. One
 * payment creates TWO records:
 *   1. a Pickup & Delivery dispatch order (cruise terminal → BSÍ) so a driver
 *      collects the hand luggage alongside the checked bags, and
 *   2. a BSÍ storage hold flagged `Cruise Pickup`, which the customer collects
 *      at the BSÍ counter (or a locker after 17:00).
 *
 * POST /api/day-storage/create
 * Body: { orderNo, smallBags, largeBags, bsiSlot, locale }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { orderNo, smallBags, largeBags, bsiSlot, locale } = req.body as {
    orderNo?: string
    smallBags?: number
    largeBags?: number
    bsiSlot?: string
    locale?: string
  }

  if (!orderNo || !/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.status(400).json({ message: 'invalid orderNo' })
  }

  const small = Number(smallBags)
  const large = Number(largeBags)
  if (
    !Number.isInteger(small) ||
    !Number.isInteger(large) ||
    small < 0 ||
    large < 0
  ) {
    return res.status(400).json({ message: 'invalid bag counts' })
  }
  const totalBags = small + large
  if (totalBags < 1) {
    return res.status(400).json({ message: 'at least one bag required' })
  }
  if (totalBags > MAX_TOTAL_BAGS) {
    return res.status(400).json({ message: `maximum ${MAX_TOTAL_BAGS} bags` })
  }

  if (!bsiSlot || !VALID_BSI_SLOTS.has(bsiSlot)) {
    return res.status(400).json({ message: 'invalid BSÍ collection slot' })
  }

  try {
    // 1. Look up the source check-in order (always the prod table).
    const ordersLookup = getOrdersLookupTable()
    const found = await ordersLookup
      .select({
        filterByFormula: `{Pöntunarnúmer (fx)} = '${orderNo}'`,
        maxRecords: 1,
      })
      .firstPage()

    if (found.length === 0) {
      return res.status(404).json({ message: 'Order not found' })
    }

    const source = found[0]
    const f = source.fields as Record<string, any>
    // Check-in orders (Departure Service) store the pickup location in
    // `Short Address`; transport orders use `Heimilisfang`. Prefer whichever
    // actually names the cruise terminal so the dispatch order's pickup leg is
    // correct.
    const heimilisfang = String(f['Heimilisfang'] || '')
    const shortAddress = String(f['Short Address'] || '')

    // 2. Server-side guard: this add-on is cruise-port-only. Don't trust the
    //    client gate. The check-in flow stores a Google Plus Code in
    //    Heimilisfang (no terminal name) and the readable label in Short
    //    Address, so we must accept a match on EITHER field.
    if (!isCruisePortAddress(heimilisfang) && !isCruisePortAddress(shortAddress)) {
      return res
        .status(400)
        .json({ message: 'Day storage is only available for cruise-terminal pickups' })
    }

    // Pickup address for the driver: prefer the geocodable Heimilisfang (Plus
    // Code or terminal label) so dispatch maps it correctly; fall back to the
    // Short Address label. Carry the readable label in the comment regardless.
    const pickupAddress = heimilisfang || shortAddress
    const pickupLabel = shortAddress || heimilisfang

    const name = String(f['Nafn viðskiptavinar'] || '')
    const email = String(f['Tölvupóstfang'] || '')
    const phone = String(f['Símanúmer'] || f['Sími'] || '')
    const pickupDate = String(f['Dagsetning pick-up'] || '')
    const pickupTime = String(f['Tímasetning'] || '')
    const lang = locale === 'en' ? 'en' : 'is'

    // Cruise ship name: renderLocation embeds it as "… — Cruise: <ship>" in
    // either address field; fall back to Hótel Nafn if present.
    const shipMatch = (heimilisfang + ' ' + shortAddress).match(/Cruise:\s*(.+?)\s*$/i)
    const shipName = (shipMatch ? shipMatch[1] : String(f['Hótel Nafn'] || '')).trim()

    // 3. Price (server-authoritative).
    const total = large * PRICE_PER_LARGE_BAG + small * PRICE_PER_SMALL_BAG

    const comment = [
      '[Cruise day-storage — driver pickup]',
      `Source order: ${orderNo}`,
      `Pickup: ${pickupLabel}`,
      `Luggage items: ${large} × ${PRICE_PER_LARGE_BAG} kr`,
      `Backpacks/purses: ${small} × ${PRICE_PER_SMALL_BAG} kr`,
      `Collect at BSÍ: ${bsiSlot}`,
    ].join('\n')

    // 4. Dispatch order (Pickup & Delivery: cruise terminal → BSÍ). Created via
    //    getTable() so the existing webhook `baggage` path (which also uses
    //    getTable()) marks it paid. typecast:true lets Airtable auto-create the
    //    time-window select option for the chosen BSÍ slot.
    const ordersTable = getTable()
    const dispatchFields: Record<string, any> = {
      'Nafn viðskiptavinar': name,
      Tölvupóstfang: email,
      Símanúmer: phone,
      Töskufjöldi_no: totalBags,
      'Dagsetning pick-up': pickupDate,
      Tímasetning: pickupTime,
      Heimilisfang: pickupAddress,
      'Delivery date': pickupDate,
      'Delivery Time-window': bsiSlot,
      'Delivery Address': BSI_DELIVERY_LABEL,
      'Annað (comment)': comment,
      Greitt: false,
      Greiðslustaða: 'Ógreitt',
      Upphæð: total,
      Gengi: 'ISK',
      Málstaðall: lang,
      Reference: 'Transport',
      // MUST stay 'Pickup & Delivery': the Make "Push Order to OptimoRoute"
      // scenario is a router with one branch per exact Requested-service value
      // and has NO branch for any other value — so anything else means the
      // driver leg never gets routed to OptimoRoute.
      'Requested service': 'Pickup & Delivery',
      // Internal cruise day-storage driver leg — the customer already gets a
      // storage confirmation, so they must NOT get a booking-confirmation for
      // this leg. The Airtable "Order Confirmation" automation skips sending
      // the webhook when this red checkbox is set.
      'No confirmation': true,
    }
    if (shipName) dispatchFields['Hótel Nafn'] = shipName

    const createdOrder = await ordersTable.create([{ fields: dispatchFields as FieldSet }], {
      typecast: true,
    })
    const orderRecordId = createdOrder[0].id

    // 5. BSÍ storage hold.
    const storageTable = getStorageTable()
    const storageFields: Record<string, any> = {
      Name: name,
      Email: email,
      PhoneNumber: phone,
      'Type of storage': 'Cruise day-storage',
      ArrivalDate: pickupDate,
      'Departure date': pickupDate,
      'Departure time': bsiSlot,
      // Store the two categories separately so the storage record + the
      // confirmation email show accurate quantities (large = luggage items,
      // small = backpacks / purses).
      Luggage: large,
      'Backpack / Purse (ISK 1000 pr. item)': small,
      'Hotel or Cruise ship name': shipName,
      Athugasemd: comment,
      'Cruise Pickup': true,
      'Delivery Service': false,
      'Total Amount ISK': total,
      'Payment Status': 'Pending',
    }
    const createdStorage = await storageTable.create([{ fields: storageFields as FieldSet }], {
      typecast: true,
    })
    const storageRecordId = createdStorage[0].id

    // 6. One Rapyd checkout covers both records. The webhook + payment-success
    //    use metadata.tableType==='day-storage' to mark both paid.
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    // HMAC-sign the callback params — payment-success refuses unsigned
    // requests, otherwise anyone could mark both records paid (and fire the
    // confirmation email) without paying. See utils/paymentRedirectSig.ts.
    const signedParams = { orderNo, orderRecordId, storageRecordId }
    const { exp, sig } = signRedirectParams(
      'day-storage',
      DAY_STORAGE_SIGNED_FIELDS,
      signedParams
    )
    const successParams = new URLSearchParams({ ...signedParams, exp, sig })

    const rapydPayload = {
      amount: total,
      currency: 'ISK',
      country: 'IS',
      language: 'EN',
      merchant_reference_id: `bagbee-day-storage-${orderRecordId}`,
      // payment_method_type_categories deliberately omitted — bank_redirect is
      // disabled on our Rapyd account; let Rapyd use the account defaults (see
      // pages/api/fast-track/create.ts).
      complete_payment_url: `${baseUrl}/api/day-storage/payment-success?${successParams.toString()}`,
      error_payment_url: `${baseUrl}/orders/${orderNo}?day_storage_error=true`,
      metadata: {
        tableType: 'day-storage',
        recordId: orderRecordId,
        bookingId: storageRecordId,
      },
    }

    const rapydRes = await fetch(`${baseUrl}/api/rapyd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rapydPayload),
    })
    const rapydResult = await rapydRes.json()

    if (!rapydResult.body?.data?.redirect_url) {
      console.error('[day-storage] Rapyd error:', rapydResult)
      return res.status(500).json({ message: 'Failed to create payment link' })
    }

    return res.status(200).json({
      paymentUrl: rapydResult.body.data.redirect_url,
      amount: total,
    })
  } catch (error: any) {
    console.error('[day-storage] create error:', error)
    return res
      .status(500)
      .json({ message: 'Failed to create day-storage order', error: error?.message })
  }
}
