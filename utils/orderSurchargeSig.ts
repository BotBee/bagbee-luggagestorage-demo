import { createHmac, timingSafeEqual } from 'crypto'

/**
 * HMAC signature for the surcharge-callback URL.
 *
 * The flow that this protects:
 *   1. Customer on /orders/ABCDE clicks "add bags" → POST /api/order/update
 *   2. update.ts builds a Rapyd checkout whose complete_payment_url is
 *      /api/order/payment-success?orderNo=ABCDE&bags=...&amount=...
 *   3. Customer pays on Rapyd → browser is redirected back to that URL
 *   4. payment-success.ts writes the new bag count / address / amount into
 *      Airtable
 *
 * Without a signature, anyone could just call step (4) directly with their
 * own values. The signature is generated in update.ts (server-side, with a
 * secret an attacker doesn't have) and verified in payment-success.ts.
 *
 * We sign a canonical concatenation of all params that payment-success
 * applies, plus an expiry timestamp. Order of fields in the signed string
 * is fixed (not derived from URLSearchParams iteration order) to keep the
 * sign and verify sides in lockstep even if the URLSearchParams encoding
 * changes.
 *
 * Replay window: 30 minutes. Long enough for a slow checkout (3DS, bank
 * verification), short enough to limit a stolen-link replay.
 */

const SIGN_TTL_MS = 30 * 60 * 1000

// The fields that payment-success.ts writes back to Airtable. Keep in
// sync with successParams in /api/order/update.ts. If a new field is
// added there, it must be added here too — otherwise it isn't covered
// by the signature and an attacker could mutate it for free.
const SIGNED_FIELDS = [
  'orderNo',
  'bags',
  'oddSize',
  'amount',
  'timeWindow',
  'address',
  'pickupDate',
  'deliveryAddress',
  'deliveryDate',
  'deliveryTimeWindow',
] as const

type SignedParams = Partial<Record<(typeof SIGNED_FIELDS)[number], string>>

function canonicalize(params: SignedParams, exp: number): string {
  const parts: string[] = [`exp=${exp}`]
  for (const k of SIGNED_FIELDS) {
    parts.push(`${k}=${params[k] ?? ''}`)
  }
  return parts.join('|')
}

function getSecret(): string {
  const s = process.env.ORDER_SURCHARGE_SECRET
  if (!s) {
    throw new Error(
      '[orderSurchargeSig] ORDER_SURCHARGE_SECRET is not set; refusing to sign / verify'
    )
  }
  return s
}

/**
 * Returns { exp, sig } for use as additional query-string params on the
 * Rapyd complete_payment_url. Caller appends them alongside the other
 * params already in successParams.
 */
export function signSurchargeParams(params: SignedParams): {
  exp: string
  sig: string
} {
  const secret = getSecret()
  const exp = Date.now() + SIGN_TTL_MS
  const canonical = canonicalize(params, exp)
  const sig = createHmac('sha256', secret).update(canonical).digest('hex')
  return { exp: String(exp), sig }
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'expired' | 'bad_sig' | 'misconfigured' }

/**
 * Verify a Rapyd-redirected request. Returns ok:true if the signature
 * matches the params and the expiry hasn't passed; otherwise a specific
 * failure reason for logging.
 */
export function verifySurchargeParams(
  params: SignedParams,
  exp: string | undefined,
  sig: string | undefined
): VerifyResult {
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

  const canonical = canonicalize(params, expNum)
  const expected = createHmac('sha256', secret).update(canonical).digest('hex')

  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_sig' }
  }
  return { ok: true }
}
