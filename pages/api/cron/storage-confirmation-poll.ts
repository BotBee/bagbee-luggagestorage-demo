/**
 * Safety-net poller for storage / bikerent / luggage-lockers confirmation
 * emails — Vercel cron route (every 15 minutes).
 *
 * The normal path is INSTANT: when Rapyd confirms a card payment, our code
 * pings the Make confirmation webhook and the email goes out in ~1s. But some
 * bookings are paid by BANK TRANSFER — staff tick `Paid?` (or set Payment
 * Status = Paid) manually in Airtable, and no Rapyd webhook ever fires. This
 * poller catches those: it finds recently-paid bookings that still haven't had
 * their confirmation email and pings the same confirmation webhook for each
 * (the Make scenario dedupes on `Confirmation Email Sent`, so this is safe to
 * run repeatedly).
 *
 * Bounded to records created in the last 3 days so it can never blast old /
 * legacy paid rows. Protected by CRON_SECRET (matches the other cron routes).
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import Airtable from 'airtable'
import getAppConfig from '../../../modules/config'
import { notifyConfirmationEmail } from '../../../utils/notifyConfirmation'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'
const MAX_RECORDS = 25

export const config = { maxDuration: 60 }

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

    // Paid (card flag OR manual Payment Status), has an email, not yet emailed,
    // created in the last 3 days.
    const formula =
      'AND(' +
      'OR({Paid?} = TRUE(), {Payment Status} = "Paid"),' +
      'NOT({Confirmation Email Sent}),' +
      '{Email},' +
      "IS_AFTER(CREATED_TIME(), DATEADD(NOW(), -3, 'days'))" +
      ')'

    const records = await table
      .select({ filterByFormula: formula, maxRecords: MAX_RECORDS })
      .all()

    let pinged = 0
    for (const rec of records) {
      await notifyConfirmationEmail(rec.id)
      pinged++
    }

    return res.status(200).json({ ok: true, found: records.length, pinged })
  } catch (err) {
    console.error('[confirmation-poll] failed:', err)
    return res.status(500).json({ error: 'poll failed' })
  }
}
