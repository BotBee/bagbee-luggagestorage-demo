import { NextApiRequest, NextApiResponse } from 'next'
import { requirePartner } from '../../../../../../utils/partnerAuth'
import {
  EditableField,
  getPartnerOrder,
  updatePartnerOrder,
} from '../../../../../../utils/partnerOrders'

const PARTNER_ID = 'iceland-travel' as const

const EDITABLE_KEYS: EditableField[] = [
  'reference',
  'bagsRegular',
  'bagsOdd',
  'pickupDate',
  'flightDate',
  'timeWindow',
  'pickupAddress',
  'pickupLatOverride',
  'pickupLngOverride',
  'deliveryAddress',
  'deliveryDate',
  'deliveryTimeWindow',
  'flightNumber',
  'airline',
  'comment',
  'contactName',
  'email',
  'phone',
  'serviceType',
]

const sanitizeChanges = (
  body: unknown
): Partial<Record<EditableField, string | number | null>> => {
  if (!body || typeof body !== 'object') return {}
  const b = body as Record<string, unknown>
  const out: Partial<Record<EditableField, string | number | null>> = {}
  for (const key of EDITABLE_KEYS) {
    if (!(key in b)) continue
    const v = b[key]
    if (key === 'bagsRegular' || key === 'bagsOdd') {
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n) && n >= 0) out[key] = Math.floor(n)
      continue
    }
    if (key === 'pickupLatOverride' || key === 'pickupLngOverride') {
      // Decimal degrees — keep precision; sanity-check bounds (Iceland
      // fits comfortably inside -90..90 / -180..180).
      if (v == null || v === '') {
        out[key] = null
        continue
      }
      const n = typeof v === 'number' ? v : Number(v)
      const limit = key === 'pickupLatOverride' ? 90 : 180
      if (Number.isFinite(n) && Math.abs(n) <= limit) out[key] = n
      continue
    }
    if (v == null) {
      out[key] = null
    } else if (typeof v === 'string') {
      out[key] = v
    }
  }
  return out
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requirePartner(req, res, PARTNER_ID)) return

  const recordId = req.query.recordId
  if (typeof recordId !== 'string' || !/^rec[A-Za-z0-9]{14}$/.test(recordId)) {
    return res.status(400).json({ message: 'Invalid record ID' })
  }

  if (req.method === 'GET') {
    try {
      const order = await getPartnerOrder(PARTNER_ID, recordId)
      if (!order) return res.status(404).json({ message: 'Order not found' })
      return res.status(200).json({ order })
    } catch (err) {
      console.error('[partner order GET] failed', err)
      return res.status(500).json({ message: 'Failed to load order' })
    }
  }

  if (req.method === 'PATCH') {
    const body = (req.body as { changes?: unknown; actor?: unknown }) || {}
    const changes = sanitizeChanges(body.changes)
    const actor = typeof body.actor === 'string' ? body.actor.trim() || undefined : undefined
    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ message: 'No editable changes supplied' })
    }
    try {
      const updated = await updatePartnerOrder(PARTNER_ID, recordId, changes, actor)
      if (!updated) return res.status(404).json({ message: 'Order not found' })
      return res.status(200).json({ order: updated })
    } catch (err) {
      console.error('[partner order PATCH] failed', err)
      return res.status(500).json({ message: 'Failed to update order' })
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
