/**
 * Staff dashboard — update an individual BSI Storage booking.
 *
 * Body: { id: string, updates: { <writableKey>: value, ... } }
 * Only fields in the WRITABLE whitelist (utils/storageOps) are accepted; each
 * is coerced server-side (booleans stay booleans, singleSelects are validated
 * against the allowed options) so no typecast is needed and the client can't
 * write arbitrary fields.
 *
 * Guarded by the shared DISPATCH_ADMIN_KEY.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import type { FieldSet } from 'airtable'
import { requireAdmin } from '../../../utils/dispatch/auth'
import { getStorageTable, WRITABLE } from '../../../utils/storageOps'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })
  if (!requireAdmin(req, res)) return

  const { id, updates } = req.body as { id?: string; updates?: Record<string, unknown> }
  if (!id || typeof id !== 'string') return res.status(400).json({ message: 'Missing id' })
  if (!updates || typeof updates !== 'object') return res.status(400).json({ message: 'Missing updates' })

  const fields: Record<string, unknown> = {}
  const applied: string[] = []
  for (const [key, value] of Object.entries(updates)) {
    const w = WRITABLE[key]
    if (!w) continue
    fields[w.field] = w.coerce(value)
    applied.push(key)
  }
  if (applied.length === 0) return res.status(400).json({ message: 'No writable fields in update' })

  try {
    const table = getStorageTable()
    await table.update(id, fields as FieldSet)
    return res.status(200).json({ ok: true, id, applied })
  } catch (err) {
    console.error('[storage-ops/update] failed:', err)
    return res.status(500).json({ message: (err as Error).message || 'Update failed' })
  }
}
