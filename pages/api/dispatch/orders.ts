import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../utils/dispatch/auth'
import { getOrdersForShift } from '../../../utils/dispatch/airtable'
import { geocodeMany } from '../../../utils/dispatch/geocode'
import type { ShiftName } from '../../../utils/dispatch/fields'

const VALID_SHIFTS: ShiftName[] = ['Evening', 'Morning', 'Day']

// GET /api/dispatch/orders?date=YYYY-MM-DD&shift=Evening
// Returns paid orders for the given pickup date + shift.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  if (!requireAdmin(req, res)) return

  const date = String(req.query.date || '')
  const shift = String(req.query.shift || 'Evening') as ShiftName

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: 'date must be YYYY-MM-DD' })
  }
  if (!VALID_SHIFTS.includes(shift)) {
    return res
      .status(400)
      .json({ message: `shift must be one of ${VALID_SHIFTS.join(', ')}` })
  }

  try {
    const orders = await getOrdersForShift(date, shift)
    // Geocode in parallel so the map can render markers for every order
    // even before "Plan routes" is clicked. Uncached addresses get one
    // Google hit each; cached ones (most repeat-customer addresses) are
    // free thanks to the on-disk cache.
    const uniqueAddresses = Array.from(
      new Set(orders.map((o) => o.pickupAddress).filter(Boolean)),
    )
    const coords = await geocodeMany(uniqueAddresses)
    const enriched = orders.map((o) => {
      const c = coords.get(o.pickupAddress)
      return { ...o, lat: c?.lat ?? null, lng: c?.lng ?? null }
    })
    res
      .status(200)
      .json({ date, shift, count: enriched.length, orders: enriched })
  } catch (err: any) {
    console.error('dispatch/orders error:', err)
    res.status(500).json({ message: 'Failed to load orders', error: err?.message })
  }
}
