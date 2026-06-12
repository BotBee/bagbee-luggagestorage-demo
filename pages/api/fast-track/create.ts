import { NextApiRequest, NextApiResponse } from 'next'
import {
  getFastTrackTable,
  getOrdersLookupTable,
} from '../../../utils/airtable'
import {
  signRedirectParams,
  FAST_TRACK_SIGNED_FIELDS,
} from '../../../utils/paymentRedirectSig'

const FAST_TRACK_PRICE_PER_PASSENGER = 2490

type Passenger = { firstName: string; lastName: string }

/**
 * Creates a pending Fast-Track record and returns a Rapyd checkout URL.
 * POST /api/fast-track/create
 * Body: { orderNo, passengers: [{firstName, lastName}, ...], locale }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { orderNo, passengers, locale } = req.body as {
    orderNo?: string
    passengers?: Passenger[]
    locale?: string
  }

  if (!orderNo || !/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.status(400).json({ message: 'invalid orderNo' })
  }

  if (!Array.isArray(passengers) || passengers.length === 0) {
    return res.status(400).json({ message: 'at least one passenger required' })
  }

  if (passengers.length > 4) {
    return res.status(400).json({ message: 'maximum 4 passengers' })
  }

  // Validate passenger shapes
  for (const p of passengers) {
    if (
      !p ||
      typeof p.firstName !== 'string' ||
      typeof p.lastName !== 'string' ||
      !p.firstName.trim() ||
      !p.lastName.trim()
    ) {
      return res.status(400).json({ message: 'invalid passenger data' })
    }
  }

  try {
    // 1. Look up the main order so we can copy flight info onto the Fast-Track record
    const ordersTable = getOrdersLookupTable()
    const orderRecords = await ordersTable
      .select({
        filterByFormula: `{Pöntunarnúmer (fx)} = '${orderNo}'`,
        maxRecords: 1,
      })
      .firstPage()

    if (orderRecords.length === 0) {
      return res.status(404).json({ message: 'Order not found' })
    }

    const order = orderRecords[0]
    const orderFields = order.fields as Record<string, any>

    // 2. Extract flight info from the order
    const flightFull = String(orderFields['Flugnúmer'] || '')
    // Parse airline code + flight number from "NO1902" style
    const flightMatch = flightFull.match(/^([A-Z]+)(\d+)$/)
    const airlineCode = flightMatch ? flightMatch[1] : ''
    const flightNumber = flightMatch ? flightMatch[2] : flightFull

    const flightDate = String(orderFields['Dagsetning flugs'] || '')
    const destination = String(orderFields['Áfangastaður'] || '')
    const email = String(orderFields['Tölvupóstfang'] || '')
    const kennitala = String(orderFields['Kennitala'] || '')

    const totalAmount = passengers.length * FAST_TRACK_PRICE_PER_PASSENGER

    // 3. Build the Fast-Track record fields
    const fastTrackFields: Record<string, any> = {
      'Passenger 1 First Name': passengers[0].firstName,
      'Passenger 1 Last Name': passengers[0].lastName,
      Upphæð: totalAmount,
      AirlineCode: airlineCode,
      FlightNumber: flightNumber,
      Email: email,
      Destination: destination,
      Málstaðall: locale === 'en' ? 'en' : 'is',
      'order number': orderNo,
      Pöntunarnúmer: [order.id],
      Greiddi: false,
    }

    if (flightDate) fastTrackFields['Flight date'] = flightDate
    if (kennitala) fastTrackFields['Kennitala'] = kennitala

    if (passengers[1]) {
      fastTrackFields['Passenger 2 First Name'] = passengers[1].firstName
      fastTrackFields['Passenger 2 Last Name'] = passengers[1].lastName
    }
    if (passengers[2]) {
      fastTrackFields['Passenger 3 First Name'] = passengers[2].firstName
      fastTrackFields['Passenger 3 Last Name'] = passengers[2].lastName
    }
    if (passengers[3]) {
      fastTrackFields['Passenger 4 First Name'] = passengers[3].firstName
      fastTrackFields['Passenger 4 Last Name'] = passengers[3].lastName
    }

    // 4. Create pending Fast-Track record in Airtable
    const fastTrackTable = getFastTrackTable()
    const created = await fastTrackTable.create([{ fields: fastTrackFields }])
    const fastTrackId = created[0].id

    // 5. Create Rapyd checkout for the total amount
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    // HMAC-sign the callback params — payment-success refuses unsigned
    // requests, otherwise anyone could mark a pending Fast-Track record
    // paid without paying. See utils/paymentRedirectSig.ts.
    const signedParams = { orderNo, recordId: fastTrackId }
    const { exp, sig } = signRedirectParams(
      'fast-track',
      FAST_TRACK_SIGNED_FIELDS,
      signedParams
    )
    const successParams = new URLSearchParams({ ...signedParams, exp, sig })
    const successUrl = `${baseUrl}/api/fast-track/payment-success?${successParams.toString()}`
    const errorUrl = `${baseUrl}/orders/${orderNo}?fast_track_error=true`

    const rapydPayload = {
      amount: totalAmount,
      currency: 'ISK',
      country: 'IS',
      language: 'EN',
      merchant_reference_id: `bagbee-fast-track-${fastTrackId}`,
      // payment_method_type_categories deliberately omitted — `bank_redirect`
      // is disabled on our Rapyd merchant account, which caused Rapyd to
      // reject the checkout with ERROR_HOSTED_PAGE_PAYMENT_METHOD_TYPE_
      // CATEGORIES_NOT_ENABLED. Every other working flow (main booking,
      // storage, surcharge) omits this field and lets Rapyd use the
      // account's default categories. Match that pattern here.
      complete_payment_url: successUrl,
      error_payment_url: errorUrl,
      // Webhook (/api/payment/webhooks) reads metadata.recordId +
      // metadata.tableType to mark the Fast-Track row paid AND persist the
      // Rapyd Payment ID for later refunds via /api/rapyd/refund.
      metadata: {
        recordId: fastTrackId,
        tableType: 'fast-track',
      },
    }

    const rapydRes = await fetch(`${baseUrl}/api/rapyd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rapydPayload),
    })

    const rapydResult = await rapydRes.json()

    if (!rapydResult.body?.data?.redirect_url) {
      console.error('Rapyd error:', rapydResult)
      return res
        .status(500)
        .json({ message: 'Failed to create payment link' })
    }

    res.status(200).json({
      paymentUrl: rapydResult.body.data.redirect_url,
      amount: totalAmount,
      recordId: fastTrackId,
    })
  } catch (error: any) {
    console.error('Fast-Track create error:', error)
    res.status(500).json({
      message: 'Failed to create Fast-Track order',
      error: error?.message,
    })
  }
}
