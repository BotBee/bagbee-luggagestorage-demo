import { useRouter } from 'next/router'
import FormLayout from '../../components/form/FormLayout'
import { useBookingStore } from '../../store/store'
import 'react-datepicker/dist/react-datepicker.css'
import Calendar from '../../components/calendar/Calendar'
import { ApplicationRoutes } from '../../utils/routing'
import { NextSeo } from 'next-seo'
import en from '../../common/locales/en'
import is from '../../common/locales/is'

const ChooseDate = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is

  const updateDepartureDate = useBookingStore((state) => state.updateDepartureDate)

  const onSelectDate = (date: Date | undefined) => {
    // react-day-picker fires onSelect(undefined) when the user clicks the
    // already-selected date (single-mode toggle). Don't navigate in that
    // case — keep them on the calendar so they can pick a real date.
    // The previous version guarded on `bookingState.flightInformation.departureDate`
    // which silently swallowed clicks when persisted state was missing/
    // malformed (the bug that soft-blocked returning customers in prod).
    if (!date) return
    updateDepartureDate(date)
    router.push(ApplicationRoutes.pages.chooseAirline)
  }

  const currentDate = new Date()
  const currentHour = currentDate.getHours()

  // Calculate the minimum and maximum selectable dates based on the current time
  let minDate = null
  if (currentHour < 15) {
    // If it's before 15:00, the user can only select the day after today
    minDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1)
  } else {
    // If it's after 15:00, the user can only select a date two days in advance or later
    minDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 2)
  }

  const currentYear = new Date().getFullYear()

  const disabledDates = [
    new Date(currentYear, 11, 25), // December 24th
    new Date(currentYear, 11, 26), // December 25th
    new Date(currentYear, 0, 1), // January 1st
    new Date(currentYear, 0, 2), // January 2st
    new Date(currentYear + 1, 0, 1), // January 1st, next year
    new Date(currentYear + 1, 0, 2), // January 2st, next year
  ]

  return (
    <FormLayout title={t.departureDateStep.title} text={t.departureDateStep.subtitle}>
      <NextSeo title="Bagbee | Departure date" />
      <Calendar
        onChange={(date) => onSelectDate(date)}
        minDate={minDate}
        disabledDates={disabledDates}
      />
    </FormLayout>
  )
}

export default ChooseDate
