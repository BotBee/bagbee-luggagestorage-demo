import styled from '@emotion/styled'
import React from 'react'
import { IBenefitCard } from '../../@types/generated/contentful'
import Airplane from '../../public/icons/Airplane'
import Calendar from '../../public/icons/Calendar'
import Truck from '../../public/icons/Truck'
import BenefitsCard from '../button/benefits-card/BenefitsCard'

interface IBenefitsSectionProps {
  data: IBenefitCard[]
}

const Container = styled.section`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  max-width: 1240px;
  margin: 0 auto;
  padding: 24px;
  @media ${({ theme }) => theme.breakpoints.laptop} {
    padding: 48px;
    flex-direction: row;
  }
`
const BenefitsSection = ({ data }: IBenefitsSectionProps) => {
  const iconMap = (iconTitle: string) => {
    switch (iconTitle) {
      case 'airplane':
        return <Airplane />
      case 'calendar':
        return <Calendar />
      case 'truck':
        return <Truck />
      default:
    }
  }

  return (
    <Container id='how-it-works'>
      {data.map((card) => (
        <BenefitsCard
          icon={iconMap(card?.fields?.icon!!)}
          heading={card.fields.title}
          text={card.fields.text}
          key={card.sys.id}
        />
      ))}
    </Container>
  )
}

export default BenefitsSection
