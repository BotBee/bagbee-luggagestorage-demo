import React from 'react'
import { PickupInformation } from '../../common/types'
import styled from '@emotion/styled'
import EcoLeaf from '../../public/icons/EcoLeaf'
import { useRouter } from 'next/router'
import en from '../../common/locales/en'
import is from '../../common/locales/is'

interface ITimeCardProps {
  selected?: boolean
  onClick: () => void
  timeSlot: PickupInformation['pickupSlot']
  date: string
  index: number
  disabled?: boolean
}

const Container = styled.button<Pick<ITimeCardProps, 'selected' | 'disabled'>>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  gap: 16px;
  background-color: ${({ disabled }) => (disabled ? '#f5f5f5' : 'white')};
  padding: 24px;
  border: ${({ selected }) =>
    selected ? '3px solid #f3ad3c' : '1px solid lightGrey'};
  border-radius: 20px;
  opacity: ${({ selected }) => (selected ? '1' : '0.8')};
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  pointer-events: ${({ disabled }) => (disabled ? 'none' : 'auto')};
`
const Time = styled.p<Pick<ITimeCardProps, 'disabled'>>`
  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  color: ${({ disabled }) => (disabled ? '#8692a6' : '#0b0a0f')};
`
const Date = styled.p<Pick<ITimeCardProps, 'disabled'>>`
  font-weight: 400;
  font-size: 16px;
  line-height: 24px;
  color: ${({ disabled }) => (disabled ? '#8692a6' : '#0b0a0f')};
`
const PickUpTimeCard = ({
  selected,
  timeSlot,
  date,
  index,
  onClick,
  disabled,
}: ITimeCardProps) => {
  const { locale } = useRouter()
  const t = locale === 'en' ? en : is
  return (
    <Container selected={selected} type='button' onClick={onClick} disabled={disabled}>
      {index === 0 && <EcoLeaf />}
      {disabled && <span>{t.pickUpStep.fullyBooked}</span>}
      <Time disabled={disabled}>{timeSlot}</Time>
      <Date disabled={disabled}>{date}</Date>
    </Container>
  )
}

export default PickUpTimeCard
