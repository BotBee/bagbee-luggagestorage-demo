import { NextApiRequest, NextApiResponse } from 'next'
import { PARTNERS, isPartnerId, requirePartner } from '../../../../../utils/partnerAuth'
import {
  computeKpis,
  createPartnerOrder,
  listPartnerOrders,
  NewOrderInput,
} from '../../../../../utils/partnerOrders'
import { sendNewOrderApprovalNotice } from '../../../../../utils/partnerNotifications'
import { normalizePhone } from '../../../../../utils/phoneNormalize'

// nudge HMR


const VALID_SERVICE_TYPES: NewOrderInput['serviceType'][] = [
  'Check-in service',
  'Arrival service',
  'Pickup & Delivery',
  'Pickup',
  'Delivery',
  'Pickup from KEF',
  'Delivery from storage',
  'BSI to Hotel Delivery',
  'Task',
]

const isYmd = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

const validateNewOrder = (body: unknown): { ok: true; input: NewOrderInput } | { ok: false; reason: string } => {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'Body required' }
  const b = body as Record<string, unknown>
  const reference = typeof b.reference === 'string' ? b.reference.trim() : ''
  const customerName = typeof b.customerName === 'string' ? b.customerName.trim() : ''
  const email = typeof b.email === 'string' ? b.email.trim() : ''
  const phone = typeof b.phone === 'string' ? b.phone.trim() : ''
  const serviceType = b.serviceType
  const flightDate = b.flightDate
  const pickupDate = b.pickupDate
  const timeWindow = typeof b.timeWindow === 'string' ? b.timeWindow.trim() : ''
  const pickupAddress = typeof b.pickupAddress === 'string' ? b.pickupAddress.trim() : ''
  const bagsRegular = typeof b.bagsRegular === 'number' ? b.bagsRegular : Number(b.bagsRegular)
  const bagsOdd = typeof b.bagsOdd === 'number' ? b.bagsOdd : Number(b.bagsOdd)

  if (!reference) return { ok: false, reason: 'Your reference number is required' }
  if (!email || !email.includes('@')) return { ok: false, reason: 'Valid email required' }
  if (!phone) return { ok: false, reason: 'Phone required' }
  if (typeof serviceType !== 'string' || !VALID_SERVICE_TYPES.includes(serviceType as NewOrderInput['serviceType']))
    return { ok: false, reason: 'Service type invalid' }
  // The form sends `flightDate` = `pickupDate` as a back-compat shim now
  // that we no longer collect flight-side info from partners. Both fields
  // arrive populated with the same date so validation still runs.
  if (!isYmd(pickupDate)) return { ok: false, reason: 'Date of service must be YYYY-MM-DD' }
  if (!isYmd(flightDate)) return { ok: false, reason: 'Date of service must be YYYY-MM-DD' }
  if (!timeWindow) return { ok: false, reason: 'Time window required' }
  if (!pickupAddress) return { ok: false, reason: 'Pickup address required' }
  if (!Number.isFinite(bagsRegular) || bagsRegular < 0)
    return { ok: false, reason: 'Bags (regular) must be a non-negative number' }
  if (!Number.isFinite(bagsOdd) || bagsOdd < 0)
    return { ok: false, reason: 'Bags (odd-size) must be a non-negative number' }
  if (bagsRegular + bagsOdd === 0)
    return { ok: false, reason: 'Order must include at least 1 bag' }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const pd = new Date(`${pickupDate}T00:00:00Z`).getTime()
  if (pd < today.getTime()) return { ok: false, reason: 'Date of service is in the past' }

  return {
    ok: true,
    input: {
      // The customer-name column on the order is fixed to the agency name
      // (see createPartnerOrder); the partner staffer's "group name" entry
      // becomes a comment annotation. If they didn't type a group name we
      // fall back to "—" so the row still maps cleanly.
      customerName: customerName || '—',
      contactName: typeof b.contactName === 'string' ? b.contactName.trim() : undefined,
      reference,
      email,
      // Always normalize to E.164 (+<cc><number>) before writing to
      // Airtable so downstream SMS / dispatch flows get a stable format.
      phone: normalizePhone(phone),
      serviceType: serviceType as NewOrderInput['serviceType'],
      flightDate,
      pickupDate,
      timeWindow,
      pickupAddress,
      deliveryAddress:
        typeof b.deliveryAddress === 'string' ? b.deliveryAddress.trim() || undefined : undefined,
      hotelName:
        typeof b.hotelName === 'string' ? b.hotelName.trim() || undefined : undefined,
      airline: typeof b.airline === 'string' ? b.airline.trim() || undefined : undefined,
      flightNumber:
        typeof b.flightNumber === 'string' ? b.flightNumber.trim() || undefined : undefined,
      destinationCode:
        typeof b.destinationCode === 'string'
          ? b.destinationCode.trim() || undefined
          : undefined,
      bagsRegular,
      bagsOdd,
      estimatedAmount:
        typeof b.estimatedAmount === 'number' && b.estimatedAmount > 0
          ? b.estimatedAmount
          : undefined,
      comment: typeof b.comment === 'string' ? b.comment.trim() || undefined : undefined,
      language:
        b.language === 'en' || b.language === 'is' ? (b.language as 'en' | 'is') : undefined,
    },
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const partnerSlug = req.query.partnerId
  if (!isPartnerId(partnerSlug)) {
    return res.status(404).json({ message: 'Unknown partner' })
  }
  const partnerId = partnerSlug
  if (!requirePartner(req, res, partnerId)) return

  if (req.method === 'GET') {
    try {
      const orders = await listPartnerOrders(partnerId)
      const kpis = computeKpis(orders)
      // Sort newest flight first for the list view.
      orders.sort((a, b) => {
        const at = a.flightDate ? Date.parse(a.flightDate) : 0
        const bt = b.flightDate ? Date.parse(b.flightDate) : 0
        return bt - at
      })
      return res.status(200).json({ orders, kpis })
    } catch (err) {
      console.error('[partner orders GET] failed', err)
      return res.status(500).json({ message: 'Failed to load orders' })
    }
  }

  if (req.method === 'POST') {
    const validation = validateNewOrder(req.body)
    if (!validation.ok) {
      return res.status(400).json({ message: validation.reason })
    }
    try {
      const created = await createPartnerOrder(partnerId, validation.input)
      // IMPORTANT: await the notifier. On Vercel serverless the function is
      // torn down the moment we return — fire-and-forget promises get
      // killed mid-TLS-handshake and the email never actually sends. We
      // accept the 1-2s extra latency in exchange for an email that
      // reliably arrives. The notifier swallows its own errors, so a mail
      // outage still doesn't fail the order create.
      await sendNewOrderApprovalNotice(
        partnerId,
        PARTNERS[partnerId].displayName,
        created,
      )
      return res.status(201).json({ order: created })
    } catch (err) {
      console.error('[partner orders POST] failed', err)
      return res.status(500).json({ message: 'Failed to create order' })
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
