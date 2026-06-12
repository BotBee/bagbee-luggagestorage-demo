import styled from '@emotion/styled'
import React from 'react'
import { Airport } from '../../common/types'
interface IAirportCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  airport: Airport
  onClick: () => void
}

const Container = styled.button`
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 100px;
  width: 100%;
  background-color: #ffff;
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
  padding: 0 24px;
  color: #1d3c34;

  span {
    height: 32px;
    width: 32px;
  }
`

const Leftside = styled.div`
  display: flex;
  align-items: center;
  text-align: left;
  gap: 24px;
  > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
`

const City = styled.p`
  font-weight: 600;
  font-size: 16px;
  line-height: 21px;
`

const AirportName = styled.p`
  font-weight: 400;
  font-size: 16px;
  line-height: 21px;
  text-align: left;
`

const IataCode = styled.p`
  font-weight: 600;
`

const AirportCard = ({ airport, onClick, ...rest }: IAirportCardProps) => {
  const flagClassName = `${airport.countryCode.toLowerCase()} fi fi-${airport.countryCode.toLowerCase()}`

  return (
    <Container onClick={onClick} {...rest}>
      <Leftside>
        <span className={flagClassName}></span>
        <div>
          <City>{airport.city}</City>
          <AirportName>{airport.name}</AirportName>
        </div>
      </Leftside>
      <IataCode>{airport.iata}</IataCode>
    </Container>
  )
}

export default AirportCard
