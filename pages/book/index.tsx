import { useRouter } from 'next/router'
import FormLayout from '../../components/form/FormLayout'
import { useBookingStore } from '../../store/store'
import 'react-datepicker/dist/react-datepicker.css'
import Calendar from '../../components/calendar/Calendar'
import { ApplicationRoutes } from '../../utils/routing'
import { NextSeo } from 'next-seo'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import { nowInIceland } from '../../utils/icelandTime'

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

  // The 15:00 cutoff is when the route-planning run happens in ICELAND —
  // judge both the hour and "today" on the Iceland clock, not the
  // customer's browser clock (a US customer at 10am local can be past
  // Iceland's 15:00). minDate is built as a local-midnight calendar Date
  // because that's what the calendar component compares against.
  const icelandNow = nowInIceland()

  // Before Iceland's 15:00: earliest pickup is Iceland's tomorrow.
  // After: two days out, since tomorrow's routes are already planned.
  const minDate = new Date(
    icelandNow.year(),
    icelandNow.month(),
    icelandNow.date() + (icelandNow.hour() < 15 ? 1 : 2),
  )

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
