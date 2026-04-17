import React, { ReactNode } from 'react'
import InfoIcon from '../../public/icons/InfoIcon'
import styled from '@emotion/styled'

interface IInfoTextProps {
  children: ReactNode
}

const Container = styled.div`
  display: grid;
  grid-template-columns: 12px auto;
  gap: 16px;
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 300;
  font-size: 14px;
  line-height: 20px;
  color: #8692a6;
  margin-bottom: 12px;
  border: 1px solid ${({ theme }) => theme.colors.greyLight};
  padding: 24px;
  border-radius: 12px;
  svg {
    margin-top: 2px;
    height: 20px;
    width: 20px;
    path {
    }
  }
`

const InfoText = ({ children, ...rest }: IInfoTextProps) => {
  return (
    <Container {...rest}>
      <InfoIcon />
      {children}
    </Container>
  )
}

export default InfoText
