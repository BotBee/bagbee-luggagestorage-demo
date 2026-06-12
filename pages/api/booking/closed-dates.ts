/**
 * GET /api/booking/closed-dates?source=luggage-lockers|bikerent|bagbee
 *
 * Returns the days that are closed for online bookings, so the booking forms
 * can disable them in the date picker. Driven by the Airtable "Closed Dates"
 * table (staff edit it to close days). Fails open (empty list) on error so a
 * transient Airtable hiccup never blocks the whole calendar.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchClosedDates, sourceToScope } from '../../../utils/closedDates'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  try {
    const scope = sourceToScope(req.query.source as string | undefined)
    const dates = await fetchClosedDates(scope)
    // Short cache — closures change rarely; staff edits show within ~5 min.
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ dates })
  } catch (err) {
    console.error('[closed-dates] failed:', err)
    return res.status(200).json({ dates: [] })
  }
}
