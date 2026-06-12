/**
 * KEF locker handoff monitor — Vercel cron (every 15 min).
 *
 * Catches the dangerous seam where one customer's box is still in a locker that
 * the next customer needs, BEFORE it becomes a midnight emergency call. For each
 * at-risk handoff (see utils/kefHandoff.ts):
 *   - email the OUTGOING customer to collect their box + alert ops (bagbee@),
 *     flagging it URGENT if their departure flight has already left;
 *   - once the INCOMING customer's arrival flight has landed, email them a
 *     heads-up that their locker may need a few minutes.
 * Idempotent via the "Handoff outgoing/incoming alerted" checkboxes.
 *
 * Protected by CRON_SECRET. Flight status is best-effort (utils/kefFlightStatus).
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { findHandoffs, isAtRisk, loadUpcomingUses } from '../../../utils/kefHandoff'
import { lookupKefFlight } from '../../../utils/kefFlightStatus'
import {
  sendIncomingDelayEmail,
  sendOpsHandoffAlert,
  sendOutgoingEmptyEmail,
} from '../../../utils/kefHandoffMailer'
import { updateKefRows } from '../../../utils/kefBooking'
import { FLD } from '../../../utils/kefLockersAirtable'

export const config = { maxDuration: 60 }

const ymd = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const expected = process.env.CRON_SECRET
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const now = Date.now()
  const summary = { handoffs: 0, atRisk: 0, outgoingAlerts: 0, incomingAlerts: 0, errors: [] as string[] }

  try {
    const uses = await loadUpcomingUses(now)
    const handoffs = findHandoffs(uses)
    summary.handoffs = handoffs.length

    for (const h of handoffs) {
      if (!isAtRisk(h, now)) continue
      summary.atRisk++

      // --- Outgoing: tell them (and ops) to clear the locker ---------------
      if (!h.outgoing.outgoingAlerted) {
        try {
          let departed = false
          if (h.outgoing.flight) {
            const info = await lookupKefFlight(h.outgoing.flight, ymd(h.outgoing.start), 'D')
            departed = !!info?.departed
          }
          await sendOutgoingEmptyEmail({
            to: h.outgoing.email,
            customerName: h.outgoing.customerName,
            lockerName: h.outgoing.lockerName,
            bookingNumber: h.outgoing.bookingNumber,
            incomingStartMs: h.incoming.start,
          })
          await sendOpsHandoffAlert({
            urgent: departed,
            outgoingName: h.outgoing.customerName,
            outgoingBooking: h.outgoing.bookingNumber,
            outgoingEmail: h.outgoing.email,
            departedNote: departed
              ? `Their departure flight ${h.outgoing.flight} has already left — the box was likely left behind.`
              : '',
            lockerName: h.outgoing.lockerName,
            incomingName: h.incoming.customerName,
            incomingBooking: h.incoming.bookingNumber,
            incomingStartMs: h.incoming.start,
          })
          await updateKefRows([h.outgoing.bookingId], {
            [FLD.bookings.handoffOutgoingAlerted]: true,
          })
          summary.outgoingAlerts++
        } catch (e) {
          summary.errors.push(`outgoing ${h.outgoing.bookingId}: ${(e as Error).message}`)
        }
      }

      // --- Incoming: warn them, but only once they've landed ---------------
      if (!h.incoming.incomingAlerted && h.incoming.email) {
        try {
          let landed = now >= h.incoming.start // fallback: their window has started
          if (!landed && h.incoming.flight) {
            const info = await lookupKefFlight(h.incoming.flight, ymd(h.incoming.start), 'A')
            landed = !!info?.arrived
          }
          if (landed) {
            await sendIncomingDelayEmail({
              to: h.incoming.email,
              customerName: h.incoming.customerName,
              lockerName: h.incoming.lockerName,
              bookingNumber: h.incoming.bookingNumber,
            })
            await updateKefRows([h.incoming.bookingId], {
              [FLD.bookings.handoffIncomingAlerted]: true,
            })
            summary.incomingAlerts++
          }
        } catch (e) {
          summary.errors.push(`incoming ${h.incoming.bookingId}: ${(e as Error).message}`)
        }
      }
    }

    return res.status(200).json({ ok: true, summary })
  } catch (err) {
    console.error('[kef-handoff-monitor] failed:', err)
    return res.status(500).json({ error: (err as Error).message, summary })
  }
}
