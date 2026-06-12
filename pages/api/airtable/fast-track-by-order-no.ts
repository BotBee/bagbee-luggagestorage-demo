import { NextApiRequest, NextApiResponse } from 'next'
import { getFastTrackTable } from '../../../utils/airtable'

export type FastTrackPassenger = { firstName: string; lastName: string }
export type FastTrackRecord = {
  id: string
  passengers: FastTrackPassenger[]
  flightDate: string | null
  paidAmount: number | null
}

/**
 * Fetch paid Fast-Track records that match a customer's email + flight date.
 *
 * Background: only ~27/930 paid Fast-Track records actually have the
 * {order number} text or {Pöntunarnúmer} linked-record set on them — most
 * Fast-Track sales (e.g. from Kolumbus partner channels or older flows that
 * never wrote the back-link) leave both fields blank. To still surface a
 * paid Fast-Track on the order page, we match by the natural keys that are
 * reliably populated on both tables:
 *   - Email (Tölvupóstfang on the order ↔ Email on Fast Track), case-insensitive
 *   - Flight date (Dagsetning flugs ↔ Flight date), exact ISO YYYY-MM-DD
 *
 * Multiple Fast-Track rows can match (e.g. a household >4 passengers booked in
 * two transactions). We return all of them so the caller can merge passengers.
 *
 * GET /api/airtable/fast-track-by-order-no?email=foo@bar.com&flightDate=2026-05-20
 *
 * (Kept the legacy `orderNo` query param around for callers that still pass it
 * — when only orderNo is given we return an empty list rather than guessing.)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const email = String(req.query.email || '').trim().toLowerCase()
  const flightDate = String(req.query.flightDate || '').trim()

  if (!email || !flightDate) {
    // Either param missing: nothing to match on. Return empty list rather
    // than 400 so the order page falls back gracefully to the purchase promo.
    return res.status(200).json({ fastTracks: [] })
  }

  if (!/^[\w.+-]+@[\w.-]+\.\w+$/i.test(email)) {
    return res.status(400).json({ message: 'invalid email' })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(flightDate)) {
    return res.status(400).json({ message: 'invalid flightDate (expect YYYY-MM-DD)' })
  }

  try {
    const table = getFastTrackTable()
    // Escape single quotes in the email for the formula string literal.
    const safeEmail = email.replace(/'/g, "\\'")
    // DATETIME_FORMAT normalises Airtable's date value to YYYY-MM-DD for the
    // string compare (raw {Flight date} would be a date object, not text).
    const records = await table
      .select({
        filterByFormula: `AND(LOWER({Email})='${safeEmail}',DATETIME_FORMAT({Flight date},'YYYY-MM-DD')='${flightDate}',{Greiddi}=TRUE())`,
      })
      .all()

    const fastTracks: FastTrackRecord[] = records.map((record) => {
      const f = record.fields as Record<string, any>
      const passengers: FastTrackPassenger[] = []
      for (let i = 1; i <= 4; i++) {
        // Prefer the raw text fields; fall back to the FX formula variants
        // (Passenger 1 First Name FX etc.) which some older records populate
        // when the text column is blank.
        const firstName = String(
          f[`Passenger ${i} First Name`] || f[`Passenger ${i} First Name FX`] || ''
        ).trim()
        const lastName = String(
          f[`Passenger ${i} Last Name`] || f[`Passenger ${i} Last Name FX`] || ''
        ).trim()
        if (firstName || lastName) {
          passengers.push({ firstName, lastName })
        }
      }
      const rawDate = f['Flight date']
      const recFlightDate = rawDate ? String(rawDate) : null
      const rawAmount = f['Upphæð']
      const paidAmount = typeof rawAmount === 'number' ? rawAmount : null

      return {
        id: record.id,
        passengers,
        flightDate: recFlightDate,
        paidAmount,
      }
    })

    res.status(200).json({ fastTracks })
  } catch (error) {
    console.error('[fast-track-by-order-no] error', error)
    res.status(500).json({ message: 'error reading fast-track records' })
  }
}
