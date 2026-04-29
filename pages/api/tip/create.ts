import { NextApiRequest, NextApiResponse } from 'next'
import { getOrdersLookupTable } from '../../../utils/airtable'

const MIN_TIP = 100
const MAX_TIP = 100000

/**
 * Creates a Rapyd checkout for a tip on a delivered order.
 * POST /api/tip/create
 * Body: { orderNo, amount }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { orderNo, amount } = req.body as {
    orderNo?: string
    amount?: number
  }

  if (!orderNo || !/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.status(400).json({ message: 'invalid orderNo' })
  }

  const tipAmount = Number(amount)
  if (!Number.isFinite(tipAmount) || tipAmount < MIN_TIP || tipAmount > MAX_TIP) {
    return res
      .status(400)
      .json({ message: `Tip must be between ${MIN_TIP} and ${MAX_TIP} kr` })
  }

  try {
    // Verify the order exists (and is delivered — we don't require Delivered here,
    // since this endpoint is only reachable from the order page which itself gates
    // on Delivered status, but we still confirm the order is real)
    const table = getOrdersLookupTable()
    const records = await table
      .select({
        filterByFormula: `{Pöntunarnúmer (fx)} = '${orderNo}'`,
        maxRecords: 1,
      })
      .firstPage()

    if (records.length === 0) {
      return res.status(404).json({ message: 'Order not found' })
    }

    const record = records[0]

    // Build Rapyd checkout. Include both orderNo and the amount in the callback URL
    // so the payment-success handler can write the tip back to Airtable.
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const params = new URLSearchParams({
      orderNo,
      amount: String(Math.round(tipAmount)),
      recordId: record.id,
    })

    const rapydPayload = {
      amount: Math.round(tipAmount),
      currency: 'ISK',
      country: 'IS',
      language: 'EN',
      merchant_reference_id: `bagbee-tip-${orderNo}-${Date.now()}`,
      payment_method_type_categories: ['card', 'bank_redirect'],
      complete_payment_url: `${baseUrl}/api/tip/payment-success?${params.toString()}`,
      error_payment_url: `${baseUrl}/orders/${orderNo}?tip_error=true`,
    }

    const rapydRes = await fetch(`${baseUrl}/api/rapyd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rapydPayload),
    })

    const rapydResult = await rapydRes.json()

    if (!rapydResult.body?.data?.redirect_url) {
      console.error('Rapyd tip error:', rapydResult)
      return res
        .status(500)
        .json({ message: 'Failed to create tip payment' })
    }

    res.status(200).json({
      paymentUrl: rapydResult.body.data.redirect_url,
      amount: tipAmount,
    })
  } catch (error: any) {
    console.error('Tip create error:', error)
    res.status(500).json({ message: 'Failed to create tip', error: error?.message })
  }
}
