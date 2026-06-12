import type { NextApiRequest } from 'next'
import { verifyDriverToken } from './driverToken'

// Resolve the calling driver's recordId from the request.
//  - Normal: Authorization: Bearer <driver token> (HMAC-signed recordId).
//  - Testing: Authorization: Bearer <DISPATCH_ADMIN_KEY> + ?driver=rec…
// Returns the recordId or null.
export function resolveDriver(req: NextApiRequest): string | null {
  const header = (req.headers.authorization as string) || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null

  const admin = process.env.DISPATCH_ADMIN_KEY
  if (admin && token === admin) {
    const d = (req.query.driver as string) || ''
    return /^rec[A-Za-z0-9]{14}$/.test(d) ? d : null
  }
  return verifyDriverToken(token)
}
