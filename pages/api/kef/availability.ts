/**
 * GET /api/kef/availability
 *   ?dropoffDate=YYYY-MM-DD&dropoffTime=HH:MM&dropoffHours=3
 *   &returnLocation=kef|bsi[&pickupDate&pickupTime&pickupHours]
 *
 * Returns how many of the 2 KEF bike-box lockers are free for the requested
 * drop-off (and, for a KEF return, pickup) window — so the form can cap boxes
 * and block full slots. Fails open (maxBoxes = 2) on error so a transient
 * Airtable hiccup never hard-blocks bookings (checkout re-checks authoritatively).
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { checkAvailability, isoDateTime, type WindowReq } from '../../../utils/kefBooking'

const windowFromQuery = (date?: string, time?: string, hours?: string): WindowReq | null => {
  if (!date || !time) return null
  const start = Date.parse(isoDateTime(date, time))
  if (isNaN(start)) return null
  const h = Math.max(3, Number(hours) || 3)
  return { start, end: start + h * 60 * 60 * 1000 }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const q = req.query as Record<string, string>

  const dropoff = windowFromQuery(q.dropoffDate, q.dropoffTime, q.dropoffHours)
  if (!dropoff) {
    return res.status(400).json({ message: 'Missing/invalid drop-off window' })
  }
  const isKefReturn = q.returnLocation !== 'bsi'
  const pickup = isKefReturn
    ? windowFromQuery(q.pickupDate, q.pickupTime, q.pickupHours)
    : null

  try {
    const avail = await checkAvailability(dropoff, pickup)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(avail)
  } catch (err) {
    console.error('[kef availability] failed:', err)
    return res.status(200).json({ freeDropoff: 2, freePickup: 2, maxBoxes: 2 })
  }
}
