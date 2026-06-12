import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../utils/dispatch/auth'
import { scheduleSend } from '../../../utils/dispatch/dispatchStore'
import type { ShiftName } from '../../../utils/dispatch/fields'

const VALID_SHIFTS: ShiftName[] = ['Evening', 'Morning', 'Day']

// POST /api/dispatch/schedule-send
// Body: { date, shift, sendAt }  — sendAt = ISO-8601 UTC, or null to cancel.
// Marks the saved plan to auto-publish/notify at sendAt. The cron worker
// (/api/dispatch/cron-dispatch) fires it when the time passes.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })
  if (!requireAdmin(req, res)) return

  const { date, shift, sendAt } = (req.body || {}) as {
    date?: string
    shift?: ShiftName
    sendAt?: string | null
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: 'date must be YYYY-MM-DD' })
  }
  const shiftName = (shift || 'Evening') as ShiftName
  if (!VALID_SHIFTS.includes(shiftName)) {
    return res.status(400).json({ message: `shift must be one of ${VALID_SHIFTS.join(', ')}` })
  }
  if (sendAt != null && isNaN(Date.parse(sendAt))) {
    return res.status(400).json({ message: 'sendAt must be an ISO datetime or null' })
  }

  try {
    const affected = await scheduleSend(date, shiftName, sendAt ?? null)
    if (affected === 0) {
      return res.status(409).json({ message: 'No saved plan for this date/shift — Save & share first' })
    }
    res.status(200).json({ ok: true, affected, scheduledFor: sendAt ?? null })
  } catch (err: any) {
    console.error('dispatch/schedule-send error:', err)
    res.status(500).json({ message: 'Failed to schedule send', error: err?.message })
  }
}
