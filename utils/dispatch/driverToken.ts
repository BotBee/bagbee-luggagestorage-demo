import crypto from 'crypto'

// Driver tokens are HMAC-signed strings encoding a Vaktaskipulag driver
// recordId. No DB lookup needed to validate; rotate DRIVER_TOKEN_SECRET to
// revoke every token at once. Format:
//   base64url(recordId) + "." + base64url(HMAC_SHA256(recordId, secret))

const SECRET = process.env.DRIVER_TOKEN_SECRET || ''

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function hmac(recordId: string): string {
  return b64url(
    crypto.createHmac('sha256', SECRET).update(recordId).digest(),
  )
}

export function signDriverToken(recordId: string): string {
  if (!SECRET) throw new Error('DRIVER_TOKEN_SECRET not configured')
  return `${b64url(recordId)}.${hmac(recordId)}`
}

// Returns the recordId if the token is valid, else null.
export function verifyDriverToken(token: string | undefined | null): string | null {
  if (!SECRET || !token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  let recordId: string
  try {
    recordId = Buffer.from(
      parts[0].replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8')
  } catch {
    return null
  }
  if (!/^rec[A-Za-z0-9]{14}$/.test(recordId)) return null
  const expected = hmac(recordId)
  // Timing-safe compare.
  const a = Buffer.from(parts[1])
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!crypto.timingSafeEqual(a, b)) return null
  return recordId
}
