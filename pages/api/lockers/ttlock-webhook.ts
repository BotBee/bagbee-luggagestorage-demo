import { NextApiRequest, NextApiResponse } from 'next'

/**
 * TTLock webhook receiver — PLACEHOLDER.
 *
 * Purpose right now: return 200 to any request so TTLock's callback-URL
 * validation passes and we can save the URL in the developer portal.
 *
 * TTLock sends unlock records ("lock records") here. When we build the real
 * handler we'll:
 *   1. Verify the request (TTLock signs payloads with clientSecret).
 *   2. Parse the unlock event (lockId, recordType, keyboardPwd, lockDate).
 *   3. Look up the matching booking in Airtable KEF Lockers 2025 by PIN +
 *      lockId + time window.
 *   4. Flip "Drop-off opened at" or "Pickup opened at" on the booking.
 *   5. Append a row to the Access Events table for the audit trail.
 *
 * For now: log whatever arrives so we can see TTLock's actual probe and
 * payload shape, and return 200.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[api][lockers][ttlock-webhook] received', {
    method: req.method,
    query: req.query,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
    },
    body: req.body,
  })

  // TTLock expects a 200 response on validation. Accept everything for now.
  return res.status(200).json({ ok: true })
}
