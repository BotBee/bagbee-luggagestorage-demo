/**
 * TTLock Open Platform API client.
 *
 * Wraps the endpoints we use to manage the KEF airport bike-box lockers:
 *   - OAuth2 password-grant auth
 *   - List gateways / locks / passcodes
 *   - Create / delete time-bound passcodes
 *   - Query lock battery
 *
 * EU region (`https://euapi.ttlock.com`) by default — our locks live there.
 *
 * TTLock auth model (TLDR): clientId/clientSecret identify the BagBee app;
 * username/password identify the lock-owner user account (info@luggagelockers.is).
 * Both are required. See ../../memory/kef_lockers_project.md for the full
 * account split.
 *
 * Every API call after auth must include:
 *   - clientId       (app credential)
 *   - accessToken    (per-user token from /oauth2/token)
 *   - date           (current epoch ms — anti-replay)
 *
 * On any non-zero `errcode` in a response, we throw a TTLockError so callers
 * can surface the error message into Airtable's `RemoteLock last error` field.
 */
import crypto from 'node:crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TTLockAuthToken {
  access_token: string
  refresh_token: string
  uid: number
  openid: number
  scope: string
  token_type: string
  expires_in: number // seconds
}

export interface TTLockGateway {
  gatewayId: number
  gatewayName: string
  gatewayMac: string
  gatewayVersion: number
  networkName: string
  isOnline: 0 | 1
  lockNum: number
}

export interface TTLockLock {
  lockId: number
  lockAlias: string
  lockMac: string
  electricQuantity: number
  hasGateway: 0 | 1
  lockVersion?: {
    protocolType?: number
    protocolVersion?: number
  }
}

/**
 * keyboardPwdType:
 *   1 = single-use, 2 = permanent, 3 = period (time-bound — what we use),
 *   4 = weekly recurring, 5 = daily, 6 = monthly, 7 = yearly,
 *   8 = monday, 9 = tuesday, ...
 */
export interface TTLockPasscode {
  keyboardPwdId: number
  keyboardPwd: string
  keyboardPwdName: string
  keyboardPwdType: number
  startDate: number | null // epoch ms
  endDate: number | null
  status: number // 1 = active, etc.
  sendDate: number | null
}

export interface CreatePasscodeOptions {
  lockId: number
  /** PIN itself. Must be 4–9 digits. If omitted TTLock generates one — we recommend always passing one for predictability. */
  keyboardPwd: string
  /** Name shown in the TTLock app — e.g. "rúnar inn", "schulte út". Max 20 chars. */
  keyboardPwdName: string
  /** Period start, epoch ms. */
  startDate: number
  /** Period end, epoch ms. */
  endDate: number
  /**
   * 1 = via Bluetooth + WiFi (requires gateway online),
   * 2 = via WiFi gateway only.
   * For our purposes always 2 (we operate remotely, no Bluetooth from server).
   */
  addType?: 1 | 2
}

export class TTLockError extends Error {
  readonly errcode: number
  readonly endpoint: string
  readonly raw: any
  constructor(endpoint: string, errcode: number, errmsg: string, raw: any) {
    super(`TTLock ${endpoint} → errcode=${errcode} ${errmsg}`)
    this.name = 'TTLockError'
    this.errcode = errcode
    this.endpoint = endpoint
    this.raw = raw
  }
}

// ---------------------------------------------------------------------------
// Config + signing
// ---------------------------------------------------------------------------

const API_BASE = process.env.TTLOCK_API_BASE || 'https://euapi.ttlock.com'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

const md5 = (s: string): string => crypto.createHash('md5').update(s).digest('hex')

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------

/**
 * In-memory token cache for the lifetime of a single serverless invocation.
 * Vercel functions are stateless across invocations, so worst case we
 * re-authenticate on every cron tick — which is fine (cheap, low frequency).
 * For higher throughput we'd persist the refresh token to Airtable and use it.
 */
let cachedToken: TTLockAuthToken | null = null
let cachedAt = 0

export async function getAccessToken(): Promise<string> {
  // Refresh ~1 hour before expiry so we don't race the boundary mid-call.
  const refreshBefore = 3600 * 1000
  if (
    cachedToken &&
    Date.now() < cachedAt + (cachedToken.expires_in * 1000) - refreshBefore
  ) {
    return cachedToken.access_token
  }
  const token = await authenticate()
  cachedToken = token
  cachedAt = Date.now()
  return token.access_token
}

/** Force a fresh authentication. Primarily used by scripts/tests. */
export async function authenticate(): Promise<TTLockAuthToken> {
  const clientId = requireEnv('TTLOCK_CLIENT_ID')
  const clientSecret = requireEnv('TTLOCK_CLIENT_SECRET')
  const username = requireEnv('TTLOCK_USERNAME')
  const password = requireEnv('TTLOCK_PASSWORD')

  const body = new URLSearchParams({
    clientId,
    clientSecret,
    username,
    password: md5(password), // TTLock-specific quirk
  })

  const res = await fetch(`${API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json: any = await res.json()
  if (json.errcode !== undefined && json.errcode !== 0) {
    throw new TTLockError('/oauth2/token', json.errcode, json.errmsg, json)
  }
  if (!json.access_token) {
    throw new TTLockError('/oauth2/token', -1, 'no access_token in response', json)
  }
  return json as TTLockAuthToken
}

// ---------------------------------------------------------------------------
// Low-level request helpers
// ---------------------------------------------------------------------------

async function ttlockGet<T = any>(path: string, params: Record<string, string | number>): Promise<T> {
  const accessToken = await getAccessToken()
  const qs = new URLSearchParams({
    clientId: requireEnv('TTLOCK_CLIENT_ID'),
    accessToken,
    date: String(Date.now()),
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  })
  const url = `${API_BASE}${path}?${qs}`
  const res = await fetch(url)
  const json: any = await res.json()
  if (json.errcode !== undefined && json.errcode !== 0) {
    throw new TTLockError(path, json.errcode, json.errmsg, json)
  }
  return json as T
}

async function ttlockPost<T = any>(path: string, params: Record<string, string | number>): Promise<T> {
  const accessToken = await getAccessToken()
  const body = new URLSearchParams({
    clientId: requireEnv('TTLOCK_CLIENT_ID'),
    accessToken,
    date: String(Date.now()),
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  })
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json: any = await res.json()
  if (json.errcode !== undefined && json.errcode !== 0) {
    throw new TTLockError(path, json.errcode, json.errmsg, json)
  }
  return json as T
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listGateways(): Promise<TTLockGateway[]> {
  const res = await ttlockGet<{ list?: TTLockGateway[] }>('/v3/gateway/list', {
    pageNo: 1,
    pageSize: 100,
  })
  return res.list ?? []
}

export async function listLocks(): Promise<TTLockLock[]> {
  const res = await ttlockGet<{ list?: TTLockLock[] }>('/v3/lock/list', {
    pageNo: 1,
    pageSize: 100,
  })
  return res.list ?? []
}

export async function listPasscodes(lockId: number): Promise<TTLockPasscode[]> {
  const res = await ttlockGet<{ list?: TTLockPasscode[] }>('/v3/lock/listKeyboardPwd', {
    lockId,
    pageNo: 1,
    pageSize: 1000,
  })
  return res.list ?? []
}

export async function getLockBattery(lockId: number): Promise<number> {
  const res = await ttlockGet<{ electricQuantity?: number }>('/v3/lock/queryElectricQuantity', {
    lockId,
  })
  return res.electricQuantity ?? -1
}

/**
 * Create a time-bound passcode on a lock. Returns the keyboardPwdId we use
 * later to revoke it.
 *
 * IMPORTANT: dates are epoch milliseconds in **device-local time**. TTLock's
 * docs phrase this as "the local time of the lock"; in practice send the
 * timestamps as Atlantic/Reykjavik wall-clock and TTLock applies them
 * verbatim. Don't UTC-shift unless you've confirmed the device timezone
 * setting against the booking timezone.
 */
export async function createTimeBoundPasscode(opts: CreatePasscodeOptions): Promise<{ keyboardPwdId: number }> {
  if (!/^\d{4,9}$/.test(opts.keyboardPwd)) {
    throw new Error(`keyboardPwd must be 4-9 digits, got "${opts.keyboardPwd}"`)
  }
  if (opts.endDate <= opts.startDate) {
    throw new Error('endDate must be after startDate')
  }
  if (opts.keyboardPwdName.length > 20) {
    throw new Error(`keyboardPwdName too long (max 20): "${opts.keyboardPwdName}"`)
  }
  const res = await ttlockPost<{ keyboardPwdId: number }>('/v3/keyboardPwd/add', {
    lockId: opts.lockId,
    keyboardPwd: opts.keyboardPwd,
    keyboardPwdName: opts.keyboardPwdName,
    keyboardPwdType: 3, // period
    startDate: opts.startDate,
    endDate: opts.endDate,
    addType: opts.addType ?? 2, // 2 = via gateway only
  })
  return { keyboardPwdId: res.keyboardPwdId }
}

/**
 * Delete a passcode by id. Requires the lock to be reachable via gateway
 * (deleteType=2). Safe to call on an already-expired code — TTLock returns
 * success even if the code was never used.
 */
export async function deletePasscode(lockId: number, keyboardPwdId: number): Promise<void> {
  await ttlockPost('/v3/keyboardPwd/delete', {
    lockId,
    keyboardPwdId,
    deleteType: 2, // via gateway
  })
}

/**
 * Generate a random 5-digit PIN suitable for keyboardPwd. We avoid leading
 * zero (some keypads behave oddly with it) and avoid 4-digit codes to keep
 * brute-force harder. Uniqueness within the lock is the caller's concern —
 * but with ~10⁵ codes and at most ~30 concurrent active, collisions are
 * negligible in practice.
 */
export function randomPin(): string {
  // First digit 1-9, rest 0-9.
  const first = 1 + Math.floor(Math.random() * 9)
  const rest = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `${first}${rest}`
}
