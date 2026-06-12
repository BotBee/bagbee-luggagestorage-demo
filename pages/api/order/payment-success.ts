import { NextApiRequest, NextApiResponse } from 'next'
import { getOrdersLookupTable } from '../../../utils/airtable'
import { verifySurchargeParams } from '../../../utils/orderSurchargeSig'

/**
 * Called by Rapyd after successful surcharge payment.
 * Updates the Airtable record with new bag counts, amount, timing, and triggers Update OC.
 * Then redirects the user back to the order page.
 *
 * Signature requirement: the surcharge URL is built by /api/order/update,
 * which HMAC-signs every param it puts in here. Without a matching `sig`
 * and unexpired `exp`, we refuse — otherwise anyone could hit this URL
 * directly with crafted bags / amount / address values to rewrite an
 * order they don't own. See utils/orderSurchargeSig.ts.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const {
    orderNo,
    bags,
    oddSize,
    amount,
    timeWindow,
    address,
    pickupDate,
    deliveryAddress,
    deliveryDate,
    deliveryTimeWindow,
    exp,
    sig,
  } = req.query as Record<string, string>

  if (!orderNo || !/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.redirect(`/orders/?error=true`)
  }

  // Verify the HMAC before touching Airtable. Reasons logged for ops
  // visibility; user-facing redirect is the same generic ?error=true so
  // we don't tell attackers which check failed.
  const verdict = verifySurchargeParams(
    {
      orderNo,
      bags,
      oddSize,
      amount,
      timeWindow,
      address,
      pickupDate,
      deliveryAddress,
      deliveryDate,
      deliveryTimeWindow,
    },
    exp,
    sig
  )
  if (!verdict.ok) {
    console.warn(
      '[payment-success] rejected surcharge callback',
      { orderNo, reason: verdict.reason }
    )
    return res.redirect(`/orders/${orderNo}?error=true`)
  }

  try {
    const table = getOrdersLookupTable()
    const records = await table
      .select({
        filterByFormula: `{Pöntunarnúmer (fx)} = '${orderNo}'`,
        maxRecords: 1,
      })
      .firstPage()

    if (records.length === 0) {
      return res.redirect(`/orders/${orderNo}?error=true`)
    }
    const record = records[0]

    // Build update payload
    const updateFields: Record<string, any> = {}

    if (bags) {
      updateFields['Töskufjöldi_no'] = parseInt(bags)
    }
    if (oddSize) {
      updateFields['Töskufjöldi_no_yfirstærð'] = parseInt(oddSize)
    }
    if (amount) {
      updateFields['Upphæð'] = parseInt(amount)
    }
    if (timeWindow) {
      updateFields['Tímasetning'] = timeWindow
    }
    if (address) {
      updateFields['Heimilisfang'] = address
      const shortAddr = address.split(',')[0]?.trim() || address
      updateFields['Short Address'] = shortAddr
    }
    if (pickupDate) {
      updateFields['Dagsetning pick-up'] = pickupDate
    }
    if (deliveryAddress) {
      updateFields['Delivery Address'] = deliveryAddress
    }
    if (deliveryDate) {
      updateFields['Delivery date'] = deliveryDate
    }
    if (deliveryTimeWindow) {
      updateFields['Delivery Time-window'] = deliveryTimeWindow
    }

    // Clear then re-set Update OC to ensure the automation triggers every
    // time. See the comment in /api/order/update.ts for why the 750ms wait
    // is required — Airtable coalesces back-to-back PATCHes on the same
    // field into a single event, which makes the automation miss the
    // transition when the prior value was already ['Update OC'].
    await table.update(record.id, {
      'Update Order (add bags, send order confirmation etc)': [],
    })
    await new Promise((resolve) => setTimeout(resolve, 750))

    updateFields['Update Order (add bags, send order confirmation etc)'] = ['Update OC']
    await table.update(record.id, updateFields)

    // Redirect back to order page with success
    res.redirect(`/orders/${orderNo}?paid=true`)
  } catch (error) {
    console.error('Payment success handler error:', error)
    res.redirect(`/orders/${orderNo}?error=true`)
  }
}
