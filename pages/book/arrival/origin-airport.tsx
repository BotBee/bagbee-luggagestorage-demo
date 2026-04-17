import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

import AirportCard from '../../../components/airport-card/AirportCard'
import FormLayout from '../../../components/form/FormLayout'
import TextInput from '../../../components/form/text-input/TextInput'
import InfoText from '../../../components/info-text/InfoText'
import Loader from '../../../components/loader/Loader'
import { AirportCollection } from '../../../constants/AirportCollection'
import { useBookingStore } from '../../../store/store'
import styled from '@emotion/styled'

import { ApplicationRoutes } from '../../../utils/routing'
import { FlightWithAirport } from '../../../common/types'

const StyledInfoText = styled(InfoText)`
  margin-bottom: 24px;
`

const AirportCardGrid = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 32px;
  margin-bottom: 50px;
`

const ArrivalOriginAirport = () => {
  const router = useRouter()
  const bookingState = useBookingStore((state) => state.booking)

  const updateArrivalDepartureAirport = useBookingStore(
    (state) => state.updateArrivalDepartureAirport
  )
  const [routes, setRoutes] = useState<FlightWithAirport[]>()
  const [searchInput, setSearchInput] = useState<string>('')

  useEffect(() => {
    const availableRoutes = bookingState.arrivalAvailableFlights?.filter(
      (x) =>
        x.AirlineDesc ===
        bookingState.arrivalFlightInformation?.airline.name
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
    bookingState.arrivalAvailableFlights?.length,
    bookingState.arrivalFlightInformation?.airline.iata,
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

  return (
    <>
      {!routes ? (
        <Loader text='Fetching airports..' />
      ) : (
        <FormLayout
          title='Where are you coming from?'
          text='Select your departure airport'
        >
          <NextSeo title='Bagbee | Select origin airport' />
          <StyledInfoText>
            Select the airport you are departing from
          </StyledInfoText>
          <TextInput
            placeholder='Search for an airport'
            onChange={handleSearchInput}
            value={searchInput}
          />
          <AirportCardGrid>
            {filteredArray?.map((isaviaFlight: FlightWithAirport) => {
              return (
                <AirportCard
                  selected={
                    isaviaFlight.OriginDestAirportIATA ===
                    bookingState.arrivalFlightInformation?.departureAirport
                      .name
                  }
                  key={isaviaFlight.AODBFlightId}
                  airport={{
                    iata: isaviaFlight.OriginDestAirportIATA,
                    name: isaviaFlight.name,
                    city: isaviaFlight.city,
                    countryCode: isaviaFlight.countryCode,
                  }}
                  onClick={() => {
                    updateArrivalDepartureAirport({
                      iata: isaviaFlight.OriginDestAirportIATA,
                      name: isaviaFlight.name,
                      city: isaviaFlight.city,
                      countryCode: isaviaFlight.countryCode,
                    })
                    router.push(ApplicationRoutes.arrival.selectFlight)
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

export default ArrivalOriginAirport
