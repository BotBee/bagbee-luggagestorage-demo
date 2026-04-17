import styled from '@emotion/styled'
import Image from 'next/image'
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
  return (
    <Container>
      <Title>{title}</Title>
      <LogoContainer>
        <Image
          src='/images/isavia.png'
          width={240 / 1.2}
          height={80 / 1.2}
          alt=''
          unoptimized
        />
        <Image
          src='/images/playair.png'
          width={240 / 1.4}
          height={57 / 1.4}
          alt=''
          unoptimized
        />
        <Image
          src='/images/icelandair.png'
          width={250 / 1.2}
          height={68 / 1.2}
          alt=''
          unoptimized
        />
      </LogoContainer>
    </Container>
  )
}

export default OurPartners
