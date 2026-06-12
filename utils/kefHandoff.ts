/**
 * KEF locker HANDOFF detection — the brain of the Phase 2 monitor.
 *
 * Because a box only sits in the airport locker during its drop-off and pickup
 * WINDOWS (it's stored off-site in between), one physical locker can serve two
 * customers in a day. The risk is the seam between them: an OUTGOING customer
 * has a box waiting in the locker for them to collect (their pickup), and an
 * INCOMING customer needs that same locker next. If the outgoing customer never
 * opens the locker, the incoming one is stranded.
 *
 * This module turns the bookings into a per-locker timeline, finds those
 * outgoing→incoming seams, and decides which are "at risk" right now. The cron
 * (/api/cron/kef-handoff-monitor) does the emailing; this file is pure logic so
 * it's easy to reason about and test.
 *
 * Observable signal: the customer's own PIN unlock. "Pickup opened at" is set by
 * the TTLock webhook the moment the outgoing customer opens the locker — that's
 * our proof the locker was cleared. Empty = not cleared yet.
 */
import { FLD, KEF_BOOKINGS_TABLE, getBase, type BookingRecord } from './kefLockersAirtable'

/** Start worrying this long before the incoming customer needs the locker. */
export const HANDOFF_LEAD_MS = 4 * 60 * 60 * 1000
/** Keep the handoff "active" until this long after the incoming window starts. */
export const HANDOFF_GRACE_MS = 2 * 60 * 60 * 1000
/** Only consider seams within this near horizon. */
export const HANDOFF_HORIZON_MS = 48 * 60 * 60 * 1000

export type Use = {
  bookingId: string
  bookingNumber: string
  customerName: string
  email: string
  lockerId: string
  lockerName: string
  kind: 'dropoff' | 'pickup'
  start: number
  end: number
  /** ISO of the customer's own unlock for this use (drop-off / pickup opened at). */
  openedAt?: string
  /** Relevant flight number — arrival for a drop-off, departure for a pickup. */
  flight?: string
  outgoingAlerted: boolean
  incomingAlerted: boolean
}

export type Handoff = {
  /** A pickup whose box the customer must collect to free the locker. */
  outgoing: Use
  /** The next use on the same locker that needs it cleared. */
  incoming: Use
}

const ms = (iso?: string): number => (iso ? Date.parse(iso) : NaN)

/** Load paid, non-cancelled bike-box bookings and explode into locker "uses". */
export async function loadUpcomingUses(now: number): Promise<Use[]> {
  const base = getBase()
  const rows: BookingRecord[] = []
  await base(KEF_BOOKINGS_TABLE)
    .select({
      filterByFormula: `AND(
        {Payment Status} = 'Paid',
        NOT({Cancelled}),
        NOT({Check-in datetime} = '')
      )`,
      pageSize: 100,
      returnFieldsByFieldId: true,
    })
    .eachPage((page, next) => {
      rows.push(...(page as unknown as BookingRecord[]))
      next()
    })

  const uses: Use[] = []
  const windowLo = now - HANDOFF_GRACE_MS
  const windowHi = now + HANDOFF_HORIZON_MS

  for (const r of rows) {
    const f = r.fields as Record<string, any>
    const common = {
      bookingId: r.id,
      bookingNumber: String(f[FLD.bookings.bookingNumber] || ''),
      customerName: String(f[FLD.bookings.customerName] || ''),
      email: String(f[FLD.bookings.email] || ''),
      outgoingAlerted: !!f[FLD.bookings.handoffOutgoingAlerted],
      incomingAlerted: !!f[FLD.bookings.handoffIncomingAlerted],
    }

    // Drop-off use (always present).
    const dStart = ms(f[FLD.bookings.checkInDatetime])
    const dLocker = (f[FLD.bookings.lockerIn] as string[] | undefined)?.[0]
    if (!isNaN(dStart) && dLocker) {
      const dEnd = ms(f[FLD.bookings.checkInWindowEnd]) || dStart + 3 * 3600000
      if (dStart <= windowHi && dEnd >= windowLo) {
        uses.push({
          ...common,
          lockerId: dLocker,
          lockerName: String(f[FLD.bookings.lockerNameIn] || ''),
          kind: 'dropoff',
          start: dStart,
          end: dEnd,
          openedAt: f[FLD.bookings.dropoffOpenedAt] as string | undefined,
          flight: f[FLD.bookings.arrivalFlight] as string | undefined,
        })
      }
    }

    // Pickup use (KEF return only).
    const pStart = ms(f[FLD.bookings.checkOutDatetime])
    const pLocker = (f[FLD.bookings.lockerOut] as string[] | undefined)?.[0]
    if (!isNaN(pStart) && pLocker) {
      const pEnd = ms(f[FLD.bookings.checkOutWindowEnd]) || pStart + 3 * 3600000
      if (pStart <= windowHi && pEnd >= windowLo) {
        uses.push({
          ...common,
          lockerId: pLocker,
          lockerName: String(f[FLD.bookings.lockerNameOut] || ''),
          kind: 'pickup',
          start: pStart,
          end: pEnd,
          openedAt: f[FLD.bookings.pickupOpenedAt] as string | undefined,
          flight: f[FLD.bookings.departureFlight] as string | undefined,
        })
      }
    }
  }
  return uses
}

/**
 * Pair each OUTGOING pickup with the very next use on the same locker (a
 * different booking). That successor is the one blocked if the box isn't
 * collected.
 */
export function findHandoffs(uses: Use[]): Handoff[] {
  const byLocker = new Map<string, Use[]>()
  for (const u of uses) {
    const arr = byLocker.get(u.lockerId) || []
    arr.push(u)
    byLocker.set(u.lockerId, arr)
  }
  const handoffs: Handoff[] = []
  for (const arr of Array.from(byLocker.values())) {
    arr.sort((a, b) => a.start - b.start)
    for (let i = 0; i < arr.length; i++) {
      const o = arr[i]
      if (o.kind !== 'pickup') continue // only a pickup leaves a box for the customer to collect
      // The next use on this locker belonging to a different booking.
      const incoming = arr
        .slice(i + 1)
        .find((u) => u.bookingId !== o.bookingId && u.start >= o.start)
      if (!incoming) continue
      if (incoming.start - o.end > HANDOFF_HORIZON_MS) continue
      handoffs.push({ outgoing: o, incoming })
    }
  }
  return handoffs
}

/**
 * Is this seam a problem right now? Yes when the outgoing customer hasn't opened
 * the locker AND we're inside the alert window — which opens at the earlier of
 * (their pickup window ending) or (4h before the incoming customer needs it),
 * and closes 2h after the incoming window starts.
 */
export function isAtRisk(h: Handoff, now: number): boolean {
  if (h.outgoing.openedAt) return false // already collected → locker is free
  const alertOpensAt = Math.min(h.outgoing.end, h.incoming.start - HANDOFF_LEAD_MS)
  const alertClosesAt = h.incoming.start + HANDOFF_GRACE_MS
  return now >= alertOpensAt && now < alertClosesAt
}
