import dayjs from 'dayjs'
import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { airlines } from '../../../common/airlines'
import { Airline } from '../../../common/types'
import AirlineCard from '../../../components/airline-card/AirlineCard'
import FormLayout from '../../../components/form/FormLayout'
import { getFlights } from '../../../modules/isaviaAPI/api'
import IcelandairLogo from '../../../public/icons/IcelandairLogo'
import NeosLogo from '../../../public/icons/NeosLogo'
import AirCanadaLogo from '../../../public/icons/AirCanadaLogo'
import { useBookingStore } from '../../../store/store'
import styled from '@emotion/styled'

import { ApplicationRoutes } from '../../../utils/routing'

const AirlineCardGrid = styled.div`
  display: grid;
  gap: 24px;
  margin-bottom: 50px;
`

const ArrivalChooseAirline = () => {
  const router = useRouter()
  const bookingState = useBookingStore((state) => state.booking)
  const updateArrivalAirline = useBookingStore(
    (state) => state.updateArrivalAirline
  )
  const updateArrivalAvailableFlights = useBookingStore(
    (state) => state.updateArrivalAvailableFlights
  )

  useEffect(() => {
    const departureDate = dayjs(
      bookingState.arrivalFlightInformation?.departureDate
    ).format('YYYY-MM-DD')
    getFlights(departureDate, 'A').then((res) => {
      updateArrivalAvailableFlights(res)
    })
  }, [
    bookingState.arrivalFlightInformation?.departureDate,
    updateArrivalAvailableFlights,
  ])

  const methods = useForm<Airline>({
    defaultValues: {
      name: bookingState.arrivalFlightInformation?.airline.name || '',
      callSign:
        bookingState.arrivalFlightInformation?.airline.callSign || '',
      iata: bookingState.arrivalFlightInformation?.airline.iata || '',
      icao: bookingState.arrivalFlightInformation?.airline.icao || '',
    },
  })

  const { setValue } = methods

  const handleSelect = (airline: Airline) => {
    setValue('name', airline.name)
    setValue('callSign', airline.callSign)
    setValue('icao', airline.icao)
    setValue('iata', airline.iata)
    updateArrivalAirline(airline)
    router.push(ApplicationRoutes.arrival.originAirport)
  }

  return (
    <>
      <FormProvider {...methods}>
        <NextSeo title='Bagbee | Select an airline' />
        <FormLayout
          title='Which airline are you flying with?'
          text='Select your airline'
        >
          <AirlineCardGrid>
            <AirlineCard
              icon={<IcelandairLogo />}
              selected={
                bookingState.arrivalFlightInformation?.airline.name ===
                airlines.icelandAir.name
              }
              onClick={() => handleSelect(airlines.icelandAir)}
            />
            <AirlineCard
              icon={<NeosLogo />}
              onClick={() => handleSelect(airlines.neos)}
              selected={
                bookingState.arrivalFlightInformation?.airline.name ===
                airlines.neos.name
              }
            />
            <AirlineCard
              icon={<AirCanadaLogo />}
              onClick={() => handleSelect(airlines.airCanada)}
              selected={
                bookingState.arrivalFlightInformation?.airline.name ===
                airlines.airCanada.name
              }
            />
          </AirlineCardGrid>
        </FormLayout>
      </FormProvider>
    </>
  )
}

export default ArrivalChooseAirline
