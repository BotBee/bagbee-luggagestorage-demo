import { useRouter } from 'next/router'
import { FormProvider, useForm } from 'react-hook-form'
import { Customer } from '../../../common/types'
import FlightCard from '../../../components/flight-card/FlightCard'
import FormLayout from '../../../components/form/FormLayout'
import { useBookingStore } from '../../../store/store'
import styled from '@emotion/styled'

import { useEffect, useState } from 'react'
import Loader from '../../../components/loader/Loader'
import { ApplicationRoutes } from '../../../utils/routing'
import Message from '../../../components/message/Message'
import FrowningFace from '../../../public/icons/FrowningFace'
import Header from '../../../components/header/Header'
import { NextSeo } from 'next-seo'
import dayjs from 'dayjs'

import * as timezone from 'dayjs/plugin/timezone'
import * as utc from 'dayjs/plugin/utc'
import * as localizedFormat from 'dayjs/plugin/localizedFormat'
import { FlightData } from '../../../common/types'

const FlightGrid = styled.div`
  display: grid;
  gap: 8px;
  margin-bottom: 50px;
`

const ErrorScreenContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 24px;
  height: calc(100vh - 150px);
  > div {
    margin-bottom: 100px;
  }
`

const ArrivalSelectFlight = () => {
  const router = useRouter()
  const [loading, setLoading] = useState<boolean>(false)
  const [flights, setFlights] = useState<FlightData[]>()
  const bookingState = useBookingStore((state) => state.booking)

  const updateArrivalSelectedFlight = useBookingStore(
    (state) => state.updateArrivalSelectedFlight
  )

  const methods = useForm<Customer>({})

  useEffect(() => {
    setFlights(
      bookingState.arrivalAvailableFlights?.filter((flight) => {
        return (
          flight.OriginDestAirportIATA ===
            bookingState.arrivalFlightInformation?.departureAirport.iata &&
          flight.AirlineDesc ===
            bookingState.arrivalFlightInformation?.airline.name
        )
      })
    )

    setLoading(false)
  }, [
    bookingState.arrivalAvailableFlights,
    bookingState.arrivalFlightInformation?.airline.iata,
    bookingState.arrivalFlightInformation?.airline.name,
    bookingState.arrivalFlightInformation?.departureAirport.iata,
  ])

  // @ts-ignore
  dayjs.extend(utc)
  // @ts-ignore
  dayjs.extend(timezone)
  // @ts-ignore
  dayjs.extend(localizedFormat)

  return (
    <>
      {loading ? (
        <Loader text='Loading flights...' />
      ) : (
        <>
          {flights?.length === 0 ? (
            <>
              <Header hideNav />
              <ErrorScreenContainer>
                <Message
                  asset={<FrowningFace />}
                  title='No flights found'
                  text='We could not find any flights matching your information. Are you sure you selected all the right information?'
                  onClick={() =>
                    router.push(ApplicationRoutes.arrival.chooseAirline)
                  }
                  buttonText='Back to flight finder'
                />
              </ErrorScreenContainer>
            </>
          ) : (
            <FormProvider {...methods}>
              <NextSeo title='Bagbee | Select your arrival flight' />
              <FormLayout
                title={loading ? null : 'Select your arrival flight'}
                text={
                  loading ? null : 'Choose the flight you are arriving on'
                }
              >
                <FlightGrid>
                  {flights?.map((flight, i) => (
                    <FlightCard
                      onClick={() => {
                        let date = dayjs.tz(flight.ScheduledDateTime)
                        const isMorningFlight = date.get('hour') < 15
                        updateArrivalSelectedFlight({
                          ...flight,
                          isMorningFlight,
                        })
                        router.push(ApplicationRoutes.arrival.bagSelection)
                      }}
                      selected={
                        flight.FlightNumber ===
                        bookingState.arrivalFlightInformation?.selectedFlight
                          ?.FlightNumber
                      }
                      key={`${flight.FlightNumber}, ${i}`}
                      flight={flight}
                    />
                  ))}
                </FlightGrid>
              </FormLayout>
            </FormProvider>
          )}
        </>
      )}
    </>
  )
}

export default ArrivalSelectFlight
