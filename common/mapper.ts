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
  complete_payment_url: `https://${window.location.host}/${locale}/payment/success?recordId=${recordId}`,
  // Carry recordId + tableType through to the cancel page so it can offer
  // a one-click "Retry payment" against the same Airtable record without
  // forcing the customer to redo the wizard.
  error_payment_url: `https://${window.location.host}/${locale}/payment/cancel?recordId=${recordId}&type=${tableType}`,
  metadata: {
    recordId,
    tableType,
  },
})

export const mapToOrder = (
  bookingState: Booking,
  locale: string,
  referrer: string,
): AirtableOrder => {
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
