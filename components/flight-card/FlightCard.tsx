import React from 'react'
import Airplane2 from '../../public/icons/Airplane2'
import styled from '@emotion/styled'
import Image from 'next/image'
import dayjs from 'dayjs'
import is from '../../common/locales/is'
import en from '../../common/locales/en'
import { useRouter } from 'next/router'
import * as timezone from 'dayjs/plugin/timezone'
import * as utc from 'dayjs/plugin/utc'
import * as localizedFormat from 'dayjs/plugin/localizedFormat'
import { FlightData } from '../../common/types'
import { allIataCodes } from '../../common/airlines'

interface IFlightCardData extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  flight: FlightData
  onClick: () => void
}

const Container = styled.button`
  width: 100%;
  background: #ffffff;
  &:hover {
    outline: 2px solid #f3ad3c;
  }
  &:focus {
    outline: 2px solid #f3ad3c;
  }
  &:disabled {
    outline: none;
  }
  border-radius: 8px;
  padding: 16px 24px;
  padding-bottom: 24px;
  cursor: pointer;
`

const TopContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #b0bbb8;
  padding-bottom: 12px;
`

const AirlineName = styled.p`
  font-weight: 600;
  font-size: 14px;
  line-height: 14px;
  color: #1d3c34;
`

const MobileFlightNumber = styled.p`
  font-weight: 500;
  font-size: 18px;
  line-height: 24px;
  color: #9ea3ae;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    display: none;
  }
`

const Content = styled.div`
  display: flex;
  justify-content: space-between;
  padding-top: 20px;
`
const Airports = styled.div`
  display: flex;
  gap: 24px;
  align-items: center;
`
const Airport = styled.div`
  display: grid;
  gap: 12px;
  label {
    cursor: pointer;
    font-family: 'Poppins';
    font-style: normal;
    font-weight: 700;
    font-size: 32px;
    line-height: 24px;
    display: flex;
    align-items: center;
    color: #1d3c34;
  }
`

const FlightNumberContainer = styled.div`
  display: none;
  text-align: right;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-end;
  }
`

const Text = styled.p`
  font-weight: 400;
  font-size: 16px;
  line-height: 16px;
  display: flex;
  align-items: center;
  color: #9ea3ae;
`

const FlightNumber = styled.p`
  font-weight: 600;
  font-size: 24px;
  line-height: 24px;
  display: flex;
  align-items: center;
  color: #1d3c34;
`

const FlightCard = ({ flight, onClick }: IFlightCardData) => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is

  // @ts-ignore
  dayjs.extend(utc)
  // @ts-ignore
  dayjs.extend(timezone)
  // @ts-ignore
  dayjs.extend(localizedFormat)

  const formatDate = (date: string) => {
    return dayjs.tz(date).format('DD/MM/YYYY')
  }

  const formatTime = (date: string) => {
    return dayjs.tz(date).format('hh:mm a')
  }

  const airlineLogo = `/images/airlines/${flight.AirlineIATA}.png`

  const flightNumber = flight.AirlineIATA + flight.FlightNumber.replace(/^0/, '')

  return (
    <Container onClick={onClick}>
      <TopContainer>
        {allIataCodes.includes(flight.AirlineIATA || '') ? (
          <div style={{ position: 'relative', width: '100%', height: '25px' }}>
            <Image
              src={airlineLogo}
              fill
              alt={flight.AirlineDesc}
              style={{ objectFit: 'contain', objectPosition: 'left' }}
            />
          </div>
        ) : (
          <AirlineName>{flight.AirlineDesc}</AirlineName>
        )}
        <MobileFlightNumber>{flightNumber}</MobileFlightNumber>
      </TopContainer>
      <Content>
        <Airports>
          <Airport>
            <label>KEF</label>
            <Text>{formatTime(flight.ScheduledDateTime)}</Text>
          </Airport>
          <Airplane2 />
          <Airport>
            <label>{flight.OriginDestAirportIATA}</label>
            <Text>{formatDate(flight.ScheduledDateTime)}</Text>
          </Airport>
        </Airports>
        <FlightNumberContainer>
          <Text>{t.selectFlightStep.flightNumberText}</Text>
          <FlightNumber>{flightNumber}</FlightNumber>
        </FlightNumberContainer>
      </Content>
    </Container>
  )
}

export default FlightCard
