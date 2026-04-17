import { NextApiRequest, NextApiResponse } from 'next'
import { getOrdersLookupTable } from '../../../utils/airtable'

const EXTRA_BAG_PRICE = 1990
const EXTRA_ODDSIZE_PRICE = 2490

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { orderNo, changes, originalBags, originalOddSize, originalAmount } =
    req.body

  if (!orderNo || !changes) {
    return res.status(400).json({ message: 'orderNo and changes are required' })
  }

  if (!/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.status(400).json({ message: 'invalid orderNo' })
  }

  try {
    // Find the record using server-side filter
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

    // Calculate surcharge
    const newBags = changes.bags ?? originalBags ?? 0
    const newOddSize = changes.oddSize ?? originalOddSize ?? 0
    const extraBags = Math.max(0, newBags - (originalBags ?? 0))
    const extraOddSize = Math.max(0, newOddSize - (originalOddSize ?? 0))
    const surcharge = extraBags * EXTRA_BAG_PRICE + extraOddSize * EXTRA_ODDSIZE_PRICE

    if (surcharge > 0) {
      // Payment needed — create Rapyd checkout for the surcharge
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

      // Encode the update params into the success callback URL
      const successParams = new URLSearchParams({
        orderNo,
        bags: String(newBags),
        oddSize: String(newOddSize),
        amount: String((originalAmount ?? 0) + surcharge),
        ...(changes.timeWindow ? { timeWindow: changes.timeWindow } : {}),
        ...(changes.address ? { address: changes.address } : {}),
      })

      const rapydPayload = {
        amount: surcharge,
        currency: 'ISK',
        country: 'IS',
        language: 'EN',
        merchant_reference_id: `bagbee-update-${orderNo}`,
        complete_payment_url: `${baseUrl}/api/order/payment-success?${successParams.toString()}`,
        error_payment_url: `${baseUrl}/orders/${orderNo}?error=true`,
      }

      // Call Rapyd via our existing endpoint
      const rapydRes = await fetch(`${baseUrl}/api/rapyd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rapydPayload),
      })

      const rapydResult = await rapydRes.json()

      if (rapydResult.body?.data?.redirect_url) {
        return res.status(200).json({
          paymentRequired: true,
          paymentUrl: rapydResult.body.data.redirect_url,
          surcharge,
        })
      } else {
        console.error('Rapyd error:', rapydResult)
        return res.status(500).json({ message: 'Failed to create payment link' })
      }
    }

    // Free update — no payment needed, update Airtable directly
    const updateFields: Record<string, any> = {}

    if (changes.timeWindow) {
      updateFields['Tímasetning'] = changes.timeWindow
    }
    if (changes.address) {
      updateFields['Heimilisfang'] = changes.address
      // Update Short Address with first part
      const shortAddr = changes.address.split(',')[0]?.trim() || changes.address
      updateFields['Short Address'] = shortAddr
    }

    // Trigger Update OC automation
    updateFields['Update Order'] = ['Update OC']

    await table.update(record.id, updateFields)

    res.status(200).json({
      paymentRequired: false,
      message: 'Order updated successfully',
    })
  } catch (error: any) {
    console.error('Order update error:', error)
    res.status(500).json({ message: 'Failed to update order' })
  }
}
