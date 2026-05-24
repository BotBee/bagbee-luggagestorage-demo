import { NextApiRequest, NextApiResponse } from 'next'
import { requirePartner } from '../../../../../../utils/partnerAuth'
import { getPartnerOrder } from '../../../../../../utils/partnerOrders'
import { computeOrderTracking, OrderTracking } from '../../../../../../utils/driverTracking'

const PARTNER_ID = 'iceland-travel' as const

export type TrackingResponse = {
  orderId: string
  serviceType: string | null
  // Pickup & Delivery uses these; other services use the airport drop.
  pickupAddress: string | null
  deliveryAddress: string | null
  driverName: string | null
  driverPhone: string | null
  tracking: OrderTracking
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requirePartner(req, res, PARTNER_ID)) return
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  const recordId = req.query.recordId
  if (typeof recordId !== 'string' || !/^rec[A-Za-z0-9]{14}$/.test(recordId)) {
    return res.status(400).json({ message: 'Invalid record ID' })
  }
  try {
    const order = await getPartnerOrder(PARTNER_ID, recordId)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    // For airport flights, the "delivery" coord is KEF; for local transfers
    // it's whatever the dispatcher wrote into the Delivery Address field.
    const tracking = await computeOrderTracking({
      orderRecordId: order.id,
      driverRecordId: order.driverRecordId,
      pickupAddress: order.pickupAddress,
      deliveryAddress: order.deliveryAddress,
      // Drag-to-fix override — when set, supersedes the geocoder so the
      // map respects the partner's manual placement (for both ends).
      pickupOverride:
        order.pickupLatOverride != null && order.pickupLngOverride != null
          ? { lat: order.pickupLatOverride, lng: order.pickupLngOverride }
          : null,
      deliveryOverride:
        order.deliveryLatOverride != null && order.deliveryLngOverride != null
          ? { lat: order.deliveryLatOverride, lng: order.deliveryLngOverride }
          : null,
    })
    const body: TrackingResponse = {
      orderId: order.id,
      serviceType: order.serviceType,
      pickupAddress: order.pickupAddress,
      deliveryAddress: order.deliveryAddress,
      driverName: order.driverName,
      driverPhone: order.driverPhone,
      tracking,
    }
    return res.status(200).json(body)
  } catch (err) {
    console.error('[tracking] failed', err)
    return res.status(500).json({ message: 'Failed to load tracking data' })
  }
}
