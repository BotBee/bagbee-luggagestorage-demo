import styled from '@emotion/styled'
import React, { ReactNode } from 'react'

interface IAirlineCardProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode
  selected?: boolean
  onClick: () => void
  disabled?: boolean
}

const Container = styled.button<IAirlineCardProps>`
  /* height: 140px; */
  width: 100%;
  background-color: ${({ theme, disabled }) =>
    disabled ? theme.colors.greyLight : 'white'};
  border: ${({ selected }) =>
    selected ? '1px solid #f3ad3c' : '1px solid #fffff'};
  border-radius: 20px;
  padding: 24px;
  opacity: ${({ selected }) => (selected ? '1' : '0.8')};
  overflow: hidden;
  cursor: ${({ disabled }) => (disabled ? 'initial' : 'pointer')};
  svg {
    width: 100%;
  }
`

const AirlineCard = ({
  selected,
  icon,
  onClick,
  disabled,
  ...rest
}: IAirlineCardProps) => {
  return (
    <Container
      selected={selected}
      onClick={onClick}
      disabled={disabled}
      {...rest}
      type='button'
    >
      {icon}
    </Container>
  )
}

export default AirlineCard
