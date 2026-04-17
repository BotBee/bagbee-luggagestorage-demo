import styled from '@emotion/styled'
import React, { ReactNode } from 'react'

interface IBenefitCardProps {
  icon: ReactNode
  heading: string
  text: string
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  background: #ffffff;
  box-shadow: 0px 17px 62px rgba(2, 6, 12, 0.07);
  border-radius: 32px;
  padding: 48px 24px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    padding: 48px 24px;
  }
`

const Heading = styled.p`
  font-weight: 600;
  font-size: 20px;
  line-height: 42px;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.black};
  margin-top: 6px;
  margin-bottom: 6px;
`

const Text = styled.p`
  font-weight: 500;
  font-size: 16px;
  line-height: 28px;
  color: ${({ theme }) => theme.colors.greyDark};
`

const BenefitsCard = ({ icon, heading, text }: IBenefitCardProps) => {
  return (
    <Container>
      <p>{icon}</p>
      <Heading>{heading}</Heading>
      <Text>{text}</Text>
    </Container>
  )
}

export default BenefitsCard
