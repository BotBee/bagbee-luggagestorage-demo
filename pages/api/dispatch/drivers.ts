import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../utils/dispatch/auth'
import { getDriversForShift } from '../../../utils/dispatch/airtable'
import type { ShiftName } from '../../../utils/dispatch/fields'

const VALID_SHIFTS: ShiftName[] = ['Evening', 'Morning', 'Day']

// GET /api/dispatch/drivers?date=YYYY-MM-DD&shift=Evening
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
    const drivers = await getDriversForShift(date, shift)
    res.status(200).json({ date, shift, count: drivers.length, drivers })
  } catch (err: any) {
    console.error('dispatch/drivers error:', err)
    res
      .status(500)
      .json({ message: 'Failed to load drivers', error: err?.message })
  }
}
