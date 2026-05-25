import type { NextApiRequest, NextApiResponse } from 'next'
import { timingSafeEqual } from 'crypto'

/**
 * Gate for API routes that should only ever be called from our own
 * server-side code (getServerSideProps, other API routes, scheduled jobs).
 *
 * The expected pattern at every call site is to send the secret as the
 * `x-internal-secret` header. Verified with a timing-safe compare to avoid
 * leaking the secret length / prefix via response timing.
 *
 * Why this is enough for /api/airtable/read-by-order-no and
 * /api/airtable/mark-paid-by-order-no: both are only invoked by the
 * getServerSideProps in pages/orders/[orderNo].tsx (verified by Grep —
 * no other callers). A customer's browser never hits them directly, so
 * requiring a server-only secret breaks every direct-attack path.
 *
 * If INTERNAL_API_SECRET is unset, requireInternalSecret() FAILS CLOSED
 * (returns false and writes 500). This is deliberate — we'd rather a
 * misconfigured deploy 500 than silently accept unauthenticated traffic.
 */
export function requireInternalSecret(
  req: NextApiRequest,
  res: NextApiResponse
): boolean {
  const expected = process.env.INTERNAL_API_SECRET
  if (!expected) {
    // Fail closed — without the env var we cannot authenticate anyone.
    console.error(
      '[internalApiAuth] INTERNAL_API_SECRET is not set; refusing request to',
      req.url
    )
    res.status(500).json({ message: 'Server misconfigured' })
    return false
  }

  const headerVal = req.headers['x-internal-secret']
  const provided = Array.isArray(headerVal) ? headerVal[0] : headerVal
  if (typeof provided !== 'string' || provided.length === 0) {
    res.status(403).json({ message: 'Forbidden' })
    return false
  }

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(403).json({ message: 'Forbidden' })
    return false
  }

  return true
}

/**
 * Helper for server-side fetch calls. Use at every getServerSideProps /
 * API-route call site that hits a route gated by requireInternalSecret.
 *
 *   await fetch(url, { headers: internalSecretHeaders(), ... })
 *
 * Returns an empty object (not the header) if the secret is unset, so the
 * fetch goes through and the called route's own check produces the 500 —
 * keeps the failure mode in one place.
 */
export function internalSecretHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET
  return secret ? { 'x-internal-secret': secret } : {}
}
