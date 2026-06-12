import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveDriver } from '../../../utils/dispatch/driverAuth'
import { updateDriverGps } from '../../../utils/dispatch/dispatchStore'

function todayIsoUtc(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
}

// POST /api/driver/ping
// Body: { lat, lng, at?, date? }  — high-frequency GPS from the driver app.
// Writes the latest position onto the driver's Dispatch Plans row for the day.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })

  const driverRecordId = resolveDriver(req)
  if (!driverRecordId) return res.status(401).json({ message: 'Unauthorized' })

  const { lat, lng, at, date } = (req.body || {}) as {
    lat?: number
    lng?: number
    at?: string
    date?: string
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ message: 'lat and lng (numbers) required' })
  }
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIsoUtc()
  const stamp = at || new Date().toISOString()

  try {
    const ok = await updateDriverGps(day, driverRecordId, lat, lng, stamp)
    // 200 even if no plan row yet — the app shouldn't error mid-shift over a
    // missing plan; it just means nothing to attach the position to.
    res.status(200).json({ ok, matchedPlan: ok })
  } catch (err: any) {
    console.error('driver/ping error:', err)
    res.status(500).json({ message: 'Failed to record ping', error: err?.message })
  }
}
