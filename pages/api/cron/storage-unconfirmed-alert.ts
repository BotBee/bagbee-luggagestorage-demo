/**
 * Unconfirmed-booking reconciliation alert — Vercel cron route (every 6 hours).
 *
 * WHY THIS EXISTS
 * ---------------
 * BSI Storage bookings arrive from several entry points, and not all of them
 * link the Rapyd payment back to the Airtable record:
 *
 *   - The in-house React checkout (/luggagestorage, /embed/*) creates a Rapyd
 *     checkout, stamps `Rapyd Checkout ID`, and the webhook marks the record
 *     `Paid` + stamps `Rapyd Payment ID`. Fully traceable.
 *   - EXTERNAL forms / landing pages (Fillout, marketing pages) write a record
 *     straight to Airtable and take payment OUT OF BAND (a Rapyd payment link,
 *     a separate Fillout payment step that doesn't write the id back). These
 *     land with NO `Rapyd Checkout ID` / `Rapyd Payment ID`, so nothing can
 *     auto-mark them Paid. They are tagged only by the `Reference` field, which
 *     is the booking-site label (e.g. "BagBee website", "Cheap Luggage
 *     Storage", "luggagelockers.is", "bikerent.is", "bagbee.is").
 *
 * We have repeatedly found such bookings paid in Rapyd but never confirmed in
 * Airtable (Carol Zander, Jenny Burnsed, Alberto Domenighini). This cron is the
 * safety net: it surfaces every recent booking that is NOT marked Paid, after a
 * 2-hour grace period (so in-flight React checkouts that are still `Pending`
 * aren't flagged), and emails a single digest to bagbee@ GROUPED BY SOURCE
 * (`Reference`) so we can see exactly which booking site each one came through
 * and reconcile the payment.
 *
 * Idempotent: each record is flagged with `Reconcile alert sent` once it's been
 * reported, so it is never alerted twice. Bounded to the last 3 days + 50 rows
 * so it can never blast old/legacy data. Protected by CRON_SECRET.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import Airtable from 'airtable'
import nodemailer, { Transporter } from 'nodemailer'
import getAppConfig from '../../../modules/config'

const BASE_ID = 'appHB2bNYPAhfUcLv'
const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'
const ALERT_TO = 'bagbee@bagbee.is'
const MAX_RECORDS = 50

export const config = { maxDuration: 60 }

let cachedTransport: Transporter | null = null
const transport = (): Transporter => {
  if (cachedTransport) return cachedTransport
  const pass =
    process.env.GMAIL_APP_PASSWORD ||
    process.env.GOOgle_PASSWORD ||
    process.env.GOOGLE_PASSWORD ||
    ''
  if (!pass) throw new Error('GMAIL_APP_PASSWORD missing — reconciliation alert cannot be sent')
  cachedTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: 'bagbee@bagbee.is', pass },
  })
  return cachedTransport
}

const airtableLink = (recId: string) =>
  `https://airtable.com/${BASE_ID}/${BSI_STORAGE_TABLE_ID}/${recId}`

// React bookings stamp `Total Amount ISK`; legacy/external forms use older total
// fields with other display names — fall back to any numeric field that looks
// like a total so the digest still shows an amount.
const findTotal = (fields: Record<string, any>): number => {
  const direct = Number(fields['Total Amount ISK'])
  if (direct > 0) return direct
  for (const [k, v] of Object.entries(fields)) {
    if (/total|verð|amount|cost/i.test(k)) {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return 0
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const fmtDate = (iso?: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return esc(String(iso))
  const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getUTCDate()} ${mons[d.getUTCMonth()]}`
}

const fmtDateTime = (iso?: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${d.getUTCDate()} ${mons[d.getUTCMonth()]} ${hh}:${mm}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const expected = process.env.CRON_SECRET
  const auth = req.headers.authorization
  if (!expected || auth !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const {
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
  } = getAppConfig()

  try {
    Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
    const table = Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)

    // Not confirmed (neither the Paid? flag nor Payment Status = Paid), not
    // cancelled/refunded, has an email, not already alerted, created in the last
    // 3 days but more than 2 hours ago (grace for in-flight card checkouts).
    const formula =
      'AND(' +
      'NOT(OR({Paid?} = TRUE(), {Payment Status} = "Paid")),' +
      '{Payment Status} != "Cancelled",' +
      '{Payment Status} != "Refunded",' +
      '{Email},' +
      'NOT({Reconcile alert sent}),' +
      "IS_AFTER(CREATED_TIME(), DATEADD(NOW(), -3, 'days'))," +
      "IS_BEFORE(CREATED_TIME(), DATEADD(NOW(), -2, 'hours'))" +
      ')'

    const records = await table
      .select({ filterByFormula: formula, maxRecords: MAX_RECORDS })
      .all()

    if (records.length === 0) {
      return res.status(200).json({ ok: true, found: 0, alerted: 0 })
    }

    // Group by Reference (the booking-site label) so the digest shows source.
    type Row = {
      id: string
      name: string
      email: string
      total: number
      arrival?: string
      departure?: string
      created?: string
      reason: string
    }
    const bySource = new Map<string, Row[]>()

    for (const rec of records) {
      const f = rec.fields as Record<string, any>
      const source = String(f['Reference'] || '(no source label)')
      const hasCheckout = !!f['Rapyd Checkout ID']
      const hasPayment = !!f['Rapyd Payment ID']
      let reason: string
      if (!hasCheckout && !hasPayment) {
        reason = 'External form — no Rapyd checkout linked (paid out of band)'
      } else if (hasCheckout && !hasPayment) {
        reason = 'Reached Rapyd checkout, no payment recorded (webhook miss or abandoned)'
      } else {
        reason = 'Has payment id but not marked Paid — check'
      }
      const row: Row = {
        id: rec.id,
        name: String(f['Name'] || '—'),
        email: String(f['Email'] || '—'),
        total: findTotal(f),
        arrival: f['ArrivalDate'] as string | undefined,
        departure: f['Departure date'] as string | undefined,
        created: (rec as any)._rawJson?.createdTime as string | undefined,
        reason,
      }
      const list = bySource.get(source) || []
      list.push(row)
      bySource.set(source, list)
    }

    // Build the email.
    const sourceBlocks = Array.from(bySource.entries())
      .map(([source, rows]) => {
        const items = rows
          .map((r) => {
            const total = r.total > 0 ? `${r.total.toLocaleString()} kr` : '—'
            const dates =
              r.arrival || r.departure
                ? `${fmtDate(r.arrival)} → ${fmtDate(r.departure)}`
                : '—'
            return `<div style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:13px;line-height:1.5;">
  <strong style="color:#000929;">${esc(r.name)}</strong> &nbsp;·&nbsp; <a href="mailto:${esc(r.email)}" style="color:#1a7f5a;">${esc(r.email)}</a><br/>
  <span style="color:#696f79;">Amount:</span> ${total} &nbsp;·&nbsp; <span style="color:#696f79;">Storage:</span> ${dates} &nbsp;·&nbsp; <span style="color:#696f79;">Booked:</span> ${fmtDateTime(r.created)}<br/>
  <span style="color:#b4690e;">⚠ ${esc(r.reason)}</span><br/>
  <a href="${airtableLink(r.id)}" style="color:#1a7f5a;font-weight:600;">Open in Airtable →</a>
</div>`
          })
          .join('')
        return `<div style="background:#fff;border:1px solid #e5e6eb;border-radius:14px;padding:18px 20px;margin-bottom:14px;">
  <div style="font-size:11px;color:#696f79;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;padding-bottom:4px;">Booking site</div>
  <div style="font-size:16px;font-weight:600;color:#000929;padding-bottom:6px;">${esc(source)} <span style="font-size:12px;color:#a3a4a7;font-weight:400;">(${rows.length})</span></div>
  ${items}
</div>`
      })
      .join('')

    const html = `<div style="background:#E5E6EB;padding:28px 14px;font-family:Poppins,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;">
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:600;color:#000929;">${records.length} unconfirmed storage booking${records.length === 1 ? '' : 's'} to review</h1>
    <p style="margin:0 0 18px;font-size:13px;color:#696f79;line-height:1.5;">These BSI Storage bookings from the last 3 days are <strong>not marked Paid</strong> and are more than 2 hours old. Grouped by booking site (the <code>Reference</code> field). Check each one in Rapyd — if it paid, tick <strong>Paid?</strong> in Airtable; if it was abandoned, ignore it.</p>
    ${sourceBlocks}
    <p style="margin:12px 0 0;font-size:11px;color:#a3a4a7;line-height:1.5;">Each booking is reported once. Automated reconciliation check from www.bagbee.is.</p>
  </div>
</div>`

    await transport().sendMail({
      from: 'BagBee Reconciliation <bagbee@bagbee.is>',
      to: ALERT_TO,
      subject: `⚠️ ${records.length} unconfirmed storage booking${records.length === 1 ? '' : 's'} — review payment`,
      html,
    })

    // Flag every reported record so it isn't alerted again (batches of 10).
    const updates = records.map((r) => ({
      id: r.id,
      fields: { 'Reconcile alert sent': true },
    }))
    for (let i = 0; i < updates.length; i += 10) {
      await table.update(updates.slice(i, i + 10))
    }

    return res.status(200).json({ ok: true, found: records.length, alerted: records.length })
  } catch (err) {
    console.error('[unconfirmed-alert] failed:', err)
    return res.status(500).json({ error: 'alert failed' })
  }
}
