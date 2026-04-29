import { NextApiRequest, NextApiResponse } from 'next'
import { getFastTrackTable } from '../../../utils/airtable'

/**
 * Called by Rapyd after a successful Fast-Track payment.
 * Marks the Fast-Track record as paid and redirects the user back to the order page.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { recordId, orderNo, token } = req.query as Record<string, string>

  if (!orderNo) {
    return res.redirect(`/orders?error=true`)
  }

  if (!recordId || !/^rec[a-zA-Z0-9]+$/.test(recordId)) {
    return res.redirect(`/orders/${orderNo}?fast_track_error=true`)
  }

  try {
    const table = getFastTrackTable()

    const updateFields: Record<string, any> = {
      Greiddi: true,
    }
    if (token) {
      updateFields['Rapyd Payment ID'] = token
    }

    await table.update(recordId, updateFields)

    res.redirect(`/orders/${orderNo}?fast_track_paid=true`)
  } catch (error) {
    console.error('Fast-Track payment-success error:', error)
    res.redirect(`/orders/${orderNo}?fast_track_error=true`)
  }
}
