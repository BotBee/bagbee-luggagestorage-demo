import { NextApiRequest, NextApiResponse } from 'next'
import { getOrdersLookupTable } from '../../../utils/airtable'

/**
 * Called by Rapyd after successful surcharge payment.
 * Updates the Airtable record with new bag counts, amount, timing, and triggers Update OC.
 * Then redirects the user back to the order page.
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
  } = req.query as Record<string, string>

  if (!orderNo || !/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.redirect(`/orders/?error=true`)
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

    // Trigger the Update OC automation
    updateFields['Update Order'] = ['Update OC']

    await table.update(record.id, updateFields)

    // Redirect back to order page with success
    res.redirect(`/orders/${orderNo}?paid=true`)
  } catch (error) {
    console.error('Payment success handler error:', error)
    res.redirect(`/orders/${orderNo}?error=true`)
  }
}
