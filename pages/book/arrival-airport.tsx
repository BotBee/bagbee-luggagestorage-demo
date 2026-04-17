import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import en from '../../common/locales/en'
import is from '../../common/locales/is'

import AirportCard from '../../components/airport-card/AirportCard'
import FormLayout from '../../components/form/FormLayout'
import TextInput from '../../components/form/text-input/TextInput'
import InfoText from '../../components/info-text/InfoText'
import Loader from '../../components/loader/Loader'
import { AirportCollection } from '../../constants/AirportCollection'
import { useBookingStore } from '../../store/store'
import { validateStore } from '../../store/validateStore'
import styled from '@emotion/styled'

import { ApplicationRoutes } from '../../utils/routing'
import { FlightWithAirport } from '../../common/types'

const StyledInfoText = styled(InfoText)`
  margin-bottom: 24px;
`

const AirportCardGrid = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 32px;
  margin-bottom: 50px;
`

const ArrivalAirport = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const bookingState = useBookingStore((state) => state.booking)

  useEffect(() => {
    if (!validateStore(router.asPath, bookingState)) {
      router.push(ApplicationRoutes.pages.book)
    }
  }, [bookingState, router])

  const updateArrivalAirport = useBookingStore(
    (state) => state.updateArrivalAirport
  )
  const [routes, setRoutes] = useState<FlightWithAirport[]>()
  const [searchInput, setSearchInput] = useState<string>('')

  useEffect(() => {
    const availableRoutes = bookingState.availableFlights?.filter(
      (x) => x.AirlineDesc === bookingState.flightInformation.airline.name
    )

    /** Add name, city and country code to airport collection */
    const availableRoutesWithName = availableRoutes?.map((route) => ({
      ...route,
      name:
        AirportCollection.find((y) => y.iata === route.OriginDestAirportIATA)
          ?.name || '',
      city:
        AirportCollection.find((y) => y.iata === route.OriginDestAirportIATA)
          ?.city || '',
      countryCode:
        AirportCollection.find((y) => y.iata === route.OriginDestAirportIATA)
          ?.country || '',
    }))

    /** Get unique airports from airport collection */
    const uniqueAvailableRoutes = availableRoutesWithName
      ?.filter(
        (a, i) =>
          availableRoutesWithName.findIndex(
            (s) => a.OriginDestAirportIATA === s.OriginDestAirportIATA
          ) === i
      )
      /** Sort by airport name ascending */
      .sort((a, b) => (a.name < b.name ? -1 : 1))

    setRoutes(uniqueAvailableRoutes)
  }, [
    bookingState,
    bookingState.availableFlights?.length,
    bookingState.flightInformation.airline.iata,
  ])

  const handleSearchInput = (event: any) => {
    setSearchInput(event.target.value)
  }

  const [filteredArray, setFilteredArray] = useState<
    FlightWithAirport[] | undefined
  >([])

  useEffect(() => {
    setFilteredArray(
      routes?.filter((obj) => {
        if (obj) {
          const sanitized = Object.values(obj).some((val) => {
            if (val)
              return val
                .toString()
                .toLowerCase()
                .includes(searchInput!.toLowerCase())
          })
          return sanitized
        }
      })
    )
  }, [routes, searchInput])

  console.log('Arrival airport booking state', bookingState)
  return (
    <>
      {!routes ? (
        <Loader text='Fetching airports..' />
      ) : (
        <FormLayout title={t.airportStep.title} text={t.airportStep.subtitle}>
          <NextSeo title='Bagbee | Select arrival airport' />
          <StyledInfoText>{t.airportStep.infoContainerText}</StyledInfoText>
          <TextInput
            placeholder={t.airportStep.searchPlaceholder}
            onChange={handleSearchInput}
            value={searchInput}
          />
          <AirportCardGrid>
            {/* TO DO: should rendered a filtered array from search input string */}
            {filteredArray?.map((isaviaFlight: FlightWithAirport) => {
              // Removing all Canada & Israeli airports
              // if (isaviaFlight.countryCode === 'CA') return null
              // if (isaviaFlight.countryCode === 'IL') return null
              // Removing all flights w/ flight number starting FI1 (leiguflug)
              // if (isaviaFlight.No.includes('FI1')) return null

              return (
                <AirportCard
                  selected={
                    isaviaFlight.OriginDestAirportIATA ===
                    bookingState.flightInformation.arrivalAirport.name
                  }
                  key={isaviaFlight.AODBFlightId}
                  airport={{
                    iata: isaviaFlight.OriginDestAirportIATA,
                    name: isaviaFlight.name,
                    city: isaviaFlight.city,
                    countryCode: isaviaFlight.countryCode,
                  }}
                  onClick={() => {
                    updateArrivalAirport({
                      iata: isaviaFlight.OriginDestAirportIATA,
                      name: isaviaFlight.name,
                      city: isaviaFlight.city,
                      countryCode: isaviaFlight.countryCode,
                    })
                    router.push(ApplicationRoutes.pages.selectFlight)
                  }}
                />
              )
            })}
          </AirportCardGrid>
        </FormLayout>
      )}
    </>
  )
}

export default ArrivalAirport
