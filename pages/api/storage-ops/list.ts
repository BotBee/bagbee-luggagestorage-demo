/**
 * Staff dashboard — list BSI Storage bookings for the operations view.
 *
 * Default (no params): the active window — anything departing/arriving in the
 * last 14 days or any time in the future. Bounded so the dashboard never pulls
 * the entire historical table.
 *
 * With ?from=YYYY-MM-DD&to=YYYY-MM-DD : bookings overlapping that window (for
 * the calendar month navigation).
 *
 * Guarded by the shared DISPATCH_ADMIN_KEY (same key as /admin/dispatch).
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../utils/dispatch/auth'
import { getStorageTable, normalize } from '../../../utils/storageOps'

export const config = { maxDuration: 30 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' })
  if (!requireAdmin(req, res)) return

  const from = String(req.query.from || '')
  const to = String(req.query.to || '')

  let formula: string
  if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    // Overlap with [from, to]: arrival <= to AND departure >= from.
    formula = `AND(NOT(IS_AFTER({ArrivalDate}, '${to}')), NOT(IS_BEFORE({Departure date}, '${from}')))`
  } else {
    formula =
      "OR(IS_AFTER({Departure date}, DATEADD(TODAY(), -14, 'days'))," +
      "IS_AFTER({ArrivalDate}, DATEADD(TODAY(), -14, 'days')))"
  }

  try {
    const table = getStorageTable()
    const records = await table
      .select({
        filterByFormula: formula,
        returnFieldsByFieldId: true,
        maxRecords: 2000,
        sort: [{ field: 'Departure date', direction: 'asc' }],
      })
      .all()

    const bookings = records.map((r) => normalize({ id: r.id, fields: r.fields as any }))
    return res.status(200).json({ ok: true, count: bookings.length, bookings })
  } catch (err) {
    console.error('[storage-ops/list] failed:', err)
    return res.status(500).json({ message: (err as Error).message || 'List failed' })
  }
}
