import styled from '@emotion/styled'
import { useRouter } from 'next/router'
import React from 'react'
import { useBookingStore } from '../../store/store'
import { ServiceType } from '../../common/types'
import { ApplicationRoutes } from '../../utils/routing'
import Button from '../button/Button'

const Container = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 24px;
  margin: 0 auto;
  min-height: 80vh;
  justify-content: center;

  @media (min-width: 768px) {
    padding: 80px 48px;
  }
`

const Title = styled.h1`
  font-family: 'Druk', sans-serif;
  color: #000929;
  font-size: 48px;
  font-weight: 500;
  text-align: center;
  line-height: 110%;
  margin-bottom: 16px;

  @media (min-width: 768px) {
    font-size: 96px;
  }
`

const Subtitle = styled.p`
  color: #a3a4a7;
  text-align: center;
  font-family: 'Poppins', sans-serif;
  font-size: 16px;
  max-width: 600px;
  margin: 0 auto 48px;
  line-height: 1.6;

  @media (min-width: 768px) {
    font-size: 18px;
  }
`

const CardGrid = styled.div`
  display: grid;
  gap: 24px;
  width: 100%;
  max-width: 1000px;
  grid-template-columns: 1fr;

  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr 1fr;
  }
`

const Card = styled.div<{ highlighted?: boolean }>`
  background: white;
  border-radius: 24px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  border: 2px solid ${({ highlighted }) => (highlighted ? '#F3AD3C' : '#e5e6eb')};
  position: relative;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
  }
`

const Badge = styled.div`
  position: absolute;
  top: -12px;
  background: #f3ad3c;
  color: white;
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 16px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const CardIcon = styled.div`
  font-size: 48px;
  line-height: 1;
`

const CardTitle = styled.h3`
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  font-size: 22px;
  color: #000929;
  margin: 0;
`

const CardDescription = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #797979;
  line-height: 1.6;
  margin: 0;
  min-height: 66px;
`

const CardPrice = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #a3a4a7;
  margin: 0;

  span {
    font-weight: 600;
    color: #000929;
    font-size: 18px;
  }
`

const ServiceSelector = () => {
  const router = useRouter()
  const updateServiceType = useBookingStore(
    (state) => state.updateServiceType
  )

  const handleSelect = (type: ServiceType) => {
    updateServiceType(type)
    if (type === 'arrival') {
      router.push(ApplicationRoutes.arrival.book)
    } else {
      router.push(ApplicationRoutes.pages.book)
    }
  }

  return (
    <Container>
      <Title>BagBee</Title>
      <Subtitle>
        Skip the hassle. We handle your luggage so you can enjoy Iceland
        hands-free.
      </Subtitle>
      <CardGrid>
        <Card onClick={() => handleSelect('departure')}>
          <CardIcon>&#9992;&#xFE0E;</CardIcon>
          <CardTitle>Departure</CardTitle>
          <CardDescription>
            We pick up your bags at your hotel or address and check them in
            before your flight. Travel light to the airport.
          </CardDescription>
          <CardPrice>
            From <span>6.990 kr</span>
          </CardPrice>
          <Button fullWidth>Book departure</Button>
        </Card>

        <Card onClick={() => handleSelect('arrival')}>
          <CardIcon>&#127936;</CardIcon>
          <CardTitle>Arrival</CardTitle>
          <CardDescription>
            We collect your bags when you land at Keflavik and deliver them to
            your hotel. Skip baggage claim.
          </CardDescription>
          <CardPrice>
            From <span>8.990 kr</span>
          </CardPrice>
          <Button fullWidth>Book arrival</Button>
        </Card>

        <Card highlighted onClick={() => handleSelect('both')}>
          <Badge>Best value</Badge>
          <CardIcon>&#9992;&#xFE0E; + &#127936;</CardIcon>
          <CardTitle>Both services</CardTitle>
          <CardDescription>
            Round-trip luggage freedom. We handle your bags on arrival and
            departure so you never wait at a carousel.
          </CardDescription>
          <CardPrice>
            Complete peace of mind
          </CardPrice>
          <Button fullWidth>Book both</Button>
        </Card>
      </CardGrid>
    </Container>
  )
}

export default ServiceSelector
