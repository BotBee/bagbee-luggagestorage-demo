/**
 * GET /api/kef/[id] — fetch a KEF bike-box order by Booking number (or rec id),
 * including all per-box sibling rows. Used by the payment-success + manage pages.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { findKefBooking, loadOrderRows } from '../../../utils/kefBooking'
import { FLD } from '../../../utils/kefLockersAirtable'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const { id } = req.query as { id?: string }
  if (!id || typeof id !== 'string') return res.status(400).json({ message: 'Missing id' })

  try {
    const lead = await findKefBooking(id)
    if (!lead) return res.status(404).json({ message: 'Booking not found' })
    const f = lead.fields as Record<string, any>
    const checkoutId = f[FLD.bookings.rapydCheckoutId] as string | undefined
    const rows = checkoutId ? await loadOrderRows(checkoutId) : [lead]
    const boxes = rows.length || 1
    const total = rows.reduce(
      (s, r) => s + (Number((r.fields as any)[FLD.bookings.amount]) || 0),
      0,
    )
    // Per-box locker access (PIN appears once the cron issues it, ~24h out).
    const lockers = rows.map((r) => {
      const rf = r.fields as Record<string, any>
      return {
        lockerNameIn: rf[FLD.bookings.lockerNameIn] || '',
        pinIn: rf[FLD.bookings.pinIn] || '',
        lockerNameOut: rf[FLD.bookings.lockerNameOut] || '',
        pinOut: rf[FLD.bookings.pinOut] || '',
      }
    })

    return res.status(200).json({
      recordId: lead.id,
      bookingNumber: f[FLD.bookings.bookingNumber] || '',
      paymentStatus: (f[FLD.bookings.paymentStatus] as string) || 'Pending',
      customerName: f[FLD.bookings.customerName] || '',
      email: f[FLD.bookings.email] || '',
      boxes,
      lockers,
      total,
      returnLocation: f[FLD.bookings.returnLocation] || 'KEF airport',
      checkInDatetime: f[FLD.bookings.checkInDatetime] || null,
      checkInWindowEnd: f[FLD.bookings.checkInWindowEnd] || null,
      checkOutDatetime: f[FLD.bookings.checkOutDatetime] || null,
      checkOutWindowEnd: f[FLD.bookings.checkOutWindowEnd] || null,
      arrivalFlight: f[FLD.bookings.arrivalFlight] || '',
      departureFlight: f[FLD.bookings.departureFlight] || '',
    })
  } catch (err) {
    console.error('[KEF get] failed:', err)
    return res.status(500).json({ message: 'Failed to load booking' })
  }
}
