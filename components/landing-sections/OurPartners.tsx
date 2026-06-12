import styled from '@emotion/styled'
import Image from 'next/image'
import { useRouter } from 'next/router'
import React from 'react'

interface IOurPartnersProps {
  title: string
}
const Container = styled.section`
  display: grid;
  gap: 80px;
  max-width: 1240px;
  padding: 60px 24px;
  margin: 60px auto;
  text-align: center;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    padding: 48px;
    gap: 124px;
    margin-top: 0;
  }
`

const Title = styled.h3`
  width: 100%;
  font-weight: 600;
  font-size: 36px;
  line-height: 52px;
  color: ${({ theme }) => theme.colors.black};
  @media ${({ theme }) => theme.breakpoints.tablet} {
    font-size: 50px;
  }
`

const LogoContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 80px;

  @media ${({ theme }) => theme.breakpoints.tablet} {
    flex-direction: row;
    justify-content: space-between;
  }
`
const OurPartners = ({ title }: IOurPartnersProps) => {
  const { locale } = useRouter()
  return (
    <Container>
      <Title>{title}</Title>
      <LogoContainer>
        <Image
          src={locale === 'en' ? "/images/KEF-en.png" : "/images/KEF-is.png"}
          width={(locale === 'en' ? 404 : 447) / 2.3}
          height={180 / 2.3}
          alt="Keflavík International Airport"
          unoptimized
        />
        <Image
          src="/images/re.svg"
          width={240}
          height={135}
          alt="Reykjavik Excursions"
          unoptimized
        />
        <Image
          src="/images/icelandair.png"
          width={250 / 1.2}
          height={68 / 1.2}
          alt="Icelandair"
          unoptimized
        />
      </LogoContainer>
    </Container>
  )
}

export default OurPartners
