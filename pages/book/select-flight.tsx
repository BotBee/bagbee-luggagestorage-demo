import { useRouter } from 'next/router'
import { FormProvider, useForm } from 'react-hook-form'
import { Customer } from '../../common/types'
import FlightCard from '../../components/flight-card/FlightCard'
import FormLayout from '../../components/form/FormLayout'
import { useBookingStore } from '../../store/store'
import styled from '@emotion/styled'

import { useEffect, useState } from 'react'
import Loader from '../../components/loader/Loader'
import { ApplicationRoutes } from '../../utils/routing'
import { validateStore } from '../../store/validateStore'
import Message from '../../components/message/Message'
import FrowningFace from '../../public/icons/FrowningFace'
import Header from '../../components/header/Header'
import { NextSeo } from 'next-seo'
import is from '../../common/locales/is'
import en from '../../common/locales/en'
import { inIcelandTime } from '../../utils/icelandTime'
import { FlightData } from '../../common/types'

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

const SelectFlight = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const [loading, setLoading] = useState<boolean>(false)
  const [flights, setFlights] = useState<FlightData[]>()
  const bookingState = useBookingStore((state) => state.booking)

  useEffect(() => {
    if (!validateStore(router.asPath, bookingState)) {
      router.push(ApplicationRoutes.pages.book)
    }
  }, [bookingState, router])

  const updateSelectedFlight = useBookingStore((state) => state.updateSelectedFlight)

  const methods = useForm<Customer>({})

  useEffect(() => {
    setFlights(
      bookingState.availableFlights?.filter((flight) => {
        return (
          flight.OriginDestAirportIATA === bookingState.flightInformation.arrivalAirport.iata &&
          flight.AirlineDesc === bookingState.flightInformation.airline.name
        )
      }),
    )

    setLoading(false)
  }, [
    bookingState.availableFlights,
    bookingState.flightInformation.airline.iata,
    bookingState.flightInformation.airline.name,
    bookingState.flightInformation.arrivalAirport.iata,
  ])

  return (
    <>
      {loading ? (
        <Loader text={t.loadingScreen.loadingFlightsText} />
      ) : (
        <>
          {flights?.length === 0 ? (
            <>
              <Header hideNav />
              <ErrorScreenContainer>
                <Message
                  asset={<FrowningFace />}
                  title="No flights found"
                  text="We could not find any flights matching your information. Are you sure you select all the right information?"
                  onClick={() => router.push(ApplicationRoutes.pages.chooseAirline)}
                  buttonText="Back to flight finder"
                />
              </ErrorScreenContainer>
            </>
          ) : (
            <FormProvider {...methods}>
              <NextSeo title="Bagbee | Select your flight" />
              <FormLayout
                title={loading ? null : t.selectFlightStep.title}
                text={loading ? null : t.selectFlightStep.subtitle}
              >
                <FlightGrid>
                  {flights?.map((flight, i) => (
                    <FlightCard
                      onClick={() => {
                        // Hour on the Iceland clock — never the customer's
                        // browser timezone.
                        const date = inIcelandTime(flight.ScheduledDateTime)
                        const isMorningFlight = date.get('hour') < 15
                        updateSelectedFlight({ ...flight, isMorningFlight })
                        router.push(ApplicationRoutes.pages.bagSelection)
                      }}
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

export default SelectFlight
