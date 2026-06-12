import { Booking, FastTrackBooking } from '../common/types'

declare global {
  interface Window {
    dataLayer?: any[]
  }
}

const PURCHASE_BRIDGE_KEY = 'bagbee_pending_purchase'
const PURCHASE_FIRED_PREFIX = 'bagbee_purchase_fired_'

export type Item = {
  item_id: string
  item_name: string
  item_category: string
  price: number
  quantity: number
}

export type Service = 'check-in' | 'fast-track'

const push = (event: object) => {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  // Clear previous ecommerce object so values don't leak between events
  window.dataLayer.push({ ecommerce: null })
  window.dataLayer.push(event)
}

export const buildCheckinItems = (booking: Booking): Item[] => {
  const bags = booking.baggageInformation.baggage.amount
  const odd = booking.baggageInformation.baggage.oddSizeAmount
  const total = booking.checkoutPrice.amount
  const totalQty = bags + odd
  if (totalQty === 0 || total === 0) return []

  // Distribute the order total proportionally so price * quantity sums back to value.
  // Pricing is non-linear (first-bag flat fee + extras), so per-item averages keep GA4 happy.
  const unit = Math.round(total / totalQty)
  const items: Item[] = []
  if (bags > 0) {
    items.push({
      item_id: 'standard-bag',
      item_name: 'Standard bag pickup',
      item_category: 'Check-in',
      price: unit,
      quantity: bags,
    })
  }
  if (odd > 0) {
    items.push({
      item_id: 'odd-size-bag',
      item_name: 'Odd-size bag pickup',
      item_category: 'Check-in',
      price: unit,
      quantity: odd,
    })
  }
  return items
}

export const buildFastTrackItems = (ft: FastTrackBooking): Item[] => {
  const pax = ft.passengers?.length || 0
  if (pax === 0) return []
  return [
    {
      item_id: 'fast-track',
      item_name: 'Fast-Track service',
      item_category: 'Fast-Track',
      price: 2490,
      quantity: pax,
    },
  ]
}

export const trackBeginCheckout = (
  value: number,
  items: Item[],
  coupon?: string,
) => {
  push({
    event: 'begin_checkout',
    ecommerce: {
      currency: 'ISK',
      value,
      ...(coupon ? { coupon } : {}),
      items,
    },
  })
}

export const trackAddShippingInfo = (
  value: number,
  items: Item[],
  shipping_tier: string,
  coupon?: string,
) => {
  push({
    event: 'add_shipping_info',
    ecommerce: {
      currency: 'ISK',
      value,
      shipping_tier,
      ...(coupon ? { coupon } : {}),
      items,
    },
  })
}

export const trackAddPaymentInfo = (
  value: number,
  items: Item[],
  coupon?: string,
  payment_type: string = 'rapyd',
) => {
  push({
    event: 'add_payment_info',
    ecommerce: {
      currency: 'ISK',
      value,
      payment_type,
      ...(coupon ? { coupon } : {}),
      items,
    },
  })
}

export type PendingPurchase = {
  service: Service
  value: number
  items: Item[]
  coupon?: string
}

export const stashPendingPurchase = (data: PendingPurchase) => {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(PURCHASE_BRIDGE_KEY, JSON.stringify(data))
  } catch {}
}

const readPendingPurchase = (): PendingPurchase | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PURCHASE_BRIDGE_KEY)
    return raw ? (JSON.parse(raw) as PendingPurchase) : null
  } catch {
    return null
  }
}

export const trackPurchase = (
  transactionId: string,
  fallback?: Partial<PendingPurchase>,
) => {
  if (typeof window === 'undefined' || !transactionId) return

  const firedKey = PURCHASE_FIRED_PREFIX + transactionId
  try {
    if (sessionStorage.getItem(firedKey)) return
  } catch {}

  const pending = readPendingPurchase()
  const value = fallback?.value ?? pending?.value
  const items = fallback?.items ?? pending?.items ?? []
  const coupon = fallback?.coupon ?? pending?.coupon

  if (value == null) return

  push({
    event: 'purchase',
    ecommerce: {
      currency: 'ISK',
      transaction_id: transactionId,
      value,
      ...(coupon ? { coupon } : {}),
      items,
    },
  })

  try {
    sessionStorage.setItem(firedKey, '1')
    sessionStorage.removeItem(PURCHASE_BRIDGE_KEY)
  } catch {}
}
