import { NextApiRequest, NextApiResponse } from 'next'
import { getFastTrackTable } from '../../../utils/airtable'
import {
  verifyRedirectParams,
  FAST_TRACK_SIGNED_FIELDS,
} from '../../../utils/paymentRedirectSig'

/**
 * Called by Rapyd after a successful Fast-Track payment.
 * Marks the Fast-Track record as paid and redirects the user back to the order page.
 *
 * Signature requirement: the callback URL is built by /api/fast-track/create,
 * which HMAC-signs orderNo + recordId. Without a matching `sig` and unexpired
 * `exp` we refuse — otherwise anyone could mark a pending Fast-Track record
 * paid without paying. See utils/paymentRedirectSig.ts.
 */
// Optimistic mark-paid on the success redirect. The canonical write — including
// the Rapyd Payment ID needed for refunds — happens in the PAYMENT_COMPLETED
// webhook at /api/payment/webhooks, which reads metadata.recordId set in
// /api/fast-track/create.ts. We still flip Greiddi here so the order page
// shows the success state immediately even if the webhook is delayed.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { recordId, orderNo, exp, sig } = req.query as Record<string, string>

  if (!orderNo || !/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.redirect(`/orders?error=true`)
  }

  if (!recordId || !/^rec[a-zA-Z0-9]+$/.test(recordId)) {
    return res.redirect(`/orders/${orderNo}?fast_track_error=true`)
  }

  const verdict = verifyRedirectParams(
    'fast-track',
    FAST_TRACK_SIGNED_FIELDS,
    { orderNo, recordId },
    exp,
    sig
  )
  if (!verdict.ok) {
    console.warn('[fast-track] rejected payment-success callback', {
      orderNo,
      reason: verdict.reason,
    })
    return res.redirect(`/orders/${orderNo}?fast_track_error=true`)
  }

  try {
    const table = getFastTrackTable()
    await table.update(recordId, { Greiddi: true })
    res.redirect(`/orders/${orderNo}?fast_track_paid=true`)
  } catch (error) {
    console.error('Fast-Track payment-success error:', error)
    res.redirect(`/orders/${orderNo}?fast_track_error=true`)
  }
}
