import { useRouter } from 'next/router'
import FormLayout from '../../../components/form/FormLayout'
import { useBookingStore } from '../../../store/store'
import 'react-datepicker/dist/react-datepicker.css'
import Calendar from '../../../components/calendar/Calendar'
import { ApplicationRoutes } from '../../../utils/routing'
import { NextSeo } from 'next-seo'

const ArrivalChooseDate = () => {
  const router = useRouter()
  const bookingState = useBookingStore((state) => state.booking)

  const updateArrivalDepartureDate = useBookingStore(
    (state) => state.updateArrivalDepartureDate
  )

  const onSelectDate = (date: Date) => {
    if (!bookingState.arrivalFlightInformation?.departureDate) {
      return
    }
    updateArrivalDepartureDate(date)
    router.push(ApplicationRoutes.arrival.chooseAirline)
  }

  return (
    <FormLayout
      title='When do you arrive in Iceland?'
      text='Select your arrival date'
    >
      <NextSeo title='Bagbee | Arrival date' />
      <Calendar onChange={(date) => onSelectDate(date)} />
    </FormLayout>
  )
}

export default ArrivalChooseDate
