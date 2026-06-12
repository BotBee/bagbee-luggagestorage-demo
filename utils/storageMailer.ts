// Storage-booking confirmation email.
//
// Sent server-side once a Rapyd payment clears — fires from both
// /api/payment/webhooks (webhook path) and /api/storage/confirm-payment
// (browser-redirect path). Idempotency is enforced via the Airtable
// `Confirmation Email Sent` checkbox so the two code paths can race
// without double-sending.
//
// Uses the same Gmail SMTP setup as utils/partnerMailer.ts.

import nodemailer, { Transporter } from 'nodemailer'

const FROM_NAME = 'BagBee'
const FROM_EMAIL = 'bagbee@bagbee.is'
const SITE_URL = 'https://www.bagbee.is'
const LOGO_URL = `${SITE_URL}/images/bagbee-logo-green.png`
const BSI_ADDRESS = 'Vatnsmýrarvegur 10, 101 Reykjavík'
const BSI_MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=BSI+Bus+Terminal+Reykjavik'
const BSI_HOURS = 'Open daily 06:45–17:00'

let cachedTransport: Transporter | null = null

const getAppPassword = (): string => {
  const pw =
    process.env.GMAIL_APP_PASSWORD ||
    process.env.GOOgle_PASSWORD ||
    process.env.GOOGLE_PASSWORD ||
    ''
  if (!pw) {
    throw new Error(
      'GMAIL_APP_PASSWORD missing — storage confirmation email cannot be sent.',
    )
  }
  return pw
}

const getTransport = (): Transporter => {
  if (cachedTransport) return cachedTransport
  cachedTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: FROM_EMAIL, pass: getAppPassword() },
  })
  return cachedTransport
}

export type StorageConfirmationArgs = {
  bookingId: string
  /** Short reference like "315YE" from the Airtable formula field. */
  bookingNumber?: string
  customerName?: string
  customerEmail: string
  arrivalDate?: string
  arrivalTime?: string
  departureDate?: string
  departureTime?: string
  luggage?: number
  backpacks?: number
  totalIsk?: number
  /** True when the customer chose hotel delivery. */
  delivery?: boolean
  hotelName?: string
  hotelAddress?: string
}

const fmtDate = (iso?: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleString('en-GB', { month: 'short' })
  return `${day} ${month} ${d.getFullYear()}`
}

const fmtIsk = (n?: number): string =>
  typeof n === 'number' && !isNaN(n) ? `${n.toLocaleString()} kr` : '—'

const bagsLine = (luggage?: number, backpacks?: number): string => {
  const parts: string[] = []
  if (luggage && luggage > 0) parts.push(`${luggage} luggage`)
  if (backpacks && backpacks > 0)
    parts.push(`${backpacks} backpack${backpacks === 1 ? '' : 's'}`)
  return parts.length ? parts.join(' · ') : '—'
}

const renderHtml = (a: StorageConfirmationArgs): string => {
  const manageUrl = `${SITE_URL}/storage/${a.bookingId}`
  const displayRef = (a.bookingNumber || a.bookingId.slice(-5)).toUpperCase()
  const isDelivery = !!a.delivery

  return `<!doctype html>
<html>
<body style="margin:0; padding:0; background:#E5E6EB; font-family: 'Poppins', Arial, Helvetica, sans-serif; color:#000929;">
  <div style="max-width:560px; margin:0 auto; padding:32px 20px;">
    <div style="text-align:center; margin-bottom:24px;">
      <img src="${LOGO_URL}" alt="BagBee" height="32" style="height:32px;width:auto;display:inline-block;" />
    </div>

    <h1 style="font-size:24px; font-weight:600; margin:0 0 6px; color:#000929;">
      Your storage is booked
    </h1>
    <p style="font-size:14px; color:#696f79; margin:0 0 24px;">
      Booking reference: <strong style="color:#000929;">#${displayRef}</strong>
    </p>

    <!-- Summary card -->
    <div style="background:#fff; border:1px solid #e5e6eb; border-radius:20px; padding:24px; margin-bottom:24px;">
      <div style="font-size:11px; color:#696f79; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:14px; font-weight:600;">
        Booking summary
      </div>
      ${row('Customer', a.customerName)}
      ${row('Drop-off date', fmtDate(a.arrivalDate))}
      ${row('Check-in time', a.arrivalTime)}
      ${row('Pick-up date', fmtDate(a.departureDate))}
      ${row('Check-out time', a.departureTime)}
      ${row('Bags', bagsLine(a.luggage, a.backpacks))}
      ${row('Total paid', fmtIsk(a.totalIsk), true)}
    </div>

    ${
      isDelivery
        ? `
    <!-- Hotel delivery -->
    <div style="background:#fff; border:1px solid #e5e6eb; border-radius:20px; padding:24px; margin-bottom:24px;">
      <div style="font-size:11px; color:#696f79; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:14px; font-weight:600;">
        Hotel delivery
      </div>
      <p style="font-size:14px; line-height:1.55; margin:0 0 8px; color:#000929;">
        We'll bring your bags to <strong>${escapeHtml(a.hotelName || 'your hotel')}</strong>${
          a.hotelAddress ? `<br>${escapeHtml(a.hotelAddress)}` : ''
        } at your selected pick-up time.
      </p>
    </div>`
        : `
    <!-- BSÍ location -->
    <div style="background:#fff; border:1px solid #e5e6eb; border-radius:20px; padding:24px; margin-bottom:24px;">
      <div style="font-size:11px; color:#696f79; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:14px; font-weight:600;">
        Where to drop off &amp; pick up
      </div>
      <p style="font-size:15px; font-weight:500; margin:0 0 4px; color:#000929;">
        BSÍ Bus Terminal, Reykjavík
      </p>
      <p style="font-size:13px; color:#696f79; margin:0 0 4px;">
        ${BSI_ADDRESS}
      </p>
      <p style="font-size:13px; color:#696f79; margin:0 0 14px;">
        ${BSI_HOURS}
      </p>
      <a href="${BSI_MAPS_URL}" style="display:inline-block; font-size:13px; color:#3D7165; font-weight:600; text-decoration:underline;">
        Open in Google Maps →
      </a>
    </div>`
    }

    <!-- Manage button -->
    <div style="text-align:center; margin:0 0 24px;">
      <a href="${manageUrl}" style="display:inline-block; background:#000929; color:#fff; font-size:15px; font-weight:600; padding:14px 28px; border-radius:20px; text-decoration:none;">
        Manage your booking
      </a>
      <p style="font-size:12px; color:#a3a4a7; margin:12px 0 0;">
        Change dates, add bags, or cancel — up to 12 hours before drop-off.
      </p>
    </div>

    <p style="font-size:12px; color:#a3a4a7; text-align:center; line-height:1.6; margin-top:28px;">
      Questions? Just reply to this email or write to
      <a href="mailto:bagbee@bagbee.is" style="color:#696f79;">bagbee@bagbee.is</a>.<br>
      — BagBee
    </p>
  </div>
</body>
</html>`
}

const row = (label: string, value?: string | null, emphasise = false): string => {
  if (value === undefined || value === null || value === '' || value === '—') {
    // Skip empty rows so the card stays tight.
    if (label !== 'Total paid') return ''
  }
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f0f0f0;">
      <span style="font-size:13px; color:#696f79;">${escapeHtml(label)}</span>
      <span style="font-size:14px; font-weight:${emphasise ? 700 : 500}; color:#000929; text-align:right;">${escapeHtml(
    value || '—',
  )}</span>
    </div>`
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const renderText = (a: StorageConfirmationArgs): string => {
  const displayRef = (a.bookingNumber || a.bookingId.slice(-5)).toUpperCase()
  const manageUrl = `${SITE_URL}/storage/${a.bookingId}`
  const lines = [
    `Your BagBee storage is booked.`,
    `Booking reference: #${displayRef}`,
    ``,
    `Customer:       ${a.customerName ?? '—'}`,
    `Drop-off date:  ${fmtDate(a.arrivalDate)}`,
    `Check-in time:  ${a.arrivalTime ?? '—'}`,
    `Pick-up date:   ${fmtDate(a.departureDate)}`,
    `Check-out time: ${a.departureTime ?? '—'}`,
    `Bags:           ${bagsLine(a.luggage, a.backpacks)}`,
    `Total paid:     ${fmtIsk(a.totalIsk)}`,
    ``,
  ]
  if (a.delivery) {
    lines.push(
      `Hotel delivery to: ${a.hotelName ?? 'your hotel'}${
        a.hotelAddress ? `, ${a.hotelAddress}` : ''
      }`,
    )
  } else {
    lines.push(
      `Where to drop off & pick up:`,
      `  BSÍ Bus Terminal, Reykjavík`,
      `  ${BSI_ADDRESS}`,
      `  ${BSI_HOURS}`,
      `  Map: ${BSI_MAPS_URL}`,
    )
  }
  lines.push(
    ``,
    `Manage your booking (change dates, add bags, cancel up to 12h before drop-off):`,
    manageUrl,
    ``,
    `Questions? Reply to this email or write bagbee@bagbee.is.`,
    `— BagBee`,
  )
  return lines.join('\n')
}

export async function sendStorageConfirmation(
  args: StorageConfirmationArgs,
): Promise<void> {
  const transport = getTransport()
  const displayRef = (args.bookingNumber || args.bookingId.slice(-5)).toUpperCase()
  await transport.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: args.customerEmail,
    subject: `Your BagBee storage booking — #${displayRef}`,
    text: renderText(args),
    html: renderHtml(args),
  })
}
