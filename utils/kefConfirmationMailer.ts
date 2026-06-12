/**
 * Paid booking-confirmation email for KEF bike-box bookings — includes the
 * self-service MANAGE-ORDER link (/kef/{bookingNumber}). Sent once a booking is
 * Paid, from both the webhook and the payment-success redirect; idempotent via
 * the "Booking confirmation sent" flag so the two paths can't double-send.
 *
 * The PIN itself still arrives separately a few hours before drop-off (Make
 * scenarios 5712776 / 5712792) — this is the immediate "you're booked" email.
 */
import nodemailer, { Transporter } from 'nodemailer'
import { findKefBooking, loadOrderRows, updateKefRows } from './kefBooking'
import { FLD } from './kefLockersAirtable'

const SITE_URL = 'https://www.bagbee.is'
let cached: Transporter | null = null
const transport = (): Transporter => {
  if (cached) return cached
  const pass =
    process.env.GMAIL_APP_PASSWORD || process.env.GOOgle_PASSWORD || process.env.GOOGLE_PASSWORD || ''
  if (!pass) throw new Error('GMAIL_APP_PASSWORD missing — KEF confirmation email cannot be sent')
  cached = nodemailer.createTransport({ service: 'gmail', auth: { user: 'bagbee@bagbee.is', pass } })
  return cached
}

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Reykjavik == UTC.
const fmt = (iso?: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${mons[d.getUTCMonth()]}, ${hh}:${mm}`
}
const win = (startIso?: string, endIso?: string): string => {
  const s = fmt(startIso)
  if (!s) return ''
  const e = endIso ? new Date(endIso) : null
  const eh = e && !isNaN(e.getTime()) ? `–${String(e.getUTCHours()).padStart(2, '0')}:${String(e.getUTCMinutes()).padStart(2, '0')}` : ''
  return `${s}${eh}`
}

const row = (label: string, value: string) =>
  `<div style="padding:9px 0;border-bottom:1px solid #f0f0f0;font-size:14px;"><span style="color:#696f79;">${label}:</span> <strong style="color:#000929;">${value}</strong></div>`

/**
 * Send the confirmation for an order (identified by its lead row id). No-op if
 * the booking isn't Paid or the email already went out.
 */
export async function sendKefConfirmation(leadId?: string): Promise<void> {
  if (!leadId) return
  const lead = await findKefBooking(leadId)
  if (!lead) return
  const f = lead.fields as Record<string, any>
  if (f[FLD.bookings.paymentStatus] !== 'Paid') return
  if (f[FLD.bookings.confirmationSent]) return
  const email = String(f[FLD.bookings.email] || '')
  if (!email) return

  const checkoutId = f[FLD.bookings.rapydCheckoutId] as string | undefined
  const rows = checkoutId ? await loadOrderRows(checkoutId) : [lead]
  const boxes = rows.length || 1
  const total = rows.reduce((s, r) => s + (Number((r.fields as any)[FLD.bookings.amount]) || 0), 0)
  const bookingNumber = String(f[FLD.bookings.bookingNumber] || '')
  const manageUrl = `${SITE_URL}/kef/${bookingNumber}`
  const isKef = (f[FLD.bookings.returnLocation] as string) !== 'BSÍ terminal'

  const summary =
    row('Drop-off at KEF', win(f[FLD.bookings.checkInDatetime], f[FLD.bookings.checkInWindowEnd])) +
    (isKef
      ? row('Return (KEF locker)', win(f[FLD.bookings.checkOutDatetime], f[FLD.bookings.checkOutWindowEnd]))
      : row('Return', 'BSÍ bus terminal, Reykjavík')) +
    row('Bike boxes', String(boxes)) +
    `<div style="padding:11px 0 0;font-size:15px;"><span style="color:#696f79;">Total paid:</span> <strong style="color:#000929;">${total.toLocaleString()} kr</strong></div>`

  const html = `<div style="background:#E5E6EB;padding:32px 16px;font-family:Poppins,Arial,sans-serif;"><div style="max-width:540px;margin:0 auto;"><div style="text-align:center;padding-bottom:20px;"><img src="${SITE_URL}/images/bagbee-logo-green.png" alt="BagBee" height="34" /></div>
  <h1 style="margin:0 0 6px;font-size:23px;font-weight:600;color:#000929;">Your bike-box locker is booked</h1>
  <p style="margin:0 0 20px;font-size:14px;color:#696f79;line-height:1.5;">Hi ${String(f[FLD.bookings.customerName] || 'there')} — thanks for booking with BagBee at Keflavík Airport. Booking reference: <strong style="color:#000929;">#${bookingNumber}</strong></p>
  <div style="background:#fff;border:1px solid #e5e6eb;border-radius:18px;padding:22px 24px;margin-bottom:18px;"><div style="font-size:11px;color:#696f79;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;padding-bottom:8px;">Booking summary</div>${summary}</div>
  <div style="text-align:center;margin-bottom:8px;"><a href="${manageUrl}" style="display:inline-block;background:#000929;color:#fff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:18px;text-decoration:none;">View or change your booking</a></div>
  <p style="text-align:center;margin:0 0 24px;font-size:12px;color:#a3a4a7;">Change dates, your time window, or cancel from your booking page — up to 24 h before drop-off. We'll email your locker number and PIN a few hours before you land.</p>
  <p style="text-align:center;margin:0;font-size:12px;color:#a3a4a7;line-height:1.6;">Questions? Reply to this email or write to <a href="mailto:bagbee@bagbee.is" style="color:#696f79;">bagbee@bagbee.is</a>.<br/>— BagBee</p></div></div>`

  await transport().sendMail({
    from: 'BagBee <bagbee@bagbee.is>',
    to: email,
    subject: `Your KEF bike-box locker is booked — #${bookingNumber}`,
    html,
  })
  // Mark sent on the lead row so neither path re-sends.
  await updateKefRows([lead.id], { [FLD.bookings.confirmationSent]: true })
}
