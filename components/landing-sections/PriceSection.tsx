import styled from '@emotion/styled'
import React from 'react'
import { IPriceSection } from '../../@types/generated/contentful'
import PriceCalculator from '../price-calculator/PriceCalculator'

interface IPriceSectionProps {
  data: IPriceSection[]
}

const Container = styled.section`
  display: flex;
  flex-direction: column-reverse;
  gap: 24px;
  max-width: 1240px;
  margin: 60px auto;
  padding: 24px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 48px;
    flex-direction: row;
    gap: 80px;
    margin: 120px auto;
  }
`

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
`

const Title = styled.h3`
  font-weight: 600;
  font-size: 36px;
  line-height: 50px;
  color: #000000;

  @media ${({ theme }) => theme.breakpoints.tablet} {
    font-size: 50px;
    line-height: 72px;
  }
`

const Text = styled.p`
  font-weight: 500;
  font-size: 16px;
  line-height: 32px;
  color: #a3a4a7;
`

const PriceSection = ({ data }: IPriceSectionProps) => {
  const content = data[0]
  return (
    <Container id='prices'>
      <PriceCalculator />
      <TextContainer>
        <Title>{content.fields.title}</Title>
        <Text>{content.fields.text}</Text>
      </TextContainer>
    </Container>
  )
}

export default PriceSection
