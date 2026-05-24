// SMTP helper for the partner-portal login-code flow.
//
// Sends through bagbee@bagbee.is using the Gmail SMTP app password.
// Memory: GMAIL_APP_PASSWORD is the canonical env var; GOOgle_PASSWORD
// is the legacy alias. We accept either so this works on local + Vercel
// without renaming env vars first.

import nodemailer, { Transporter } from 'nodemailer'

const FROM_NAME = 'BagBee'
const FROM_EMAIL = 'bagbee@bagbee.is'

let cachedTransport: Transporter | null = null

const getAppPassword = (): string => {
  const pw =
    process.env.GMAIL_APP_PASSWORD ||
    process.env.GOOgle_PASSWORD ||
    process.env.GOOGLE_PASSWORD ||
    ''
  if (!pw) {
    throw new Error(
      'GMAIL_APP_PASSWORD missing — partner login email cannot be sent. ' +
        'Add the Gmail app password for bagbee@bagbee.is to Vercel env.'
    )
  }
  return pw
}

// One transport per cold-start; nodemailer reuses the TLS connection.
const getTransport = (): Transporter => {
  if (cachedTransport) return cachedTransport
  cachedTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: FROM_EMAIL, pass: getAppPassword() },
  })
  return cachedTransport
}

export type SendLoginCodeArgs = {
  to: string
  code: string
  partnerDisplayName: string
}

// Email-safe PNG logo. Originally I shipped an SVG, but:
//   - bagbee.is → www.bagbee.is 308-redirects; most email clients won't
//     follow the redirect inside <img src>, so the image breaks.
//   - Even at the right URL, Gmail web + Outlook strip SVG images
//     in most configurations.
// PNG fixes both — and we point straight at the www host to skip the
// redirect entirely.
const LOGO_URL = 'https://www.bagbee.is/images/bagbee-logo-green.png'

const renderHtml = ({ code, partnerDisplayName }: SendLoginCodeArgs): string => `
<!doctype html>
<html><body style="font-family: Arial, Helvetica, sans-serif; color: #000929; max-width: 480px; margin: 0 auto; padding: 24px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <img src="${LOGO_URL}" alt="BagBee" height="28" style="height:28px;width:auto;display:inline-block;" />
    <div style="font-size: 11px; color: #696f79; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px;">${partnerDisplayName} · Partner portal</div>
  </div>
  <p style="font-size: 14px; line-height: 1.5;">Hi,</p>
  <p style="font-size: 14px; line-height: 1.5;">
    Here is your sign-in code for the ${partnerDisplayName} partner portal:
  </p>
  <div style="text-align: center; margin: 28px 0;">
    <div style="display: inline-block; font-size: 30px; font-weight: 700; letter-spacing: 8px; padding: 16px 28px; background: #f5f6fa; border: 1px solid #ecedf0; border-radius: 10px; color: #000929;">
      ${code}
    </div>
  </div>
  <p style="font-size: 13px; color: #696f79; line-height: 1.5;">
    The code is valid for 10 minutes. If you didn't ask to sign in, you can ignore this email.
  </p>
  <p style="font-size: 12px; color: #a3a4a7; margin-top: 32px;">
    — BagBee · bagbee@bagbee.is
  </p>
</body></html>
`

const renderText = ({ code, partnerDisplayName }: SendLoginCodeArgs): string =>
  [
    `Your BagBee partner-portal sign-in code:`,
    ``,
    `   ${code}`,
    ``,
    `Valid for 10 minutes. Portal: ${partnerDisplayName}.`,
    `If you didn't ask to sign in, you can ignore this email.`,
    ``,
    `— BagBee · bagbee@bagbee.is`,
  ].join('\n')

export async function sendLoginCode(args: SendLoginCodeArgs): Promise<void> {
  const transport = getTransport()
  await transport.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: args.to,
    subject: `Your BagBee partner-portal code: ${args.code}`,
    text: renderText(args),
    html: renderHtml(args),
  })
}
