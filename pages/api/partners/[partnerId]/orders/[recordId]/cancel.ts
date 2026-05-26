import { NextApiRequest, NextApiResponse } from 'next'
import {
  PARTNERS,
  isPartnerId,
  requirePartner,
  verifySession,
} from '../../../../../../utils/partnerAuth'
import {
  cancelPartnerOrder,
  getPartnerOrder,
} from '../../../../../../utils/partnerOrders'
import {
  sendOrderUpdateNotice,
  UpdateDiff,
} from '../../../../../../utils/partnerNotifications'

// Cancel an order from the partner portal.
//
// Auth: same as the regular order PATCH — must be a session for THIS
// partner and the order must be scoped to that partner's agency. The
// scope check lives inside cancelPartnerOrder via getPartnerOrder.
//
// Side effects:
//   1. Sets the Airtable "Update Order" multipleSelects field to
//      ['Cancel & Refund']. The Order Status formula reads that and
//      resolves to "Cancelled". Existing dispatcher-side automations
//      (refund, notify customer, etc.) listen to that same value, so
//      partner-initiated cancels go through the same downstream pipeline
//      as ops-initiated cancels — no parallel code path.
//
//   2. Appends a "Cancelled by <partner> (<staffer>) @ <ts>" line to the
//      order's comment field so ops can see who cancelled.
//
//   3. Emails bagbee@bagbee.is with a single-field diff showing the
//      Order Status flip from <previous> -> Cancelled, plus an
//      invoice-or-not annotation based on how close to pickup time the
//      cancellation happened (24h cutoff).

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const partnerSlug = req.query.partnerId
  if (!isPartnerId(partnerSlug)) {
    return res.status(404).json({ message: 'Unknown partner' })
  }
  const partnerId = partnerSlug
  if (!requirePartner(req, res, partnerId)) return
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const recordId = req.query.recordId
  if (typeof recordId !== 'string' || !/^rec[A-Za-z0-9]{14}$/.test(recordId)) {
    return res.status(400).json({ message: 'Invalid record ID' })
  }

  // `actor` is the partner-staffer name from the form (same as on PATCH).
  // Used in the comment changelog so ops can trace who cancelled.
  const body = (req.body as { actor?: unknown }) || {}
  const actor = typeof body.actor === 'string' ? body.actor.trim() || undefined : undefined

  try {
    // Capture pre-cancel state so the email can show "<previous> -> Cancelled".
    const before = await getPartnerOrder(partnerId, recordId)
    if (!before) {
      return res.status(404).json({ message: 'Order not found' })
    }
    if (before.status === 'Cancelled') {
      // Idempotent: already cancelled, just return the current state.
      return res.status(200).json({ order: before, alreadyCancelled: true })
    }

    const updated = await cancelPartnerOrder(partnerId, recordId, actor)
    if (!updated) {
      return res.status(404).json({ message: 'Order not found after cancel' })
    }

    // Fire the update-diff notification email so bagbee@ sees the cancel
    // alongside the rest of the partner-edit stream. We synthesize a
    // single diff for Order Status to keep the email format consistent
    // with what edits produce, and also note whether the cancel falls
    // inside the 24h invoice cutoff.
    const session = verifySession(req)
    const hoursToPickup = before.pickupDate
      ? (Date.parse(before.pickupDate + 'T00:00:00Z') - Date.now()) / 3600_000
      : null
    const willBeInvoiced = hoursToPickup != null && hoursToPickup < 24

    const diffs: UpdateDiff[] = [
      {
        field: 'serviceType',
        before: before.status || '(unknown)',
        after: 'Cancelled' + (willBeInvoiced ? ' (within 24h — invoiced)' : ' (>24h — no invoice)'),
      },
    ]

    await sendOrderUpdateNotice({
      partner: partnerId,
      partnerDisplayName: PARTNERS[partnerId].displayName,
      actorEmail: session?.email || 'unknown@partner',
      actorName: actor || null,
      order: updated,
      diffs,
    })

    return res.status(200).json({
      order: updated,
      willBeInvoiced,
      hoursToPickup,
    })
  } catch (err) {
    console.error('[partner order CANCEL] failed', err)
    return res.status(500).json({ message: 'Failed to cancel order' })
  }
}
