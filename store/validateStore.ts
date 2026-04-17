import {
  BaggageInformation,
  Booking,
  Customer,
  FlightInformation,
  PickupInformation,
} from '../common/types'
import { ApplicationRoutes } from '../utils/routing'

// The booking flow steps
// 1. Select departure date
// 2. Choose airline
// 3. Choose depature airport
// 4. Select flight
// 5. Bag selection
// 6. Pick up information
// 7. Personal info
// 8. Confirm information
// 9. rapyd
// 10. Success / Error

export const validateStore = (location: string, booking: Booking): boolean => {
  /** Check if state is ok per page.... */
  switch (location) {
    // TO DO: Validate that a departure date selected from the first step before allowing the user to select an airline.

    case ApplicationRoutes.pages.arrivalAirport:
      return checkFlightAirlineInformation(booking.flightInformation)

    case ApplicationRoutes.pages.selectFlight:
      return (
        checkFlightAirlineInformation(booking.flightInformation) &&
        checkFlightArrivalAirportInformation(booking.flightInformation)
      )

    case ApplicationRoutes.pages.bagSelection:
      return (
        checkFlightAirlineInformation(booking.flightInformation) &&
        checkFlightArrivalAirportInformation(booking.flightInformation)
      )

    case ApplicationRoutes.pages.pickUp:
      return (
        checkFlightAirlineInformation(booking.flightInformation) &&
        checkFlightArrivalAirportInformation(booking.flightInformation) &&
        checkBaggageInformation(booking.baggageInformation)
      )

    case ApplicationRoutes.pages.personalInfo:
      return (
        checkFlightAirlineInformation(booking.flightInformation) &&
        checkFlightArrivalAirportInformation(booking.flightInformation) &&
        checkBaggageInformation(booking.baggageInformation) &&
        checkPickupInformation(booking.pickupInformation)
      )
    case ApplicationRoutes.pages.confirmOrder:
      return (
        checkCustomerInfo(booking.customerInfo) &&
        checkFlightAirlineInformation(booking.flightInformation) &&
        checkFlightArrivalAirportInformation(booking.flightInformation) &&
        checkBaggageInformation(booking.baggageInformation) &&
        checkPickupInformation(booking.pickupInformation)
      )

    default:
      return false
  }
}

const checkCustomerInfo = (customerInfo: Customer): boolean => {
  return (
    customerInfo.name !== '' ||
    customerInfo.email !== '' ||
    customerInfo.phoneNumber !== ''
  )
}

const checkPickupInformation = (
  pickupInformation: PickupInformation
): boolean => {
  return (
    pickupInformation.pickupLocation !== '' &&
    pickupInformation.pickupSlot !== ''
  )
}

const checkFlightAirlineInformation = (
  flightInformation: FlightInformation
): boolean => {
  return (
    flightInformation.airline.iata !== '' &&
    flightInformation.airline.name !== '' &&
    flightInformation.airline.icao !== ''
  )
}

const checkFlightArrivalAirportInformation = (
  flightInformation: FlightInformation
): boolean => {
  return (
    flightInformation.arrivalAirport.iata !== '' &&
    flightInformation.arrivalAirport.name !== '' &&
    flightInformation.arrivalAirport.icao !== ''
  )
}

const checkBaggageInformation = (
  baggageInformation: BaggageInformation
): boolean => {
  return (
    baggageInformation.baggage.amount !== 0 ||
    baggageInformation.baggage.oddSizeAmount !== 0
  )
}

// eslint-disable-next-line no-unused-vars
const checkCheckoutPrice = (checkoutPrice: number): boolean => {
  return checkoutPrice !== 0
}
