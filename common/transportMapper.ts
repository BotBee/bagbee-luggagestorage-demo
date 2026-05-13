import {
  PriceBreakdown,
  TransportBooking,
} from './transportTypes'
import { findLocation } from './transportConstants'

// Shape that /api/transport/create accepts. Mirrors the AirtableOrder layout
// used by the regular booking flow so existing infra (the order tracking
// page, the Rapyd webhook, the Payday invoice automation) can read transport
// rows without changes. We deliberately reuse the existing fields rather than
// adding new columns — per design choice 4b, transport-specific metadata
// gets concatenated into `Annað (comment)` with labelled lines so downstream
// dashboards still render cleanly.
export type AirtableTransportOrder = {
  // Customer
  'Nafn viðskiptavinar': string
  Tölvupóstfang: string
  Símanúmer: string
  Kennitala?: string
  // Booking core
  Töskufjöldi_no: number
  'Dagsetning pick-up': string // YYYY/MM/DD
  Tímasetning: string
  Heimilisfang: string
  'Delivery date': string // YYYY/MM/DD
  'Delivery Time-window': string
  'Delivery Address': string
  'Hótel Nafn'?: string
  // Free-text concat with labelled transport metadata
  'Annað (comment)': string
  // KEF-specific (when applicable)
  'Airport code'?: string
  Flugnúmer?: string
  // Payment + status
  Greitt: false
  Greiðslustaða: 'Ógreitt'
  Upphæð: number
  Gengi: 'ISK'
  Málstaðall: string
  // Source identification — lets downstream automations route transport
  // rows separately from check-in rows. The 'Requested service' value
  // 'Pickup & Delivery' is the magic string that flips the /orders/{code}
  // tracking page to the P&D layout (see pages/orders/[orderNo].tsx:913 —
  // `isPickupDelivery = requestedService === 'Pickup & Delivery'`). Don't
  // rename without coordinating with that page.
  Reference: 'Transport'
  'Requested service': 'Pickup & Delivery'
  Tilvísun?: string
}

// Render a leg's location as a human-readable string for `Heimilisfang` /
// `Delivery Address`. Includes the structured info that location implies
// (hotel name, street + zip, flight number, cruise ship) so the dispatch
// team doesn't need to chase down 5 different fields.
const renderLocation = (
  loc: TransportBooking['pickupLocation'],
  address: TransportBooking['pickupAddress'],
  hotelName: string,
  flightNumber: string,
  cruiseShip: string,
): string => {
  if (!loc) return ''
  const meta = findLocation(loc)
  const parts: string[] = [meta?.label.en ?? loc]
  if (meta?.requiresHotelName && hotelName) parts.push(hotelName)
  if (meta?.requiresAddress && address.street) {
    const addr = [address.street, address.zip].filter(Boolean).join(', ')
    if (addr) parts.push(addr)
  }
  if (meta?.requiresCruiseShipName && cruiseShip) parts.push(`Cruise: ${cruiseShip}`)
  if (meta?.requiresFlightNumber && flightNumber) parts.push(`Flight: ${flightNumber}`)
  return parts.join(' — ')
}

// Build the labelled `Annað (comment)` block. Keep one piece of info per
// line with a clear label so the dispatcher can scan it in the Airtable UI.
const renderComments = (booking: TransportBooking, locale: string): string => {
  const lines: string[] = ['[Transport booking]']
  lines.push(`Locale: ${locale}`)
  if (booking.pickupLocation === 'kef-airport') {
    lines.push(`Pickup KEF mode: ${booking.pickupKefMode ?? 'arrival-service'}`)
    if (booking.pickupFlightNumber) lines.push(`Arrival flight: ${booking.pickupFlightNumber}`)
    if (booking.pickupOutsideHours) lines.push('Pickup outside opening hours: YES')
  }
  if (booking.deliveryLocation === 'kef-airport') {
    if (booking.deliveryFlightNumber) lines.push(`Departure flight: ${booking.deliveryFlightNumber}`)
    if (booking.deliveryOutsideHours) lines.push('Delivery outside opening hours: YES')
  }
  if (booking.pickupCruiseShipName) lines.push(`Pickup cruise ship: ${booking.pickupCruiseShipName}`)
  if (booking.deliveryCruiseShipName)
    lines.push(`Delivery cruise ship: ${booking.deliveryCruiseShipName}`)
  if (booking.pickupLeaveAtReception) lines.push('Customer leaves bags at hotel reception (pickup)')
  if (booking.deliveryLeaveAtReception)
    lines.push('BagBee may leave bags at hotel reception (delivery)')
  if (booking.customer.bookingForCompany) lines.push('Booking for a company')
  if (booking.customer.comments?.trim()) {
    lines.push('')
    lines.push('Customer comments:')
    lines.push(booking.customer.comments.trim())
  }
  return lines.join('\n')
}

const toYmd = (iso: string | null): string => {
  if (!iso) return ''
  // Already YYYY-MM-DD; convert dashes to slashes to match the existing
  // Airtable column format used by the check-in flow (`YYYY/MM/DD`).
  return iso.replace(/-/g, '/')
}

export const mapTransportToOrder = (
  booking: TransportBooking,
  breakdown: PriceBreakdown,
  locale: string,
  referrer: string,
): AirtableTransportOrder => {
  const pickupLoc = renderLocation(
    booking.pickupLocation,
    booking.pickupAddress,
    booking.pickupAddress.hotelName,
    booking.pickupFlightNumber,
    booking.pickupCruiseShipName,
  )
  const deliveryLoc = renderLocation(
    booking.deliveryLocation,
    booking.deliveryAddress,
    booking.deliveryAddress.hotelName,
    booking.deliveryFlightNumber,
    booking.deliveryCruiseShipName,
  )

  // Hotel name lands on the same Airtable column for both legs (`Hótel Nafn`).
  // Most bookings only have one hotel — if both legs are hotels we prefer the
  // pickup hotel and the delivery hotel is also embedded in deliveryLoc text.
  const hotelName =
    booking.pickupAddress.hotelName || booking.deliveryAddress.hotelName || undefined

  const order: AirtableTransportOrder = {
    'Nafn viðskiptavinar': booking.customer.name,
    Tölvupóstfang: booking.customer.email,
    Símanúmer: booking.customer.phoneNumber,
    Töskufjöldi_no: booking.bagsCount,
    'Dagsetning pick-up': toYmd(booking.pickupDate),
    Tímasetning: booking.pickupTime ?? '',
    Heimilisfang: pickupLoc,
    'Delivery date': toYmd(booking.deliveryDate),
    'Delivery Time-window': booking.deliveryTime ?? '',
    'Delivery Address': deliveryLoc,
    'Annað (comment)': renderComments(booking, locale),
    Greitt: false,
    Greiðslustaða: 'Ógreitt',
    Upphæð: breakdown.total,
    Gengi: 'ISK',
    Málstaðall: locale,
    Reference: 'Transport',
    'Requested service': 'Pickup & Delivery',
  }

  if (hotelName) order['Hótel Nafn'] = hotelName
  if (booking.customer.bookingForCompany && booking.customer.kennitala) {
    order.Kennitala = booking.customer.kennitala
  }
  if (booking.pickupLocation === 'kef-airport' || booking.deliveryLocation === 'kef-airport') {
    order['Airport code'] = 'KEF'
    // Prefer the relevant flight number; arrival for KEF pickup, departure for KEF delivery
    const flight =
      (booking.pickupLocation === 'kef-airport' && booking.pickupFlightNumber) ||
      (booking.deliveryLocation === 'kef-airport' && booking.deliveryFlightNumber) ||
      ''
    if (flight) order.Flugnúmer = flight
  }
  if (referrer) order.Tilvísun = referrer

  return order
}

// Rapyd payment payload. Mirrors mapToPayment in common/mapper.ts but for
// the transport flow — uses tableType: 'baggage' because transport bookings
// land in the same Nýtt/óflokkað table, which makes the existing webhook
// handler at /api/payment/webhooks mark paid + fire the Payday invoice
// automation for free.
export type TransportRapydPayload = {
  amount: number
  currency: 'ISK'
  country: 'IS'
  language: 'EN'
  merchant_reference_id: 'bagbee'
  complete_payment_url: string
  error_payment_url: string
  complete_checkout_url: string
  cancel_checkout_url: string
  metadata: {
    recordId: string
    tableType: 'baggage'
  }
}

export const mapTransportToPayment = (
  recordId: string,
  totalAmount: number,
  locale: string,
  host: string,
): TransportRapydPayload => {
  // Rapyd rejects localhost URLs entirely (no public hostname). On dev we
  // redirect to the production www.bagbee.is — that domain reads the same
  // Airtable base, so the customer's order shows up on its /orders/{code}
  // page regardless of where the booking was actually submitted from. On
  // a deployed host we stay on the same origin (book.bagbee.is, www.bagbee.is,
  // Vercel preview, etc).
  const isLocalhost = /^(localhost|127\.\d+\.\d+\.\d+)(:\d+)?$/.test(host)
  const base = isLocalhost ? 'https://www.bagbee.is' : `https://${host}`
  const completeUrl = `${base}/${locale}/orders/${recordId.slice(-5)}?paid=true`
  const cancelUrl = `${base}/${locale}/payment/cancel?recordId=${recordId}&type=baggage`
  return {
    amount: totalAmount,
    currency: 'ISK',
    country: 'IS',
    language: 'EN',
    merchant_reference_id: 'bagbee',
    complete_payment_url: completeUrl,
    error_payment_url: cancelUrl,
    // Wallet redirects (Apple Pay / Google Pay) need *_checkout_url to be
    // set explicitly — the 2026-04-30 wallet-redirect incident. The same
    // value works for both.
    complete_checkout_url: completeUrl,
    cancel_checkout_url: cancelUrl,
    metadata: {
      recordId,
      tableType: 'baggage',
    },
  }
}
