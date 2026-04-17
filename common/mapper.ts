import dayjs from 'dayjs'
import { discountPrice } from '../utils/pricing'
import { AirtableOrder, Booking, RapydPaymentObject } from './types'

export const mapToPayment = (
  recordId: string,
  booking: Booking,
  locale: string
): RapydPaymentObject => ({
  amount: discountPrice(
    booking.checkoutPrice.amount,
    booking.customerInfo.discountCode?.discount || 0
  ),
  currency: booking.checkoutPrice.currency,
  country: 'IS',
  language: 'EN',
  merchant_reference_id: 'bagbee',
  /**
   * TODO: I hardcoded the callback urls to production. Move to vercel config later.
   */
  complete_payment_url: `https://bagbee.is/${locale}/payment/success?recordId=${recordId}`,
  error_payment_url: `https://bagbee.is/${locale}/payment/cancel`,
})

export const mapToOrder = (
  bookingState: Booking,
  locale: string,
  referrer: string
): AirtableOrder => ({
  'Nafn viðskiptavinar': bookingState.customerInfo.name,
  Flugfélag: bookingState.flightInformation.airline.name,
  'Dagsetning flugs': dayjs(
    bookingState.flightInformation.departureDate
  ).format('YYYY/MM/DD'),
  'Dagsetning pick-up': dayjs(bookingState.pickupInformation.pickupDate).format(
    'YYYY/MM/DD'
  ),
  Málstaðall: locale,
  Símanúmer: bookingState.customerInfo.phoneNumber,
  Flugnúmer:
    bookingState.flightInformation?.selectedFlight?.AirlineIATA! +
      bookingState.flightInformation?.selectedFlight?.FlightNumber.replace(
        /^0/,
        ''
      ) || '',
  Tímasetning: bookingState.pickupInformation.pickupSlot,
  Heimilisfang: bookingState.pickupInformation.pickupLocation,
  'Delivery Address': bookingState.pickupInformation.deliveryAddress,
  'Annað (comment)': bookingState.pickupInformation.comments,
  'Hótel Nafn': bookingState.pickupInformation.hotelName,
  Tölvupóstfang: bookingState.customerInfo.email,
  Töskufjöldi_no: bookingState.baggageInformation.baggage.amount,
  Töskufjöldi_no_yfirstærð:
    bookingState.baggageInformation.baggage.oddSizeAmount,
  Áfangastaður: bookingState.flightInformation.arrivalAirport.name,
  Kennitala: bookingState.customerInfo.companyId,
  Greitt: false,
  Greiðslustaða: 'Ógreitt',
  Upphæð: discountPrice(
    bookingState.checkoutPrice.amount,
    bookingState.customerInfo.discountCode?.discount || 0
  ),
  Gengi: bookingState.checkoutPrice.currency,
  Tilvísun: referrer,
  'Discount Code': bookingState.customerInfo.discountCode?.code,
})

export const mapToArrivalOrder = (
  bookingState: Booking,
  locale: string,
  referrer: string
): AirtableOrder => ({
  'Nafn viðskiptavinar': bookingState.customerInfo.name,
  Flugfélag: bookingState.arrivalFlightInformation?.airline.name || '',
  'Dagsetning flugs': dayjs(
    bookingState.arrivalFlightInformation?.departureDate
  ).format('YYYY/MM/DD'),
  'Dagsetning pick-up': dayjs(
    bookingState.arrivalFlightInformation?.departureDate
  ).format('YYYY/MM/DD'),
  Málstaðall: locale,
  Símanúmer: bookingState.customerInfo.phoneNumber,
  Flugnúmer:
    (bookingState.arrivalFlightInformation?.selectedFlight?.AirlineIATA || '') +
    (bookingState.arrivalFlightInformation?.selectedFlight?.FlightNumber?.replace(
      /^0/,
      ''
    ) || ''),
  Tímasetning: bookingState.arrivalInfo?.deliverySlot || '',
  Heimilisfang: bookingState.arrivalInfo?.deliveryAddress || '',
  'Delivery Address': bookingState.arrivalInfo?.deliveryAddress || '',
  'Annað (comment)':
    `[ARRIVAL SERVICE] Meeting: ${bookingState.arrivalInfo?.meetingPoint === 'customs_gate' ? 'Customs gate' : 'Luggage truck'}. ${bookingState.arrivalInfo?.comments || ''}`,
  'Hótel Nafn': bookingState.arrivalInfo?.deliveryHotelName || '',
  Tölvupóstfang: bookingState.customerInfo.email,
  Töskufjöldi_no: bookingState.arrivalBaggageInformation?.baggage.amount || 0,
  Töskufjöldi_no_yfirstærð:
    bookingState.arrivalBaggageInformation?.baggage.oddSizeAmount || 0,
  Áfangastaður:
    bookingState.arrivalFlightInformation?.departureAirport.name || '',
  Kennitala: bookingState.customerInfo.companyId,
  Greitt: false,
  Greiðslustaða: 'Ógreitt',
  Upphæð: discountPrice(
    bookingState.arrivalCheckoutPrice?.amount || 0,
    bookingState.customerInfo.discountCode?.discount || 0
  ),
  Gengi: bookingState.arrivalCheckoutPrice?.currency || 'ISK',
  Tilvísun: referrer,
  'Discount Code': bookingState.customerInfo.discountCode?.code,
})
