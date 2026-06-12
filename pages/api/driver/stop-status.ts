import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveDriver } from '../../../utils/dispatch/driverAuth'
import { getStopOwner, updateStopStatus } from '../../../utils/dispatch/dispatchStore'

const VALID = ['pending', 'arrived', 'done', 'failed', 'skipped']

// POST /api/driver/stop-status
// Body: { stopId, status, note?, bagsPicked? }
// Driver marks progress at a stop. Scoped: a driver can only touch stops
// that belong to them.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })

  const driverRecordId = resolveDriver(req)
  if (!driverRecordId) return res.status(401).json({ message: 'Unauthorized' })

  const { stopId, status, note } = (req.body || {}) as {
    stopId?: string
    status?: string
    note?: string
  }
  if (!stopId || !/^rec[A-Za-z0-9]{14}$/.test(stopId)) {
    return res.status(400).json({ message: 'valid stopId required' })
  }
  if (!status || !VALID.includes(status)) {
    return res.status(400).json({ message: `status must be one of ${VALID.join(', ')}` })
  }

  try {
    const owner = await getStopOwner(stopId)
    if (owner !== driverRecordId) {
      return res.status(403).json({ message: 'Not your stop' })
    }
    const patch: { status: string; note?: string; actualArrival?: string } = { status }
    if (note != null) patch.note = String(note)
    // Stamp arrival time when the driver hits "arrived".
    if (status === 'arrived') patch.actualArrival = new Date().toISOString()
    await updateStopStatus(stopId, patch)
    res.status(200).json({ ok: true })
  } catch (err: any) {
    console.error('driver/stop-status error:', err)
    res.status(500).json({ message: 'Failed to update stop', error: err?.message })
  }
}
