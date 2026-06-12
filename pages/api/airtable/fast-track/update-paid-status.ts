import { NextApiRequest, NextApiResponse } from 'next'
import { timingSafeEqual } from 'crypto'
import { getFastTrackTable } from '../../../../utils/airtable'

// Legacy handler — kept for any external integrations (Zapier zaps,
// scripts) still pointing here. No internal code calls it (the
// updateFastTrackOrderToPayed wrapper in modules/AirTable/api.ts is dead
// code); Rapyd's canonical mark-paid path is /api/payment/webhooks via
// metadata.tableType === 'fast-track'.
//
// External callers MUST send the shared secret in the `x-api-secret`
// header (same secret and pattern as /api/airtable/update-paid-status).
// Fails closed: if PAID_STATUS_API_SECRET is unset, every request is
// rejected with 500 — this endpoint marks Fast-Track rows paid, so we'd
// rather an integration loudly break than silently accept
// unauthenticated traffic.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const expected = process.env.PAID_STATUS_API_SECRET
  if (!expected) {
    console.error(
      '[fast-track/update-paid-status] PAID_STATUS_API_SECRET is not set; refusing request'
    )
    return res.status(500).json({ message: 'Server misconfigured' })
  }

  const headerVal = req.headers['x-api-secret']
  const provided = Array.isArray(headerVal) ? headerVal[0] : headerVal
  if (typeof provided !== 'string' || provided.length === 0) {
    return res.status(403).json({ message: 'Forbidden' })
  }
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  const recordId = req.body as string
  if (typeof recordId !== 'string' || !/^rec[a-zA-Z0-9]+$/.test(recordId)) {
    return res.status(400).json({ message: 'invalid record id' })
  }

  try {
    // The 'Record ID' field this endpoint historically matched on is the
    // record's own Airtable ID, so a direct find replaces the previous
    // full-table scan.
    const table = getFastTrackTable()
    const record = await table.find(recordId).catch(() => null)
    if (!record) {
      return res.status(404).json({ message: 'Record not found' })
    }
    await table.update(record.id, { Greiðslustaða: 'Greitt', Greitt: true })
    res.status(200).json({ id: record.id, fields: record.fields })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'error in updating results' })
  }
}
