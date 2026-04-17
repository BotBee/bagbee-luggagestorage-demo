import styled from '@emotion/styled'
import React from 'react'
import { Airport } from '../../common/types'
interface IAirportCardProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  airport: Airport
  onClick: () => void
}

const Container = styled.button<Pick<IAirportCardProps, 'selected'>>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 100px;
  width: 100%;
  background-color: #ffff;
  border: ${({ selected }) =>
    selected ? '1px solid #f3ad3c' : '1px solid #fffff'};
  border-radius: 8px;
  opacity: ${({ selected }) => (selected ? '1' : '1')};
  padding: 0 24px;

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

const City = styled.p<Pick<IAirportCardProps, 'selected'>>`
  font-weight: 600;
  font-size: 16px;
  line-height: 21px;
  color: ${({ selected }) => (selected ? 'black' : '#8692A6')};
`

const AirportName = styled.p<Pick<IAirportCardProps, 'selected'>>`
  font-weight: 400;
  font-size: 16px;
  line-height: 21px;
  text-align: left;
  color: ${({ selected }) => (selected ? 'black' : '#8692A6')};
`

const IataCode = styled.p<Pick<IAirportCardProps, 'selected'>>`
  font-weight: 600;
  color: ${({ selected }) => (selected ? 'black' : '#8692A6')};
`

const AirportCard = ({
  selected,
  airport,
  onClick,
  ...rest
}: IAirportCardProps) => {
  const flagClassName = `${airport.countryCode.toLowerCase()} fi fi-${airport.countryCode.toLowerCase()}`

  return (
    <Container selected={selected} onClick={onClick} {...rest}>
      <Leftside>
        <span className={flagClassName}></span>
        <div>
          <City selected={selected}>{airport.city}</City>
          <AirportName selected={selected}>{airport.name}</AirportName>
        </div>
      </Leftside>
      <IataCode selected={selected}>{airport.iata}</IataCode>
    </Container>
  )
}

export default AirportCard
