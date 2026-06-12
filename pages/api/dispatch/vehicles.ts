import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../utils/dispatch/auth'
import { getFleet } from '../../../utils/dispatch/fleet'

// GET /api/dispatch/vehicles — Own Fleet + Rentals from the Fleet Management
// base, for the per-driver car selector on the dashboard.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' })
  if (!requireAdmin(req, res)) return

  try {
    const fleet = await getFleet()
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json(fleet)
  } catch (err: any) {
    console.error('dispatch/vehicles error:', err)
    // 200 with empty so the dashboard degrades gracefully if the token lacks
    // access to the Fleet base.
    res.status(200).json({ own: [], rentals: [], error: err?.message })
  }
}
