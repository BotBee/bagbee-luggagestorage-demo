import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../utils/dispatch/auth'
import { savePlan, PlanRoute } from '../../../utils/dispatch/dispatchStore'
import type { ShiftName } from '../../../utils/dispatch/fields'

const VALID_SHIFTS: ShiftName[] = ['Evening', 'Morning', 'Day']

// POST /api/dispatch/save-plan
// Body: { date, shift, routes }  (routes = the enriched plan the dashboard
// is showing, including any locks/overrides the dispatcher applied).
// Persists to Dispatch Plans + Dispatch Stops so the driver app can read it.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })
  if (!requireAdmin(req, res)) return

  const { date, shift, routes, vehicles } = (req.body || {}) as {
    date?: string
    shift?: ShiftName
    routes?: PlanRoute[]
    // Driver-record-id → assigned van label, stored on the plan + shown to
    // the driver app.
    vehicles?: Record<string, string>
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: 'date must be YYYY-MM-DD' })
  }
  const shiftName = (shift || 'Evening') as ShiftName
  if (!VALID_SHIFTS.includes(shiftName)) {
    return res.status(400).json({ message: `shift must be one of ${VALID_SHIFTS.join(', ')}` })
  }
  if (!Array.isArray(routes) || routes.length === 0) {
    return res.status(400).json({ message: 'routes required — plan first, then save' })
  }

  try {
    const result = await savePlan(date, shiftName, routes, vehicles)
    res.status(200).json({ ok: true, date, shift: shiftName, ...result })
  } catch (err: any) {
    console.error('dispatch/save-plan error:', err)
    res.status(500).json({ message: 'Failed to save plan', error: err?.message })
  }
}
