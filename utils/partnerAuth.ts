import crypto from 'crypto'
import { NextApiRequest, NextApiResponse } from 'next'
import { GetServerSidePropsContext } from 'next'

// B2B partner portal auth.
//
// History: started life as a single shared password per partner (env var) →
// signed cookie. Now upgraded to a real per-user flow:
//   - User types their email on the login page.
//   - If the email is in the allowed-domain set for that partner, server
//     mails a 6-digit code (see utils/partnerMailer.ts).
//   - User types the code; if it matches the HMAC-signed pending cookie,
//     a long-lived session cookie is set carrying { partnerId, email }.
//
// The session cookie format is bumped to v2 to carry the email field. Old
// v1 cookies become invalid → currently-logged-in users re-login once.
// That's fine for a tiny B2B portal where the only existing session is
// mine + Runar's. After verification the session lasts 90 days.

const SESSION_COOKIE_NAME = 'bb_partner'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90 // 90 days
const SESSION_COOKIE_VERSION = 'v2'

const PENDING_COOKIE_NAME = 'bb_partner_pending'
// 10 minutes to type the code. After that the code is dead and the user
// has to request a new one.
const PENDING_MAX_AGE_SECONDS = 60 * 10
const PENDING_COOKIE_VERSION = 'p1'
// Brute-force ceiling — after 5 wrong attempts the pending cookie is
// invalidated and the user must request a fresh code.
export const MAX_CODE_ATTEMPTS = 5

// Partner registry. Adding a new partner is a single config block here —
// the pages + API routes are parameterized on `partnerId` so no per-partner
// code lives anywhere else (see /pages/partners/[partnerId]/* and
// /pages/api/partners/[partnerId]/*). The URL slug, Airtable agency name,
// and login domains are all stored on the entry.
export type PartnerId = 'iceland-travel' | 'atlantik'

export const PARTNERS: Record<
  PartnerId,
  {
    displayName: string
    // Exact value in Airtable column "Nafn viðskiptavinar"
    // (fldAqtOvVsGju0Vhy) used to scope reads + writes. Must match
    // letter-for-letter how ops stamps the customer name.
    agencyName: string
    // Whitelisted email domains. A login email must end with `@<one of these>`
    // (case-insensitive) for the request-code endpoint to even mail a code.
    allowedDomains: string[]
  }
> = {
  'iceland-travel': {
    displayName: 'Iceland Travel',
    agencyName: 'Iceland Travel',
    allowedDomains: ['icelandtravel.is', 'bagbee.is'],
  },
  atlantik: {
    displayName: 'Atlantik',
    agencyName: 'Atlantik',
    allowedDomains: ['atlantik.is', 'bagbee.is'],
  },
}

// Type guard for validating a URL slug from the dynamic-route param. Every
// page + API route under /partners/[partnerId]/* calls this to reject
// unknown partners (e.g. someone trying /partners/random-string/dashboard).
export const isPartnerId = (slug: unknown): slug is PartnerId =>
  typeof slug === 'string' && slug in PARTNERS

const getSecret = (): string => {
  const secret = process.env.PARTNER_COOKIE_SECRET
  if (!secret || secret.length < 16) {
    throw new Error(
      'PARTNER_COOKIE_SECRET missing or too short (need 16+ chars). Add to .env.local.'
    )
  }
  return secret
}

// Legacy shared-password fallback. Kept so I can use the old curl-based
// bootstrap if the email pipeline ever breaks; defaults off if the env
// var isn't set.
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

const b64uEncode = (s: string): string =>
  Buffer.from(s, 'utf8').toString('base64url')

const b64uDecode = (s: string): string =>
  Buffer.from(s, 'base64url').toString('utf8')

export const normalizeEmail = (raw: string): string => raw.trim().toLowerCase()

export const isAllowedEmail = (partnerId: PartnerId, email: string): boolean => {
  const normalized = normalizeEmail(email)
  if (!normalized.includes('@')) return false
  const domain = normalized.split('@')[1]
  if (!domain) return false
  return PARTNERS[partnerId].allowedDomains.some(
    (d) => d.toLowerCase() === domain
  )
}

// --- Session cookie (v2) ---------------------------------------------------
// Format: v2.<partnerId>.<emailB64u>.<expEpochSec>.<sig>

export type PartnerSession = {
  partnerId: PartnerId
  email: string
}

const buildSessionCookie = (partnerId: PartnerId, email: string): string => {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  const emailB64 = b64uEncode(email)
  const payload = `${SESSION_COOKIE_VERSION}.${partnerId}.${emailB64}.${exp}`
  const sig = sign(payload)
  return `${payload}.${sig}`
}

const parseSessionCookie = (value: string | undefined): PartnerSession | null => {
  if (!value) return null
  const parts = value.split('.')
  if (parts.length !== 5) return null
  const [version, partnerId, emailB64, expStr, sig] = parts
  if (version !== SESSION_COOKIE_VERSION) return null
  if (!(partnerId in PARTNERS)) return null
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null
  const payload = `${version}.${partnerId}.${emailB64}.${expStr}`
  const expected = sign(payload)
  if (!timingSafeEqual(sig, expected)) return null
  let email: string
  try {
    email = b64uDecode(emailB64)
  } catch {
    return null
  }
  return { partnerId: partnerId as PartnerId, email }
}

const readCookieFromHeader = (
  cookieHeader: string | undefined,
  name: string
): string | undefined => {
  if (!cookieHeader) return undefined
  const m = new RegExp(`(?:^|; )${name}=([^;]+)`).exec(cookieHeader)
  return m ? decodeURIComponent(m[1]) : undefined
}

export const setSessionCookie = (
  res: NextApiResponse,
  partnerId: PartnerId,
  email: string
): void => {
  const value = buildSessionCookie(partnerId, email)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`
  )
}

// Backwards-compat alias for the old name. Same behaviour as setSessionCookie
// but without an email — used only by the legacy password endpoint.
export const setPartnerCookie = (
  res: NextApiResponse,
  partnerId: PartnerId
): void => {
  // For the legacy path we still need an email slot in the cookie; tag it
  // as 'legacy@<partner>.local' so server code can tell these sessions
  // apart from real email-verified ones if it ever cares.
  setSessionCookie(res, partnerId, `legacy@${partnerId}.local`)
}

export const clearPartnerCookie = (res: NextApiResponse): void => {
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${PENDING_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ])
}

// Temporary preview escape hatch: when PARTNER_PORTAL_OPEN=true, all pages
// + APIs respond as if the request were authenticated as iceland-travel.
// MUST be false in production.
const isOpenPreviewMode = (): boolean => process.env.PARTNER_PORTAL_OPEN === 'true'

export const verifySession = (
  req: NextApiRequest | GetServerSidePropsContext['req']
): PartnerSession | null => {
  if (isOpenPreviewMode()) {
    return { partnerId: 'iceland-travel', email: 'preview@bagbee.is' }
  }
  const raw = readCookieFromHeader(req.headers.cookie, SESSION_COOKIE_NAME)
  return parseSessionCookie(raw)
}

// Compat shim — original code only needed the partner ID, so most call
// sites still use this. Internally goes through verifySession.
export const verifyPartner = (
  req: NextApiRequest | GetServerSidePropsContext['req']
): PartnerId | null => {
  const session = verifySession(req)
  return session ? session.partnerId : null
}

// API-route guard. Returns the partner ID on success; calls res.status(401)
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

// Constant-time password compare for the legacy shared-password endpoint.
export const checkPartnerPassword = (
  partnerId: PartnerId,
  attempt: string
): boolean => {
  const expected = getPartnerPassword(partnerId)
  if (attempt.length !== expected.length) {
    crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(expected.slice(0, attempt.length).padEnd(expected.length, '0'))
    )
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(attempt))
}

// --- Pending cookie (login-code state) -------------------------------------
//
// Stores the in-progress email-code login between request-code and
// verify-code. Carries:
//   - partnerId         which partner we're authenticating against
//   - email             the address we mailed the code to
//   - codeHashB64       HMAC(email + ':' + code, secret); never stores
//                       the code itself, so even leaking the cookie does
//                       not let an attacker log in without intercepting
//                       the email.
//   - attempts          incremented on every wrong code submission; once
//                       it hits MAX_CODE_ATTEMPTS the cookie is rejected.
//   - exp               10 minutes from issue.
//
// Format: p1.<partnerId>.<emailB64u>.<codeHashB64u>.<attempts>.<exp>.<sig>

export type PendingState = {
  partnerId: PartnerId
  email: string
  codeHash: string
  attempts: number
  exp: number
}

export const hashCode = (email: string, code: string): string => {
  // Bind the hash to the email so a leaked codeHash cannot be replayed
  // against a different account.
  const h = crypto.createHmac('sha256', getSecret())
  h.update(`${email}:${code}`)
  return h.digest('base64url')
}

const buildPendingCookie = (state: PendingState): string => {
  const emailB64 = b64uEncode(state.email)
  const payload = `${PENDING_COOKIE_VERSION}.${state.partnerId}.${emailB64}.${state.codeHash}.${state.attempts}.${state.exp}`
  const sig = sign(payload)
  return `${payload}.${sig}`
}

const parsePendingCookie = (value: string | undefined): PendingState | null => {
  if (!value) return null
  const parts = value.split('.')
  if (parts.length !== 7) return null
  const [version, partnerId, emailB64, codeHash, attemptsStr, expStr, sig] = parts
  if (version !== PENDING_COOKIE_VERSION) return null
  if (!(partnerId in PARTNERS)) return null
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null
  const attempts = Number(attemptsStr)
  if (!Number.isFinite(attempts) || attempts < 0) return null
  const payload = `${version}.${partnerId}.${emailB64}.${codeHash}.${attemptsStr}.${expStr}`
  const expected = sign(payload)
  if (!timingSafeEqual(sig, expected)) return null
  let email: string
  try {
    email = b64uDecode(emailB64)
  } catch {
    return null
  }
  return {
    partnerId: partnerId as PartnerId,
    email,
    codeHash,
    attempts,
    exp,
  }
}

export const setPendingCookie = (
  res: NextApiResponse,
  partnerId: PartnerId,
  email: string,
  codeHash: string
): void => {
  const exp = Math.floor(Date.now() / 1000) + PENDING_MAX_AGE_SECONDS
  const state: PendingState = { partnerId, email, codeHash, attempts: 0, exp }
  const value = buildPendingCookie(state)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${PENDING_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${PENDING_MAX_AGE_SECONDS}${secure}`
  )
}

// Re-set the same cookie but with attempts+1, so we can throttle without
// holding state server-side.
export const bumpPendingAttempts = (
  res: NextApiResponse,
  state: PendingState
): void => {
  const next: PendingState = { ...state, attempts: state.attempts + 1 }
  const value = buildPendingCookie(next)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  // Preserve the remaining TTL so an attacker can't farm extra time by
  // re-triggering this; cap the Max-Age at "time until original exp".
  const remaining = Math.max(0, state.exp - Math.floor(Date.now() / 1000))
  res.setHeader(
    'Set-Cookie',
    `${PENDING_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${remaining}${secure}`
  )
}

export const clearPendingCookie = (res: NextApiResponse): void => {
  res.setHeader(
    'Set-Cookie',
    `${PENDING_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  )
}

export const readPendingCookie = (req: NextApiRequest): PendingState | null => {
  const raw = readCookieFromHeader(req.headers.cookie, PENDING_COOKIE_NAME)
  return parsePendingCookie(raw)
}

// Crypto-random 6-digit code (000000-999999). zero-padded.
export const generateLoginCode = (): string => {
  // randomInt is uniform; range is exclusive of max.
  const n = crypto.randomInt(0, 1_000_000)
  return String(n).padStart(6, '0')
}
