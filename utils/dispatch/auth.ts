import type { NextApiRequest, NextApiResponse } from 'next'

// Simple shared-secret gate for the dispatch admin endpoints.
// The dashboard sends `Authorization: Bearer <DISPATCH_ADMIN_KEY>` from
// a key the operator pastes once and we keep in localStorage.
//
// Returns true if authorized; otherwise writes a 401 and returns false.
export function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  // Trim defensively — env-var values pasted/piped into the host (Vercel) can
  // pick up stray whitespace or a trailing newline, which would otherwise break
  // the exact-match comparison below.
  const expected = (process.env.DISPATCH_ADMIN_KEY || '').trim()
  if (!expected) {
    res
      .status(500)
      .json({ message: 'DISPATCH_ADMIN_KEY not configured on server' })
    return false
  }

  const header = req.headers.authorization || ''
  const token = (header.startsWith('Bearer ') ? header.slice(7) : '').trim()
  if (token !== expected) {
    res.status(401).json({ message: 'Unauthorized' })
    return false
  }
  return true
}
