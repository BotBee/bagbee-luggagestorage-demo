import dayjs from 'dayjs'
import { discountPrice } from '../utils/pricing'
import {
  AirtableFastTrackOrder,
  AirtableOrder,
  Booking,
  FastTrackBooking,
  RapydPaymentObject,
} from './types'

export const mapToPayment = (
  recordId: string,
  booking: Booking | FastTrackBooking,
  locale: string,
  tableType: 'baggage' | 'fast-track' = 'baggage'
): RapydPaymentObject => ({
  amount: discountPrice(
    booking.checkoutPrice.amount,
    booking.customerInfo.discountCode?.discount || 0,
  ),
  currency: booking.checkoutPrice.currency,
  country: 'IS',
  language: 'EN',
  merchant_reference_id: 'bagbee',
  // Baggage bookings land on /orders/{5-char}?paid=true — the customer's
  // tracking page that already handles `?paid=true` (success banner +
  // shows full order details). The 5-char code is the last 5 chars of the
  // Airtable recordId, mirroring the `Pöntunarnúmer (fx)` formula. The
  // legacy /payment/success page stays as a fallback for any old links.
  // Fast-Track stays on /payment/success because that flow doesn't have
  // a corresponding /orders/{code} tracking page yet.
  complete_payment_url: tableType === 'baggage'
    ? `https://${window.location.host}/${locale}/orders/${recordId.slice(-5)}?paid=true`
    : `https://${window.location.host}/${locale}/payment/success?recordId=${recordId}`,
  // Carry recordId + tableType through to the cancel page so it can offer
  // a one-click "Retry payment" against the same Airtable record without
  // forcing the customer to redo the wizard.
  error_payment_url: `https://${window.location.host}/${locale}/payment/cancel?recordId=${recordId}&type=${tableType}`,
  metadata: {
    recordId,
    tableType,
  },
})

// Sanity-check the booking state before we write a row to Airtable.
// Returns an array of human-readable problems (empty array = valid).
// Caller can decide whether to throw or surface them in the UI.
//
// This exists because of an incident on 2026-04-29: a customer reached
// confirm-order with a partially-cleared booking store, submitted, and
// `dayjs(undefined)` silently filled in today's date for the missing
// flight/pickup dates — producing an order routed for same-day pickup
// with no name, email, phone, or flight number. The validator is the
// first of three guards (this + server-side + UI pre-flight).
export const validateBookingForOrder = (
  bookingState: Booking,
): string[] => {
  const problems: string[] = []
  const ci = bookingState?.customerInfo
  const fi = bookingState?.flightInformation
  const pi = bookingState?.pickupInformation

  if (!ci?.name || ci.name.trim() === '') problems.push('customer name is missing')
  if (!ci?.email || ci.email.trim() === '') problems.push('customer email is missing')
  if (!ci?.phoneNumber || ci.phoneNumber.trim() === '') {
    problems.push('customer phone number is missing')
  }

  const departureDate = fi?.departureDate
  if (!(departureDate instanceof Date) || isNaN(departureDate.getTime())) {
    problems.push('flight departure date is missing or invalid')
  }
  if (!fi?.airline?.name) problems.push('airline is missing')
  if (!fi?.arrivalAirport?.iata) problems.push('arrival airport is missing')
  if (!fi?.selectedFlight?.FlightNumber) problems.push('flight number is missing')

  const pickupDate = pi?.pickupDate
  if (!(pickupDate instanceof Date) || isNaN(pickupDate.getTime())) {
    problems.push('pickup date is missing or invalid')
  }
  if (!pi?.pickupSlot || String(pi.pickupSlot).trim() === '') {
    problems.push('pickup time slot is missing')
  }
  if (!pi?.pickupLocation || pi.pickupLocation.trim() === '') {
    problems.push('pickup address is missing')
  }

  return problems
}

export const mapToOrder = (
  bookingState: Booking,
  locale: string,
  referrer: string,
): AirtableOrder => {
  const problems = validateBookingForOrder(bookingState)
  if (problems.length > 0) {
    // Fail loud — better to break the booking than to silently write
    // today's date and a half-empty record (see comment on
    // validateBookingForOrder for the incident this guards against).
    throw new Error(`Cannot create order — ${problems.join('; ')}`)
  }

  const is100PercentDiscount = bookingState.customerInfo.discountCode?.discount === 100
  return {
    'Nafn viðskiptavinar': bookingState.customerInfo.name,
    Flugfélag: bookingState.flightInformation.airline.name,
    'Dagsetning flugs': dayjs(bookingState.flightInformation.departureDate).format('YYYY/MM/DD'),
    'Dagsetning pick-up': dayjs(bookingState.pickupInformation.pickupDate).format('YYYY/MM/DD'),
    Málstaðall: locale,
    Símanúmer: bookingState.customerInfo.phoneNumber,
    Flugnúmer:
      bookingState.flightInformation?.selectedFlight?.AirlineIATA! +
        bookingState.flightInformation?.selectedFlight?.FlightNumber.replace(/^0/, '') || '',
    'Airport code': bookingState.flightInformation.arrivalAirport.iata,
    Tímasetning: bookingState.pickupInformation.pickupSlot,
    Heimilisfang: bookingState.pickupInformation.pickupLocation,
    'Delivery Address': bookingState.pickupInformation.deliveryAddress,
    'Annað (comment)': bookingState.pickupInformation.comments,
    'Hótel Nafn': bookingState.pickupInformation.hotelName,
    Tölvupóstfang: bookingState.customerInfo.email,
    Töskufjöldi_no: bookingState.baggageInformation.baggage.amount,
    Töskufjöldi_no_yfirstærð: bookingState.baggageInformation.baggage.oddSizeAmount,
    Áfangastaður: bookingState.flightInformation.arrivalAirport.name,
    Kennitala: bookingState.customerInfo.companyId,
    Greitt: is100PercentDiscount,
    Greiðslustaða: is100PercentDiscount ? 'Greitt' : 'Ógreitt',
    Upphæð: discountPrice(
      bookingState.checkoutPrice.amount,
      bookingState.customerInfo.discountCode?.discount || 0,
    ),
    Gengi: bookingState.checkoutPrice.currency,
    Tilvísun: referrer,
    'Discount Code': bookingState.customerInfo.discountCode?.code,
  }
}

export const mapToFastTrackOrder = (
  state: FastTrackBooking,
  locale: string,
): AirtableFastTrackOrder => {
  const is100PercentDiscount = state.customerInfo.discountCode?.discount === 100
  return {
    'Flight date': dayjs(state.flightInformation.departureDate).format('YYYY/MM/DD'),
    Málstaðall: locale,
    AirlineCode: state.flightInformation.selectedFlight?.AirlineIATA || '',
    FlightNumber: state.flightInformation?.selectedFlight?.FlightNumber.replace(/^0/, '') || '',
    Email: state.customerInfo.email,
    Destination: state.flightInformation.selectedFlight?.OriginDestAirportIATA || '',
    Kennitala: state.customerInfo.companyId,
    Greiddi: is100PercentDiscount,
    Upphæð: discountPrice(
      state.checkoutPrice.amount,
      state.customerInfo.discountCode?.discount || 0,
    ),
    Afsláttarkóði: state.customerInfo.discountCode?.code,
    'Passenger 1 First Name': state.passengers[0]?.firstName || '',
    'Passenger 1 Last Name': state.passengers[0]?.lastName || '',
    'Passenger 2 First Name': state.passengers[1]?.firstName,
    'Passenger 2 Last Name': state.passengers[1]?.lastName,
    'Passenger 3 First Name': state.passengers[2]?.firstName,
    'Passenger 3 Last Name': state.passengers[2]?.lastName,
    'Passenger 4 First Name': state.passengers[3]?.firstName,
    'Passenger 4 Last Name': state.passengers[3]?.lastName,
  }
}
