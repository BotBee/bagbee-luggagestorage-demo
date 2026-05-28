import styled from '@emotion/styled'
import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import { NextSeo } from 'next-seo'
import { useEffect } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { airlines, fastTrackAirlines } from '../../common/airlines'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import type { Airline } from '../../common/types'
import AirlineCard from '../../components/airline-card/AirlineCard'
import FormLayout from '../../components/form/FormLayout'
import { getFlights } from '../../modules/isaviaAPI/api'
import IcelandairLogo from '../../public/icons/IcelandairLogo'
import NeosLogo from '../../public/icons/NeosLogo'
import { useBookingStore } from '../../store/store'
import Image from 'next/image'

import { ApplicationRoutes } from '../../utils/routing'

const AirlineCardGrid = styled.div`
  display: grid;
  gap: 24px;
  margin-bottom: 24px;
`

const AirlineCardGrid3x3 = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  margin-bottom: 50px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    grid-template-columns: repeat(3, 1fr);
  }
  @media ${({ theme }) => theme.breakpoints.laptop} {
    grid-template-columns: repeat(4, 1fr);
  }
`

const OtherAirlineText = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 16px;
  font-weight: 600;
  text-transform: uppercase;
`

const ChooseAirline = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const { fastTrack, updateFastTrack } = useBookingStore()

  useEffect(() => {
    const departureDate = dayjs(fastTrack.departureDate).format('YYYY-MM-DD')
    getFlights(departureDate).then((res) => {
      updateFastTrack({ availableFlights: res })
    })
  }, [fastTrack.departureDate, updateFastTrack])

  const methods = useForm<Airline>({
    defaultValues: {
      name: fastTrack.flightInformation?.airline.name || '',
      callSign: fastTrack.flightInformation?.airline.callSign || '',
      iata: fastTrack.flightInformation?.airline.iata || '',
      icao: fastTrack.flightInformation?.airline.icao || '',
    },
  })

  const { setValue } = methods

  const handleSelect = (airline: Airline) => {
    setValue('name', airline.name)
    setValue('callSign', airline.callSign)
    setValue('icao', airline.icao)
    setValue('iata', airline.iata)
    updateFastTrack({ flightInformation: { ...fastTrack.flightInformation, airline } })
    router.push(ApplicationRoutes.pages.fastTrack.arrivalAirport)
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
            <AirlineCard icon={<NeosLogo />} onClick={() => handleSelect(airlines.neos)} />
          </AirlineCardGrid>
          <AirlineCardGrid3x3>
            {Object.values(fastTrackAirlines).map((airline) => (
              <AirlineCard
                key={airline.iata}
                icon={
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <Image
                      src={`/images/airlines/${airline.iata}.png`}
                      fill
                      alt={airline.name}
                      style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                    />
                  </div>
                }
                onClick={() => handleSelect(airline)}
              />
            ))}
            <AirlineCard
              key="other"
              icon={
                <OtherAirlineText>
                  {t.airlineStep.otherAirline}
                </OtherAirlineText>
              }
              onClick={() => handleSelect({
                name: 'OTHER',
                iata: 'OTHER',
                icao: '',
                callSign: '',
              })}
            />
          </AirlineCardGrid3x3>
        </FormLayout>
      </FormProvider>
    </>
  )
}

export default ChooseAirline
