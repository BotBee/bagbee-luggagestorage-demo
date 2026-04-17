import React from 'react'
import { PickupInformation } from '../../common/types'
import styled from '@emotion/styled'
import EcoLeaf from '../../public/icons/EcoLeaf'

interface ITimeCardProps {
  selected?: boolean
  onClick: () => void
  timeSlot: PickupInformation['pickupSlot']
  date: string
  index: number
}

const Container = styled.button<Pick<ITimeCardProps, 'selected'>>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  gap: 16px;
  background-color: white;
  padding: 24px;
  border: ${({ selected }) =>
    selected ? '1px solid #f3ad3c' : '1px solid lightGrey'};
  border-radius: 20px;
  opacity: ${({ selected }) => (selected ? '1' : '0.8')};
`
const Time = styled.p`
  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  color: #0b0a0f;
`
const Date = styled.p`
  font-weight: 400;
  font-size: 16px;
  line-height: 24px;
  color: #8692a6;
`
const PickUpTimeCard = ({
  selected,
  timeSlot,
  date,
  index,
  onClick,
}: ITimeCardProps) => {
  return (
    <Container selected={selected} type='button' onClick={onClick}>
      {index === 0 && <EcoLeaf />}
      <Time>{timeSlot}</Time>
      <Date>{date}</Date>
    </Container>
  )
}

export default PickUpTimeCard
