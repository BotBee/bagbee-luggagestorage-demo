/**
 * POST /api/kef/[id]/cancel — cancel a KEF bike-box order (all per-box rows),
 * revoke any issued TTLock PINs, and refund per policy: full refund 24h+ before
 * drop-off; inside 24h the booking is cancelled with NO refund.
 */
import { NextApiRequest, NextApiResponse } from 'next'
import getAppConfig from '../../../../modules/config'
import { partialRefund } from '../../../../utils/rapydRefund'
import {
  findKefBooking,
  loadOrderRows,
  revokePinsForRows,
  updateKefRows,
} from '../../../../utils/kefBooking'
import { FLD } from '../../../../utils/kefLockersAirtable'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { id } = req.query as { id?: string }
  if (!id || typeof id !== 'string') return res.status(400).json({ message: 'Missing booking id' })

  const {
    publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
  } = getAppConfig()

  try {
    const lead = await findKefBooking(id)
    if (!lead) return res.status(404).json({ message: 'Booking not found' })
    const lf = lead.fields as Record<string, any>
    const status = (lf[FLD.bookings.paymentStatus] as string) || 'Pending'
    if (status === 'Cancelled') return res.status(200).json({ status: 'Cancelled' })
    if (status === 'Refunded') return res.status(200).json({ status: 'Refunded', refunded: true })

    const checkoutId = lf[FLD.bookings.rapydCheckoutId] as string | undefined
    const rows = checkoutId ? await loadOrderRows(checkoutId) : [lead]
    const ids = rows.map((r) => r.id)
    const total = rows.reduce((s, r) => s + (Number((r.fields as any)[FLD.bookings.amount]) || 0), 0)
    const paymentId = lf[FLD.bookings.rapydPaymentId] as string | undefined

    const checkInMs = Date.parse(String(lf[FLD.bookings.checkInDatetime] || ''))
    const hoursUntil = isNaN(checkInMs) ? null : (checkInMs - Date.now()) / 3_600_000

    // Always revoke any live PINs.
    await revokePinsForRows(rows)

    if (status === 'Paid') {
      const lateCancel = hoursUntil !== null && hoursUntil < 24
      if (!lateCancel && paymentId && total > 0) {
        try {
          await partialRefund(paymentId, total, rapydBaseUrl as string, rapydAccessKey as string)
        } catch (err) {
          console.error('[KEF cancel] refund failed:', err)
          return res.status(502).json({ message: 'Refund failed — booking unchanged' })
        }
        await updateKefRows(ids, {
          [FLD.bookings.paymentStatus]: 'Refunded',
          [FLD.bookings.cancelled]: true,
          [FLD.bookings.paid]: false,
          [FLD.bookings.syncStatus]: 'Revoked',
        })
        return res.status(200).json({ status: 'Refunded', refunded: true })
      }
      // Within 24h, or no payment id on file → cancel without refund.
      await updateKefRows(ids, {
        [FLD.bookings.paymentStatus]: 'Cancelled',
        [FLD.bookings.cancelled]: true,
        [FLD.bookings.paid]: false,
        [FLD.bookings.syncStatus]: 'Revoked',
      })
      return res.status(200).json({ status: 'Cancelled', refunded: false, lateCancel })
    }

    // Pending (unpaid) → just cancel.
    await updateKefRows(ids, {
      [FLD.bookings.paymentStatus]: 'Cancelled',
      [FLD.bookings.cancelled]: true,
      [FLD.bookings.syncStatus]: 'Revoked',
    })
    return res.status(200).json({ status: 'Cancelled', refunded: false })
  } catch (err) {
    console.error('[KEF cancel] failed:', err)
    return res.status(500).json({ message: 'Cancel failed' })
  }
}
