import styled from '@emotion/styled'
import Link from 'next/link'
import React from 'react'
import { IHeroSection } from '../../@types/generated/contentful'

import { ApplicationRoutes } from '../../utils/routing'
import Button from '../button/Button'

interface ILandingSectionProps {
  data: IHeroSection
}

const Container = styled.section`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 40px;
  padding: 0 24px;
  margin: 0 auto;
  height: 75vh;
  margin-bottom: 60px;

  @media ${({ theme }) => theme.breakpoints.tablet} {
    height: calc(80vh - 70px);
    min-height: 600px;
    margin-bottom: 0;
  }
`

const SectionTitle = styled.h1`
  font-family: ${({ theme }) => theme.fonts.druk};
  color: ${({ theme }) => theme.colors.black};
  line-height: 110%;
  text-align: center;
  padding: 0 px;
  letter-spacing: -0.001em;
  margin-bottom: 16px;
  z-index: 20;
  font-size: 62px;
  font-weight: 500;
  @media (min-width: 420pxx) {
    font-size: 80px;
  }
  @media ${({ theme }) => theme.breakpoints.tablet} {
    letter-spacing: -0.01em;
    font-size: 139px;
    line-height: 110%;
    max-width: 940px;
  }
`

const Paragraph = styled.p`
  color: ${({ theme }) => theme.colors.greyLight};
  text-align: center;
  font-size: 16px;
  max-width: 660px;
  margin: 0 auto;
`

const HeroSection = ({ data }: ILandingSectionProps) => {
  const content = data.fields
  return (
    <Container id='landing'>
      <div>
        <SectionTitle>{content.title}</SectionTitle>
        <Paragraph>{content.subheading}</Paragraph>
      </div>
      <Link href={ApplicationRoutes.pages.book}>
        <Button showArrow>{content.ctaButtonText}</Button>
      </Link>
    </Container>
  )
}

export default HeroSection
