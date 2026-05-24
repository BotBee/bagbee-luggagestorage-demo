// Server-side notifier for partner-portal events.
//
// Two events trigger emails to runar@bagbee.is:
//
//   1. partner created a new booking → "approve me" email. The order is
//      saved in Airtable with Greitt unchecked (= Pending). Once Runar
//      flips Greitt in Airtable, the existing customer-confirmation Zap
//      (Zap 262806875) fires the booking-confirmation email to the
//      passenger / partner contact.
//
//   2. partner edited an existing booking on the dashboard → "this is
//      what they changed" email with a per-field diff so Runar can see at
//      a glance whether the change matters (a phone-number correction is
//      fine; a pickup-date push needs operational follow-up).
//
// Delivery: SMTP via nodemailer using GMAIL_APP_PASSWORD (same pipeline as
// the login codes). Fail-soft: a mail outage must never block the
// underlying order create / update — errors are logged and swallowed.

import { OrderSummary } from './partnerOrders'
import { computeOrderPrice, formatIsk } from './partnerPricing'
import nodemailer, { Transporter } from 'nodemailer'

const FROM_NAME = 'BagBee Partner Portal'
const FROM_EMAIL = 'bagbee@bagbee.is'
// All partner-portal notifications (new orders + edits) land in the shared
// bagbee@bagbee.is inbox so whoever is on duty sees them. Was runar@
// originally; moved 2026-05 so the rest of the team can react when Runar
// is away.
const APPROVAL_RECIPIENT = 'bagbee@bagbee.is'

const AIRTABLE_BASE = 'appHB2bNYPAhfUcLv'
const AIRTABLE_TABLE = 'tblWLlNxZvtkFSFXs' // Nýtt/óflokkað (prod)

// Email-safe PNG. See partnerMailer.ts for why we use PNG over SVG and
// the www host directly (apex 308-redirects break <img src> in most
// email clients).
const LOGO_URL = 'https://www.bagbee.is/images/bagbee-logo-green.png'

const renderLogoBlockHtml = (caption: string): string => `
<div style="margin-bottom:16px;">
  <img src="${LOGO_URL}" alt="BagBee" height="24" style="height:24px;width:auto;display:inline-block;vertical-align:middle;" />
  <span style="font-size:10px;color:#696f79;text-transform:uppercase;letter-spacing:1px;margin-left:10px;vertical-align:middle;">${caption}</span>
</div>`

let cachedTransport: Transporter | null = null

const getAppPassword = (): string => {
  const pw =
    process.env.GMAIL_APP_PASSWORD ||
    process.env.GOOgle_PASSWORD ||
    process.env.GOOGLE_PASSWORD ||
    ''
  if (!pw) {
    throw new Error('GMAIL_APP_PASSWORD missing — notifications cannot be sent.')
  }
  return pw
}

const getTransport = (): Transporter => {
  if (cachedTransport) return cachedTransport
  cachedTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: FROM_EMAIL, pass: getAppPassword() },
    // Bound the SMTP timing — on Vercel serverless, a stalled SMTP
    // handshake otherwise spins the function until the platform timeout
    // (10s Hobby / 60s Pro). 8s gives Gmail plenty of headroom to
    // complete TLS + AUTH while still failing fast.
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  })
  return cachedTransport
}

const airtableUrl = (recordId: string): string =>
  `https://airtable.com/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${recordId}`

const partnerOrderUrl = (recordId: string): string =>
  `https://bagbee.is/partners/iceland-travel/orders/${recordId}`

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

// Compact summary that lives in both notification emails so Runar
// doesn't have to click into Airtable for the basics.
const renderOrderTableHtml = (o: OrderSummary): string => {
  const total = o.bagsRegular + o.bagsOdd
  const rows: Array<[string, string | null]> = [
    ['Partner reference', o.reference],
    ['Group / passenger', o.customerName],
    ['Contact name', o.contactName],
    ['Contact email', o.email],
    ['Contact phone', o.phone],
    ['Service', o.serviceType],
    ['Flight date', o.flightDate],
    ['Pickup date', o.pickupDate],
    ['Time window', o.timeWindow],
    ['Pickup address', o.pickupAddress],
    ['Delivery address', o.deliveryAddress],
    ['Airline / flight', [o.airline, o.flightNumber].filter(Boolean).join(' ') || null],
    ['Destination', o.destinationCode],
    [
      'Bags',
      `${total} total${o.bagsOdd > 0 ? ` (${o.bagsOdd} odd-size)` : ''}`,
    ],
    ['Estimated amount', o.amount > 0 ? `${o.amount} ${o.currency || 'ISK'}` : null],
    ['Notes', o.comment],
  ]
  const cells = rows
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#696f79;font-size:12px;white-space:nowrap;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:6px 0;font-size:13px;color:#000929;">${escapeHtml(String(v))}</td></tr>`,
    )
    .join('')
  return `<table style="border-collapse:collapse;margin:14px 0;">${cells}</table>`
}

const renderOrderTextSummary = (o: OrderSummary): string => {
  const total = o.bagsRegular + o.bagsOdd
  const rows: Array<[string, string | null]> = [
    ['Partner reference', o.reference],
    ['Group / passenger', o.customerName],
    ['Contact name', o.contactName],
    ['Contact email', o.email],
    ['Contact phone', o.phone],
    ['Service', o.serviceType],
    ['Flight date', o.flightDate],
    ['Pickup date', o.pickupDate],
    ['Time window', o.timeWindow],
    ['Pickup address', o.pickupAddress],
    ['Delivery address', o.deliveryAddress],
    ['Airline / flight', [o.airline, o.flightNumber].filter(Boolean).join(' ') || null],
    ['Destination', o.destinationCode],
    [
      'Bags',
      `${total} total${o.bagsOdd > 0 ? ` (${o.bagsOdd} odd-size)` : ''}`,
    ],
    ['Estimated amount', o.amount > 0 ? `${o.amount} ${o.currency || 'ISK'}` : null],
    ['Notes', o.comment],
  ]
  return rows
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

// ---------------------------------------------------------------------------
// 1. New-order approval notice
// ---------------------------------------------------------------------------

// Build a price-summary block that goes into Runar's approval email. We
// re-run the calculator here (rather than trusting the order's stored
// `amount`) so the email always reflects the current pricelist, even if
// the partner submitted with a stale or manually-overridden number.
const renderPriceBlockHtml = async (order: OrderSummary): Promise<string> => {
  try {
    const quote = await computeOrderPrice({
      customer: 'Iceland Travel',
      serviceType: order.serviceType,
      bagsRegular: order.bagsRegular,
      bagsOdd: order.bagsOdd,
      timeWindow: order.timeWindow,
      pickupAddress: order.pickupAddress,
      deliveryAddress: order.deliveryAddress,
    })
    if (quote.kind === 'priced') {
      const lines = quote.lineItems
        .map(
          (li) =>
            `<tr><td style="padding:3px 12px 3px 0;color:#696f79;font-size:12px;">${escapeHtml(li.label)}</td><td style="padding:3px 0;font-size:13px;color:#000929;">${escapeHtml(formatIsk(li.amountIsk))}</td></tr>`,
        )
        .join('')
      return `<div style="margin:14px 0;padding:14px 16px;background:#f1f7f5;border:1px solid #3d7165;border-radius:10px;">
        <div style="font-size:11px;color:#696f79;text-transform:uppercase;letter-spacing:0.4px;">Auto-quote from pricelist</div>
        <div style="font-size:22px;font-weight:700;color:#000929;margin:4px 0 8px;">${escapeHtml(formatIsk(quote.totalIsk))}</div>
        <table style="border-collapse:collapse;">${lines}</table>
        <div style="font-size:11px;color:#696f79;margin-top:8px;">Pricelist row: ${escapeHtml(quote.pricelistRowName)} · ${quote.pax} pax</div>
      </div>`
    }
    return `<div style="margin:14px 0;padding:14px 16px;background:#fff8e6;border:1px solid #e0c878;border-radius:10px;">
      <div style="font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:0.4px;">Outside the standard pricelist</div>
      <div style="font-size:13px;color:#6f5a14;margin-top:6px;">${escapeHtml(quote.reason)}</div>
    </div>`
  } catch (err) {
    console.error('[partnerNotifications] price calc failed for email', err)
    return ''
  }
}

export async function sendNewOrderApprovalNotice(
  partner: 'iceland-travel',
  partnerDisplayName: string,
  order: OrderSummary,
): Promise<void> {
  const subject = `New booking from ${partnerDisplayName} — needs your approval (ref ${order.reference || order.orderNoShort})`
  const links = `<p style="font-size:13px;">
    <a href="${airtableUrl(order.id)}" style="color:#3d7165;">Open in Airtable</a>
    &nbsp;·&nbsp;
    <a href="${partnerOrderUrl(order.id)}" style="color:#3d7165;">Open in partner portal</a>
  </p>`
  const priceBlock = await renderPriceBlockHtml(order)
  const html = `
<!doctype html>
<html><body style="font-family:Arial,Helvetica,sans-serif;color:#000929;max-width:560px;margin:0 auto;padding:24px;">
  ${renderLogoBlockHtml('New partner booking · pending approval')}
  <h2 style="margin:6px 0 14px;font-size:20px;">${escapeHtml(partnerDisplayName)} just submitted a booking.</h2>
  ${priceBlock}
  <p style="font-size:13px;line-height:1.5;">
    The order is sitting in Airtable with <b>Greitt</b> unchecked. Confirm
    the details look right, then flip <b>Greitt</b> to fire the customer
    confirmation email.
  </p>
  ${renderOrderTableHtml(order)}
  ${links}
  <p style="font-size:11px;color:#a3a4a7;margin-top:32px;">— BagBee partner portal</p>
</body></html>`
  const text =
    `New booking from ${partnerDisplayName} — needs your approval.\n` +
    `Order is pending (Greitt unchecked).\n\n` +
    renderOrderTextSummary(order) +
    `\n\n` +
    `Airtable: ${airtableUrl(order.id)}\n` +
    `Portal:   ${partnerOrderUrl(order.id)}\n`

  await sendMail(subject, text, html, order.id)
}

// ---------------------------------------------------------------------------
// 2. Order update notice
// ---------------------------------------------------------------------------

// Field key → human label for the diff table. Anything not in this map is
// shown as-is in lowercased form — fine for the occasional new column.
const FIELD_LABELS: Record<string, string> = {
  reference: 'Partner reference',
  bagsRegular: 'Bags (regular)',
  bagsOdd: 'Bags (odd-size)',
  pickupDate: 'Pickup date',
  flightDate: 'Flight date',
  timeWindow: 'Time window',
  pickupAddress: 'Pickup address',
  pickupLatOverride: 'Pickup latitude (manual)',
  pickupLngOverride: 'Pickup longitude (manual)',
  deliveryAddress: 'Delivery address',
  deliveryDate: 'Delivery date',
  deliveryTimeWindow: 'Delivery time window',
  flightNumber: 'Flight number',
  airline: 'Airline',
  comment: 'Notes',
  contactName: 'Contact name',
  email: 'Contact email',
  phone: 'Contact phone',
  serviceType: 'Service',
}

export type UpdateDiff = {
  field: string
  before: string | number | null
  after: string | number | null
}

const fmt = (v: string | number | null | undefined): string => {
  if (v == null || v === '') return '(empty)'
  return String(v)
}

// One stacked block per changed field — easier to scan than a wide
// 4-column row, and survives Gmail's table-collapsing on narrow viewports.
// Each block shows:
//   FIELD NAME
//   Before: <old value, red, strikethrough>
//   After:  <new value, green, bold>
const renderDiffTableHtml = (diffs: UpdateDiff[]): string => {
  const blocks = diffs
    .map(({ field, before, after }) => {
      const label = FIELD_LABELS[field] || field
      return `
<div style="margin:0 0 14px;padding:12px 14px;border:1px solid #ecedf0;border-radius:8px;background:#fafbfc;">
  <div style="font-size:11px;font-weight:700;color:#000929;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">${escapeHtml(label)}</div>
  <div style="display:block;font-size:13px;margin-bottom:4px;">
    <span style="display:inline-block;width:60px;color:#696f79;font-weight:600;">Before:</span>
    <span style="color:#b3261e;text-decoration:line-through;">${escapeHtml(fmt(before))}</span>
  </div>
  <div style="display:block;font-size:13px;">
    <span style="display:inline-block;width:60px;color:#696f79;font-weight:600;">After:</span>
    <span style="color:#176c2c;font-weight:700;">${escapeHtml(fmt(after))}</span>
  </div>
</div>`
    })
    .join('')
  return `<div style="margin:14px 0;">${blocks}</div>`
}

const renderDiffTextSummary = (diffs: UpdateDiff[]): string =>
  diffs
    .map(({ field, before, after }) => {
      const label = FIELD_LABELS[field] || field
      return [
        ``,
        `${label}`,
        `  Before: ${fmt(before)}`,
        `  After:  ${fmt(after)}`,
      ].join('\n')
    })
    .join('\n')

export async function sendOrderUpdateNotice(args: {
  partner: 'iceland-travel'
  partnerDisplayName: string
  actorEmail: string
  actorName: string | null
  order: OrderSummary
  diffs: UpdateDiff[]
}): Promise<void> {
  const { partnerDisplayName, actorEmail, actorName, order, diffs } = args
  if (diffs.length === 0) return // nothing to email about

  const who =
    actorName && actorName.trim()
      ? `${actorName.trim()} (${actorEmail})`
      : actorEmail
  const subject = `${partnerDisplayName} edited booking ${order.reference || order.orderNoShort} — ${diffs.length} change${diffs.length === 1 ? '' : 's'}`
  const links = `<p style="font-size:13px;">
    <a href="${airtableUrl(order.id)}" style="color:#3d7165;">Open in Airtable</a>
    &nbsp;·&nbsp;
    <a href="${partnerOrderUrl(order.id)}" style="color:#3d7165;">Open in partner portal</a>
  </p>`
  const html = `
<!doctype html>
<html><body style="font-family:Arial,Helvetica,sans-serif;color:#000929;max-width:600px;margin:0 auto;padding:24px;">
  ${renderLogoBlockHtml('Booking edited via partner portal')}
  <h2 style="margin:6px 0 14px;font-size:20px;">${escapeHtml(who)} updated <span style="color:#3d7165;">${escapeHtml(order.reference || order.orderNoShort)}</span></h2>
  <p style="font-size:13px;color:#696f79;">${escapeHtml(partnerDisplayName)} · ${diffs.length} field${diffs.length === 1 ? '' : 's'} changed</p>
  ${renderDiffTableHtml(diffs)}
  ${links}
  <p style="font-size:11px;color:#a3a4a7;margin-top:32px;">— BagBee partner portal</p>
</body></html>`
  const text =
    `${who} edited ${order.reference || order.orderNoShort} in ${partnerDisplayName}'s partner portal.\n\n` +
    `Changes:\n` +
    renderDiffTextSummary(diffs) +
    `\n\n` +
    `Airtable: ${airtableUrl(order.id)}\n` +
    `Portal:   ${partnerOrderUrl(order.id)}\n`

  await sendMail(subject, text, html, order.id)
}

// ---------------------------------------------------------------------------
// Internal: one-shot SMTP send with logging-only failure mode.
// ---------------------------------------------------------------------------

const sendMail = async (
  subject: string,
  text: string,
  html: string,
  contextId: string,
): Promise<void> => {
  const startedAt = Date.now()
  try {
    const transport = getTransport()
    const info = await transport.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: APPROVAL_RECIPIENT,
      subject,
      text,
      html,
    })
    // Log success so Vercel function logs show emails actually leaving;
    // makes it possible to debug "no email arrived" from the dashboard
    // without instrumenting the recipient inbox.
    console.log(
      `[partnerNotifications] sent ${info.messageId || '(no msgid)'} to ${APPROVAL_RECIPIENT} for ${contextId} in ${Date.now() - startedAt}ms`,
    )
  } catch (err) {
    // Never let a mail failure cascade — the underlying order create /
    // update has already succeeded by the time we get here.
    console.error(
      `[partnerNotifications] failed to send mail for ${contextId} after ${Date.now() - startedAt}ms`,
      err,
    )
  }
}
