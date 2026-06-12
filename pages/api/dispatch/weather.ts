import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../utils/dispatch/auth'
import {
  getRouteWeather,
  WIND_HARD_LIMIT_MS,
  WIND_WARN_LIMIT_MS,
} from '../../../utils/dispatch/vedur'

// GET /api/dispatch/weather
// Fetches current Vegagerðin road-weather readings for the stations that
// matter to BagBee's evening run (Reykjanesbraut today). Used to gate the
// "Plan routes" button when sustained wind on Road 41 hits 23 m/s.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  if (!requireAdmin(req, res)) return

  try {
    const stations = await getRouteWeather()
    const maxWind = stations.reduce<number>(
      (m, s) => (s.windMs != null && s.windMs > m ? s.windMs : m),
      0,
    )
    const status: 'ok' | 'warn' | 'block' =
      maxWind >= WIND_HARD_LIMIT_MS
        ? 'block'
        : maxWind >= WIND_WARN_LIMIT_MS
        ? 'warn'
        : 'ok'

    res.setHeader(
      'Cache-Control',
      // Vegagerðin updates the stations every 10 min, so keep a short
      // server-side cache window. SWR pattern keeps the dashboard snappy
      // even if the upstream is slow.
      's-maxage=60, stale-while-revalidate=300',
    )
    res.status(200).json({
      stations,
      maxWind,
      status,
      thresholds: { warn: WIND_WARN_LIMIT_MS, block: WIND_HARD_LIMIT_MS },
    })
  } catch (err: any) {
    console.error('dispatch/weather error:', err)
    res
      .status(502)
      .json({ message: 'Failed to fetch road weather', error: err?.message })
  }
}
