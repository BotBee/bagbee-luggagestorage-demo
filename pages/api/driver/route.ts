import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveDriver } from '../../../utils/dispatch/driverAuth'
import { getDriverRoute } from '../../../utils/dispatch/dispatchStore'
import { BSI_DEPOT } from '../../../utils/dispatch/fields'

function todayIsoUtc(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
}

// GET /api/driver/route?date=YYYY-MM-DD
// Returns the calling driver's saved route for the date (default: today).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' })

  const driverRecordId = resolveDriver(req)
  if (!driverRecordId) return res.status(401).json({ message: 'Unauthorized' })

  const date = (req.query.date as string) || todayIsoUtc()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: 'date must be YYYY-MM-DD' })
  }

  try {
    const { plan, stops } = await getDriverRoute(date, driverRecordId)
    const enriched = stops.map((s) => ({
      ...s,
      navUrl:
        s.lat != null && s.lng != null
          ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`
          : null,
    }))
    res.status(200).json({
      driver: { recordId: driverRecordId, name: plan ? plan['fld1IgLSv1lbRlJoe'] ?? null : null },
      date,
      depot: { name: 'BSÍ', lat: BSI_DEPOT.lat, lng: BSI_DEPOT.lng },
      planFinalizedAt: plan ? plan['fld9oOHMhDibTL4LF'] ?? null : null,
      // Assigned van + publish state — see DRIVER_APP_API.md notes.
      vehicle: plan ? plan['fldkbnilKHwgg00hw'] ?? null : null,
      planSendStatus: plan ? plan['fldQRXqC0itR65tB1'] ?? null : null,
      stops: enriched,
    })
  } catch (err: any) {
    console.error('driver/route error:', err)
    res.status(500).json({ message: 'Failed to load route', error: err?.message })
  }
}
