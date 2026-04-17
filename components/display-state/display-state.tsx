import { Booking } from '../../common/types'
import { mapCurrencyToDisplay } from '../../utils/pricing'

type DisplayProps = {
  bookingState: Booking
}

const DisplayState = ({ bookingState }: DisplayProps) => (
  <>
    <div>
      <strong>Customer Info</strong>
      <div>{`First Name: ${bookingState.customerInfo.name}`}</div>
      <div>{`Email: ${bookingState.customerInfo.email}`}</div>
      <div>{`Address: ${bookingState.customerInfo.address}`}</div>
      <div>{`Phone Number: ${bookingState.customerInfo.phoneNumber}`}</div>
    </div>
    <div>
      <strong>Pick up Information</strong>
      <div>{`Pick up location: ${bookingState.pickupInformation.pickupLocation}`}</div>
      <div>{`Pick up time: ${bookingState.pickupInformation.pickupSlot}`}</div>
      <div>{`Comments: ${bookingState.pickupInformation.comments}`}</div>
    </div>
    <div>
      <strong>Flight Information</strong>
      <div>{`Airline Name: ${bookingState.flightInformation.airline.name}`}</div>
      <div>{`Departure Airport: ${bookingState.flightInformation.departureAirport.name}`}</div>
      <div>{`Arrival Airport: ${bookingState.flightInformation.arrivalAirport.name}`}</div>
      <div>{`Departure Date: ${bookingState.flightInformation.departureDate}`}</div>
    </div>
    <div>
      <strong>Baggage Information</strong>
      <div>{`Baggage Amount: ${bookingState.baggageInformation.baggage.amount}`}</div>
      <div>{`Oddsize Amount: ${bookingState.baggageInformation.baggage.oddSizeAmount}`}</div>
      <div>{`Checkout price: ${mapCurrencyToDisplay(
        bookingState.checkoutPrice.amount,
        bookingState.checkoutPrice.currency
      )}`}</div>
    </div>
  </>
)

export default DisplayState
