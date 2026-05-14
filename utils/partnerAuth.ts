import crypto from 'crypto'
import { NextApiRequest, NextApiResponse } from 'next'
import { GetServerSidePropsContext } from 'next'

// B2B partner portal auth. Shared password per partner (env var) → signed
// cookie. Kept deliberately minimal: no JWT, no sessions table — Iceland
// Travel staff share one credential, the cookie HMAC binds the partner ID
// + expiry. Server validates on every request via requirePartner / verifyCookie.

const COOKIE_NAME = 'bb_partner'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days
const COOKIE_VERSION = 'v1'

export type PartnerId = 'iceland-travel'

export const PARTNERS: Record<PartnerId, { displayName: string; agencyName: string }> = {
  'iceland-travel': {
    displayName: 'Iceland Travel',
    // Exact value in Airtable field fldAqtOvVsGju0Vhy used for scoping reads/writes.
    agencyName: 'Iceland Travel',
  },
}

const getSecret = (): string => {
  const secret = process.env.PARTNER_COOKIE_SECRET
  if (!secret || secret.length < 16) {
    throw new Error(
      'PARTNER_COOKIE_SECRET missing or too short (need 16+ chars). Add to .env.local.'
    )
  }
  return secret
}

export const getPartnerPassword = (partnerId: PartnerId): string => {
  const envKey = `PARTNER_${partnerId.replace(/-/g, '_').toUpperCase()}_PASSWORD`
  const pw = process.env[envKey]
  if (!pw || pw.length < 4) {
    throw new Error(`${envKey} not set — partner login disabled.`)
  }
  return pw
}

const sign = (payload: string): string => {
  const h = crypto.createHmac('sha256', getSecret())
  h.update(payload)
  return h.digest('base64url')
}

const timingSafeEqual = (a: string, b: string): boolean => {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

// Cookie format: v1.<partnerId>.<expEpoch>.<sig>
const buildCookie = (partnerId: PartnerId): string => {
  const exp = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS
  const payload = `${COOKIE_VERSION}.${partnerId}.${exp}`
  const sig = sign(payload)
  return `${payload}.${sig}`
}

const parseCookie = (value: string | undefined): PartnerId | null => {
  if (!value) return null
  const parts = value.split('.')
  if (parts.length !== 4) return null
  const [version, partnerId, expStr, sig] = parts
  if (version !== COOKIE_VERSION) return null
  if (!(partnerId in PARTNERS)) return null
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null
  const payload = `${version}.${partnerId}.${expStr}`
  const expected = sign(payload)
  if (!timingSafeEqual(sig, expected)) return null
  return partnerId as PartnerId
}

const readCookieFromHeader = (cookieHeader: string | undefined): string | undefined => {
  if (!cookieHeader) return undefined
  const m = new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`).exec(cookieHeader)
  return m ? decodeURIComponent(m[1]) : undefined
}

export const setPartnerCookie = (res: NextApiResponse, partnerId: PartnerId): void => {
  const value = buildCookie(partnerId)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECONDS}${secure}`
  )
}

export const clearPartnerCookie = (res: NextApiResponse): void => {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  )
}

// Temporary preview escape hatch: when PARTNER_PORTAL_OPEN=true, all pages
// + APIs respond as if the request were authenticated as iceland-travel.
// This is for previewing the UI while we're not yet ready to wire up real
// per-user auth (email-code flow comes later). MUST be false in production.
const isOpenPreviewMode = (): boolean => process.env.PARTNER_PORTAL_OPEN === 'true'

export const verifyPartner = (
  req: NextApiRequest | GetServerSidePropsContext['req']
): PartnerId | null => {
  if (isOpenPreviewMode()) return 'iceland-travel'
  const raw = readCookieFromHeader(req.headers.cookie)
  return parseCookie(raw)
}

// API-route guard. Returns the partner ID on success; calls res.status(401).
// and returns null on failure — the caller should return immediately.
export const requirePartner = (
  req: NextApiRequest,
  res: NextApiResponse,
  expected: PartnerId
): PartnerId | null => {
  if (isOpenPreviewMode()) return expected
  const got = verifyPartner(req)
  if (got !== expected) {
    res.status(401).json({ message: 'Unauthorized' })
    return null
  }
  return got
}

// Constant-time password compare to defeat timing oracles.
export const checkPartnerPassword = (partnerId: PartnerId, attempt: string): boolean => {
  const expected = getPartnerPassword(partnerId)
  if (attempt.length !== expected.length) {
    // Still run the compare to keep the timing flat; result is discarded.
    crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(expected.slice(0, attempt.length).padEnd(expected.length, '0'))
    )
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(attempt))
}
