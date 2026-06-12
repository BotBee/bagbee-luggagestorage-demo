import type { NextApiRequest, NextApiResponse } from 'next'
import { runDueSends } from '../../../utils/dispatch/dispatchStore'

// GET /api/dispatch/cron-dispatch
// Vercel Cron worker — fires scheduled plan sends whose time has passed.
// Auth: Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
// The DISPATCH_ADMIN_KEY is also accepted so it can be triggered manually.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const header = (req.headers.authorization as string) || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const cronSecret = process.env.CRON_SECRET
  const adminKey = process.env.DISPATCH_ADMIN_KEY
  const authorized =
    (cronSecret && token === cronSecret) || (adminKey && token === adminKey)
  if (!authorized) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const fired = await runDueSends(new Date().toISOString())
    res.status(200).json({ ok: true, firedCount: fired.length, fired })
  } catch (err: any) {
    console.error('dispatch/cron-dispatch error:', err)
    res.status(500).json({ message: 'Cron failed', error: err?.message })
  }
}
