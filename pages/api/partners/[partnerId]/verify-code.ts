import { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import {
  MAX_CODE_ATTEMPTS,
  bumpPendingAttempts,
  clearPendingCookie,
  hashCode,
  isPartnerId,
  readPendingCookie,
  setSessionCookie,
} from '../../../../utils/partnerAuth'
import { logPartnerLogin } from '../../../../utils/partnerLoginLog'

// Step 2 of the email-code login flow.
//
// POST { code } → read the pending cookie set by request-code, recompute
// the HMAC of (email + code), compare to the stored hash in constant
// time. On success: set the long-lived session cookie (carrying partnerId
// + email) and clear the pending cookie. On failure: increment attempts.
// After MAX_CODE_ATTEMPTS the pending cookie is invalidated and the user
// has to request a fresh code.

const constEq = (a: string, b: string): boolean => {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  // Validate the URL slug. The pending cookie carries its own partnerId
  // (set by request-code) — require both match so a user who started a
  // login flow for partner A can't accidentally complete it on partner B's
  // page.
  const partnerSlug = req.query.partnerId
  if (!isPartnerId(partnerSlug)) {
    return res.status(404).json({ message: 'Unknown partner' })
  }
  const body = (req.body as { code?: string }) || {}
  const codeRaw = typeof body.code === 'string' ? body.code.trim() : ''
  if (!/^\d{6}$/.test(codeRaw)) {
    return res.status(400).json({ message: 'Enter the 6-digit code.' })
  }

  const pending = readPendingCookie(req)
  if (!pending) {
    return res
      .status(400)
      .json({ message: 'Your code expired. Request a new one.' })
  }
  if (pending.partnerId !== partnerSlug) {
    clearPendingCookie(res)
    return res
      .status(400)
      .json({ message: 'Login flow got out of sync. Request a new code.' })
  }
  if (pending.attempts >= MAX_CODE_ATTEMPTS) {
    clearPendingCookie(res)
    return res
      .status(429)
      .json({ message: 'Too many wrong attempts. Request a new code.' })
  }

  const submittedHash = hashCode(pending.email, codeRaw)
  if (!constEq(submittedHash, pending.codeHash)) {
    bumpPendingAttempts(res, pending)
    const remaining = Math.max(0, MAX_CODE_ATTEMPTS - pending.attempts - 1)
    return res.status(401).json({
      message:
        remaining > 0
          ? `Wrong code — ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
          : 'Wrong code. Request a new one.',
    })
  }

  // Success.
  setSessionCookie(res, pending.partnerId, pending.email)
  // Also clear the pending cookie by piggy-backing onto the Set-Cookie
  // header. (Node lets us pass an array, but we already set the session
  // one — so issue both via combined header.)
  const existing = res.getHeader('Set-Cookie')
  const expire = `bb_partner_pending=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, expire])
  } else if (typeof existing === 'string') {
    res.setHeader('Set-Cookie', [existing, expire])
  } else {
    res.setHeader('Set-Cookie', expire)
  }

  // Append to the "Partner logins" audit table. AWAIT so the serverless
  // function doesn't terminate mid-write (same fix we applied to the
  // notification mailer). Failures inside the logger are swallowed, so
  // worst case the user logs in fine but the row never appears.
  await logPartnerLogin({
    partnerId: pending.partnerId,
    email: pending.email,
    req,
  })

  return res.status(200).json({ ok: true, email: pending.email })
}
