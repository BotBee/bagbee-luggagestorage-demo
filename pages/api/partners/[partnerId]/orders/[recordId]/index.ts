import { NextApiRequest, NextApiResponse } from 'next'
import {
  PARTNERS,
  isPartnerId,
  requirePartner,
  verifySession,
} from '../../../../../../utils/partnerAuth'
import {
  EditableField,
  getPartnerOrder,
  updatePartnerOrder,
} from '../../../../../../utils/partnerOrders'
import {
  sendOrderUpdateNotice,
  UpdateDiff,
} from '../../../../../../utils/partnerNotifications'
import { normalizePhone } from '../../../../../../utils/phoneNormalize'
import { normalizeTimeWindow } from '../../../../../../utils/timeWindow'

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
  'deliveryLatOverride',
  'deliveryLngOverride',
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
    if (
      key === 'pickupLatOverride' ||
      key === 'pickupLngOverride' ||
      key === 'deliveryLatOverride' ||
      key === 'deliveryLngOverride'
    ) {
      // Decimal degrees — keep precision; sanity-check bounds (Iceland
      // fits comfortably inside -90..90 / -180..180).
      if (v == null || v === '') {
        out[key] = null
        continue
      }
      const n = typeof v === 'number' ? v : Number(v)
      const isLat = key === 'pickupLatOverride' || key === 'deliveryLatOverride'
      const limit = isLat ? 90 : 180
      if (Number.isFinite(n) && Math.abs(n) <= limit) out[key] = n
      continue
    }
    if (key === 'phone') {
      // Always store phones as E.164 (+<cc><number>) regardless of
      // how the partner typed them — downstream SMS / dispatch flows
      // depend on a stable format. Pass empty in if the field was
      // cleared so we still null it out.
      if (v == null || v === '') {
        out[key] = null
      } else if (typeof v === 'string') {
        out[key] = normalizePhone(v)
      }
      continue
    }
    if (key === 'timeWindow' || key === 'deliveryTimeWindow') {
      // Normalize "11:45" → "11:45 - 12:45" so the Push-to-OR delivery
      // formula gets a non-empty twTo. See utils/timeWindow.ts.
      if (v == null || v === '') {
        out[key] = null
      } else if (typeof v === 'string') {
        out[key] = normalizeTimeWindow(v)
      }
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
  const partnerSlug = req.query.partnerId
  if (!isPartnerId(partnerSlug)) {
    return res.status(404).json({ message: 'Unknown partner' })
  }
  const partnerId = partnerSlug
  if (!requirePartner(req, res, partnerId)) return

  const recordId = req.query.recordId
  if (typeof recordId !== 'string' || !/^rec[A-Za-z0-9]{14}$/.test(recordId)) {
    return res.status(400).json({ message: 'Invalid record ID' })
  }

  if (req.method === 'GET') {
    try {
      const order = await getPartnerOrder(partnerId, recordId)
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
      // Pull the pre-change row so the email diff can show before/after.
      // If this fails, we still let the update proceed — we just send
      // a less informative email (or skip it entirely).
      const before = await getPartnerOrder(partnerId, recordId).catch(
        () => null,
      )
      const updated = await updatePartnerOrder(partnerId, recordId, changes, actor)
      if (!updated) return res.status(404).json({ message: 'Order not found' })

      // Build the diff list from the keys the partner actually submitted.
      // For each changed field we read the pre-change value off the
      // OrderSummary; if `before` is null (rare — a race or Airtable hiccup)
      // we mark the previous value as '(unknown)' so Runar still sees the
      // change happened.
      const diffs: UpdateDiff[] = []
      if (before) {
        const b = before as unknown as Record<string, unknown>
        const a = updated as unknown as Record<string, unknown>
        for (const key of Object.keys(changes) as EditableField[]) {
          const bv = (b[key] ?? null) as string | number | null
          const av = (a[key] ?? null) as string | number | null
          // Treat empty-string == null for diff purposes; partners often
          // toggle between "" and null when clearing a field.
          const norm = (x: string | number | null) =>
            x === '' || x == null ? '' : String(x)
          if (norm(bv) !== norm(av)) {
            diffs.push({ field: key, before: bv, after: av })
          }
        }
      }

      // IMPORTANT: await the notifier — on Vercel serverless, a fire-and-
      // forget promise gets killed mid-TLS-handshake when the function
      // returns, so the email never sends. The notifier swallows its own
      // errors so a mail outage still doesn't fail the update.
      const session = verifySession(req)
      await sendOrderUpdateNotice({
        partner: partnerId,
        partnerDisplayName: PARTNERS[partnerId].displayName,
        actorEmail: session?.email || 'unknown@partner',
        actorName: actor || null,
        order: updated,
        diffs,
      })

      return res.status(200).json({ order: updated })
    } catch (err) {
      console.error('[partner order PATCH] failed', err)
      return res.status(500).json({ message: 'Failed to update order' })
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
