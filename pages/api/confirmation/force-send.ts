/**
 * Force / resend the confirmation email for a BSI Storage booking from
 * Airtable. Designed to be wired to an Airtable "Open URL" button field:
 *
 *   "https://www.bagbee.is/api/confirmation/force-send?recordId=" & RECORD_ID()
 *
 * (append "&key=YOUR_KEY" if CONFIRMATION_FORCE_KEY is set in Vercel).
 *
 * Used mainly for BANK-TRANSFER payments, where staff tick Paid manually and
 * no Rapyd webhook fires. It unticks `Confirmation Email Sent` then pings the
 * Make confirmation webhook, so the scenario re-sends even if a confirmation
 * already went out. Opens in a browser tab and returns a tiny status page.
 *
 * Auth: if CONFIRMATION_FORCE_KEY is set, the `key` query param must match.
 * If it is not set, the endpoint is open (low-risk: it can only re-send a
 * confirmation to the booking's own email). Set the env to lock it down.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import Airtable, { FieldSet } from 'airtable'
import getAppConfig from '../../../modules/config'
import { notifyConfirmationEmail } from '../../../utils/notifyConfirmation'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'

const page = (title: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:Poppins,Arial,sans-serif;background:#E5E6EB;margin:0;padding:48px 16px;text-align:center;color:#000929;"><div style="max-width:420px;margin:0 auto;background:#fff;border-radius:18px;padding:32px 24px;box-shadow:0 10px 40px -16px rgba(0,0,0,0.2);"><h1 style="font-size:20px;margin:0 0 10px;">${title}</h1><p style="font-size:14px;color:#696f79;line-height:1.5;margin:0;">${body}</p></div></body></html>`

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { recordId, key } = req.query as { recordId?: string; key?: string }

  const expectedKey = process.env.CONFIRMATION_FORCE_KEY
  if (expectedKey && key !== expectedKey) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(401).send(page('Not authorized', 'This link is missing a valid key.'))
  }

  if (!recordId || typeof recordId !== 'string') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(400).send(page('Missing booking', 'No record id was provided.'))
  }

  const {
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
  } = getAppConfig()

  try {
    Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
    const table = Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)

    let record
    try {
      record = await table.find(recordId)
    } catch {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.status(404).send(page('Booking not found', 'That booking could not be found.'))
    }

    if (!record.fields['Email']) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res
        .status(400)
        .send(page('No email on booking', 'Add an email address to this booking, then try again.'))
    }

    // Untick the sent flag so the Make scenario will (re)send, then ping it.
    await table.update(recordId, { 'Confirmation Email Sent': false } as FieldSet)
    await notifyConfirmationEmail(recordId)

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res
      .status(200)
      .send(
        page(
          'Confirmation email sent ✓',
          `The confirmation email is on its way to ${String(record.fields['Email'])}. You can close this tab.`,
        ),
      )
  } catch (err) {
    console.error('[confirmation/force-send] failed:', err)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res
      .status(500)
      .send(page('Something went wrong', 'Please try again, or contact the dev team.'))
  }
}
