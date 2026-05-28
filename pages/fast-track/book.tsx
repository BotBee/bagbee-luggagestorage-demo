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

  const { updateFastTrack } = useBookingStore()

  const onSelectDate = (date: Date) => {
    updateFastTrack({ departureDate: date })
    router.push(ApplicationRoutes.pages.fastTrack.chooseAirline)
  }

  return (
    <FormLayout
      title={t.departureDateStep.title}
      text={t.departureDateStep.subtitle}
    >
      <NextSeo title='Bagbee | Departure date' />
      <Calendar onChange={(date) => onSelectDate(date)} minDate={new Date()} />
    </FormLayout>
  )
}

export default ChooseDate
