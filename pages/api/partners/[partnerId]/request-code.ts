import { NextApiRequest, NextApiResponse } from 'next'
import {
  PARTNERS,
  generateLoginCode,
  hashCode,
  isAllowedEmail,
  isPartnerId,
  normalizeEmail,
  setPendingCookie,
} from '../../../../utils/partnerAuth'
import { sendLoginCode } from '../../../../utils/partnerMailer'

// Step 1 of the email-code login flow.
//
// POST { email } → if the email matches an allowed domain for this partner,
// generate a 6-digit code, mail it to the user, and set the pending HMAC
// cookie that the verify-code endpoint will check against.
//
// Returns 200 on success regardless of whether the email is allowed — we
// intentionally don't leak which addresses are in the allowlist beyond the
// information the user already has (typing their own work address). On a
// real domain rejection we still send 200; only structural validation
// errors (missing field, malformed) and server errors return non-200.
//
// Actually — I went back and forth on this. For a B2B portal where users
// are typing their own work email and need quick feedback if they typo,
// "200 always" is annoying. So: we DO return 400 if the domain doesn't
// match, with a friendly message. The allowed domain list is not secret.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  // Validate the [partnerId] URL slug — reject unknown partners with 404 so
  // they can't be used to enumerate the registry or hit the SMTP path.
  const partnerSlug = req.query.partnerId
  if (!isPartnerId(partnerSlug)) {
    return res.status(404).json({ message: 'Unknown partner' })
  }
  const partnerId = partnerSlug

  const body = (req.body as { email?: string }) || {}
  const emailRaw = typeof body.email === 'string' ? body.email : ''
  const email = normalizeEmail(emailRaw)
  if (!email || !email.includes('@')) {
    return res.status(400).json({ message: 'Email is required.' })
  }
  if (!isAllowedEmail(partnerId, email)) {
    const allowed = PARTNERS[partnerId].allowedDomains
      .map((d) => `@${d}`)
      .join(' or ')
    return res
      .status(403)
      .json({ message: `Sorry — only ${allowed} addresses can sign in here.` })
  }

  const code = generateLoginCode()
  const codeHash = hashCode(email, code)
  setPendingCookie(res, partnerId, email, codeHash)

  try {
    await sendLoginCode({
      to: email,
      code,
      partnerDisplayName: PARTNERS[partnerId].displayName,
    })
  } catch (err) {
    console.error('[partner request-code] failed to send mail', err)
    return res.status(500).json({
      message:
        'Could not send the code right now. Please try again, or contact runar@bagbee.is.',
    })
  }

  return res.status(200).json({ ok: true, email })
}
