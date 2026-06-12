import styled from '@emotion/styled'
import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import { NextSeo } from 'next-seo'
import { useEffect } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { airlines } from '../../common/airlines'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import type { Airline } from '../../common/types'
import AirlineCard from '../../components/airline-card/AirlineCard'
import FormLayout from '../../components/form/FormLayout'
import { getFlights } from '../../modules/isaviaAPI/api'
import IcelandairLogo from '../../public/icons/IcelandairLogo'
import NeosLogo from '../../public/icons/NeosLogo'
import { useBookingStore } from '../../store/store'

import { ApplicationRoutes } from '../../utils/routing'

const AirlineCardGrid = styled.div`
  display: grid;
  gap: 24px;
  margin-bottom: 50px;
`

const ChooseAirline = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const bookingState = useBookingStore((state) => state.booking)
  const updateAirline = useBookingStore((state) => state.updateAirline)
  const updateAvailableFlights = useBookingStore((state) => state.updateAvailableFlights)

  useEffect(() => {
    const departureDate = dayjs(bookingState.flightInformation.departureDate).format('YYYY-MM-DD')
    getFlights(departureDate).then((res) => {
      updateAvailableFlights(res)
    })
  }, [bookingState.flightInformation.departureDate, updateAvailableFlights])

  const methods = useForm<Airline>({
    defaultValues: {
      name: bookingState.flightInformation.airline.name || '',
      callSign: bookingState.flightInformation.airline.callSign || '',
      iata: bookingState.flightInformation.airline.iata || '',
      icao: bookingState.flightInformation.airline.icao || '',
    },
  })

  const { setValue } = methods

  const handleSelect = (airline: Airline) => {
    setValue('name', airline.name)
    setValue('callSign', airline.callSign)
    setValue('icao', airline.icao)
    setValue('iata', airline.iata)
    updateAirline(airline)
    router.push(ApplicationRoutes.pages.arrivalAirport)
  }

  return (
    <>
      <FormProvider {...methods}>
        <NextSeo title="Bagbee | Select an airline" />
        <FormLayout title={t.airlineStep.title} text={t.airlineStep.subtitle}>
          <AirlineCardGrid>
            <AirlineCard
              icon={<IcelandairLogo />}
              onClick={() => handleSelect(airlines.icelandAir)}
            />
            <AirlineCard
              icon={<NeosLogo />}
              onClick={() => handleSelect(airlines.neos)}
            />
          </AirlineCardGrid>
        </FormLayout>
      </FormProvider>
    </>
  )
}

export default ChooseAirline
