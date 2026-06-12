import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Shared HMAC signing for Rapyd complete_payment_url redirects.
 *
 * Same threat model as utils/orderSurchargeSig.ts (see its header comment
 * for the full story): the success redirect is just a URL, so anyone who
 * can construct it can call it WITHOUT paying. Every param a
 * payment-success handler writes to Airtable must therefore be covered by
 * a signature minted server-side when the checkout is created.
 *
 * This module is the generic implementation used by the tip, fast-track
 * and day-storage flows. The original order-surcharge flow keeps its own
 * module (orderSurchargeSig.ts) so in-flight checkout URLs keep verifying
 * across deploys; both share ORDER_SURCHARGE_SECRET.
 *
 * The flow name is part of the canonical string, so a signature minted
 * for one flow can never be replayed against another flow's handler.
 *
 * Replay window: 30 minutes — long enough for a slow checkout (3DS, bank
 * verification), short enough to limit a stolen-link replay.
 */

const SIGN_TTL_MS = 30 * 60 * 1000

// Per-flow signed-field lists. Field ORDER is part of the canonical
// string, so sign and verify must use the same const — never inline an
// array at a call site. If a payment-success handler starts writing a new
// param to Airtable, it MUST be added here, otherwise it isn't covered by
// the signature and an attacker can mutate it for free.
export const TIP_SIGNED_FIELDS = ['orderNo', 'amount', 'recordId'] as const
export const FAST_TRACK_SIGNED_FIELDS = ['orderNo', 'recordId'] as const
export const DAY_STORAGE_SIGNED_FIELDS = [
  'orderNo',
  'orderRecordId',
  'storageRecordId',
] as const

type SignedFlow = 'tip' | 'fast-track' | 'day-storage'

function getSecret(): string {
  const s = process.env.ORDER_SURCHARGE_SECRET
  if (!s) {
    throw new Error(
      '[paymentRedirectSig] ORDER_SURCHARGE_SECRET is not set; refusing to sign / verify'
    )
  }
  return s
}

function canonicalize(
  flow: SignedFlow,
  fields: readonly string[],
  params: Record<string, string | undefined>,
  exp: number
): string {
  const parts: string[] = [`flow=${flow}`, `exp=${exp}`]
  for (const k of fields) {
    parts.push(`${k}=${params[k] ?? ''}`)
  }
  return parts.join('|')
}

/**
 * Returns { exp, sig } to append to the complete_payment_url query string
 * alongside the params themselves.
 */
export function signRedirectParams(
  flow: SignedFlow,
  fields: readonly string[],
  params: Record<string, string | undefined>
): { exp: string; sig: string } {
  const secret = getSecret()
  const exp = Date.now() + SIGN_TTL_MS
  const canonical = canonicalize(flow, fields, params, exp)
  const sig = createHmac('sha256', secret).update(canonical).digest('hex')
  return { exp: String(exp), sig }
}

export type RedirectVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'expired' | 'bad_sig' | 'misconfigured' }

/**
 * Verify a Rapyd-redirected request. Returns ok:true only if the signature
 * matches the params and the expiry hasn't passed; otherwise a specific
 * failure reason for logging (the user-facing redirect should stay generic
 * so attackers can't tell which check failed).
 */
export function verifyRedirectParams(
  flow: SignedFlow,
  fields: readonly string[],
  params: Record<string, string | undefined>,
  exp: string | undefined,
  sig: string | undefined
): RedirectVerifyResult {
  let secret: string
  try {
    secret = getSecret()
  } catch {
    return { ok: false, reason: 'misconfigured' }
  }

  if (!exp || !sig) return { ok: false, reason: 'missing' }

  const expNum = Number(exp)
  if (!Number.isFinite(expNum)) return { ok: false, reason: 'missing' }
  if (Date.now() > expNum) return { ok: false, reason: 'expired' }

  const canonical = canonicalize(flow, fields, params, expNum)
  const expected = createHmac('sha256', secret).update(canonical).digest('hex')

  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_sig' }
  }
  return { ok: true }
}
