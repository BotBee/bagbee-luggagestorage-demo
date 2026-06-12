import styled from '@emotion/styled'
import React, { ReactNode } from 'react'

interface IAirlineCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
}

const Container = styled.button<IAirlineCardProps>`
  min-height: 150px;
  width: 100%;
  background-color: ${({ theme, disabled }) => (disabled ? theme.colors.greyLight : 'white')};
  border-radius: 20px;
  padding: 24px;
  overflow: hidden;
  &:hover {
    outline: 2px solid #f3ad3c;
  }
  &:focus {
    outline: 2px solid #f3ad3c;
  }
  &:disabled {
    outline: none;
  }
  cursor: ${({ disabled }) => (disabled ? 'initial' : 'pointer')};
  svg {
    width: 100%;
  }
`

const AirlineCard = ({ icon, onClick, disabled, ...rest }: IAirlineCardProps) => {
  return (
    <Container onClick={onClick} disabled={disabled} {...rest} type="button">
      {icon}
    </Container>
  )
}

export default AirlineCard
