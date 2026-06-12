/**
 * Emails for the KEF handoff monitor — sent via the same Gmail SMTP as the
 * other BagBee mailers. Three messages:
 *   1. outgoing customer  → "please empty your locker, it's booked again soon"
 *   2. ops (bagbee@)      → internal alert with the details + urgency
 *   3. incoming customer  → "heads up, your locker may not be ready right away"
 */
import nodemailer, { Transporter } from 'nodemailer'

const FROM = 'BagBee <bagbee@bagbee.is>'
const OPS_EMAIL = 'bagbee@bagbee.is'

let cached: Transporter | null = null
const transport = (): Transporter => {
  if (cached) return cached
  const pass =
    process.env.GMAIL_APP_PASSWORD || process.env.GOOgle_PASSWORD || process.env.GOOGLE_PASSWORD || ''
  if (!pass) throw new Error('GMAIL_APP_PASSWORD missing — handoff emails cannot be sent')
  cached = nodemailer.createTransport({ service: 'gmail', auth: { user: 'bagbee@bagbee.is', pass } })
  return cached
}

/** Reykjavik (== UTC) "HH:MM on Wed 12 Jun". */
export const fmtTime = (ms: number): string => {
  const d = new Date(ms)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm} on ${days[d.getUTCDay()]} ${d.getUTCDate()} ${mons[d.getUTCMonth()]}`
}

const wrap = (title: string, inner: string) =>
  `<div style="background:#E5E6EB;padding:32px 16px;font-family:Poppins,Arial,sans-serif;"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;padding:28px 26px;"><div style="text-align:center;padding-bottom:16px;"><img src="https://www.bagbee.is/images/bagbee-logo-green.png" alt="BagBee" height="30" /></div><h1 style="font-size:20px;color:#000929;margin:0 0 12px;">${title}</h1>${inner}<p style="font-size:12px;color:#a3a4a7;margin-top:22px;">Questions? Reply to this email or write to <a href="mailto:bagbee@bagbee.is" style="color:#696f79;">bagbee@bagbee.is</a>. — BagBee</p></div></div>`

export async function sendOutgoingEmptyEmail(args: {
  to: string
  customerName: string
  lockerName: string
  bookingNumber: string
  incomingStartMs: number
}): Promise<void> {
  if (!args.to) return
  const inner = `<p style="font-size:14px;color:#424857;line-height:1.55;">Hi ${args.customerName || 'there'},</p>
  <p style="font-size:14px;color:#424857;line-height:1.55;">Our records show your bike box is still in <strong>${args.lockerName || 'your KEF locker'}</strong>. That locker is booked again at <strong>${fmtTime(args.incomingStartMs)}</strong>, so please collect your box with your pickup PIN as soon as you can.</p>
  <p style="font-size:14px;color:#424857;line-height:1.55;">If you've already collected it, thank you — you can ignore this message.</p>
  <p style="font-size:13px;color:#696f79;">Booking #${args.bookingNumber}</p>`
  await transport().sendMail({
    from: FROM,
    to: args.to,
    subject: `Please empty your KEF bike-box locker — booked again soon`,
    html: wrap('Please collect your bike box', inner),
  })
}

export async function sendIncomingDelayEmail(args: {
  to: string
  customerName: string
  lockerName: string
  bookingNumber: string
}): Promise<void> {
  if (!args.to) return
  const inner = `<p style="font-size:14px;color:#424857;line-height:1.55;">Hi ${args.customerName || 'there'},</p>
  <p style="font-size:14px;color:#424857;line-height:1.55;">Welcome to Iceland! A quick heads-up: the previous customer hasn't cleared <strong>${args.lockerName || 'your assigned locker'}</strong> yet, so it may not be ready the moment you arrive. Our team is on it and will sort it out — if there's any wait we'll be in touch right away.</p>
  <p style="font-size:13px;color:#696f79;">Booking #${args.bookingNumber}</p>`
  await transport().sendMail({
    from: FROM,
    to: args.to,
    subject: `A quick note about your KEF bike-box locker`,
    html: wrap('Your locker may need a few minutes', inner),
  })
}

export async function sendOpsHandoffAlert(args: {
  urgent: boolean
  outgoingName: string
  outgoingBooking: string
  outgoingEmail: string
  departedNote: string
  lockerName: string
  incomingName: string
  incomingBooking: string
  incomingStartMs: number
}): Promise<void> {
  const tag = args.urgent ? '🚨 URGENT' : '⚠️'
  const inner = `<p style="font-size:14px;color:#424857;line-height:1.6;">
  Locker <strong>${args.lockerName || '(unknown)'}</strong> may not be cleared in time.<br/><br/>
  <strong>Outgoing (not collected):</strong> ${args.outgoingName} · #${args.outgoingBooking} · ${args.outgoingEmail}<br/>
  ${args.departedNote ? `<span style="color:#b91c1c;">${args.departedNote}</span><br/>` : ''}
  <strong>Incoming (needs the locker):</strong> ${args.incomingName} · #${args.incomingBooking} · at <strong>${fmtTime(args.incomingStartMs)}</strong><br/><br/>
  The outgoing customer has been emailed to collect their box. Consider collecting it manually if they don't.</p>`
  await transport().sendMail({
    from: FROM,
    to: OPS_EMAIL,
    subject: `${tag} KEF locker handoff at risk — ${args.lockerName} before ${fmtTime(args.incomingStartMs)}`,
    html: wrap('KEF locker handoff at risk', inner),
  })
}
