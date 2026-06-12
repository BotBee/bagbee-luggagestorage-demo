import Link from 'next/link'
// import { useRouter } from 'next/router'
import React, { ReactNode } from 'react'
import Logo from '../../public/icons/Logo'
import styled from '@emotion/styled'

import BackButton from './back-button/BackButton'

interface IFormLayoutProps {
  title: string | null
  text: string | null
  children: ReactNode
}

const Container = styled.div`
  padding: 24px;
  margin-bottom: 60px;
`

const Content = styled.div`
  max-width: 768px;
  margin: 0 auto;
`
const TopContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;
  > a {
    padding-top: 12px;
    margin-left: -60px;
    @media (min-width: 768px) {
      margin-left: -120px;
    }
  }
`

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 32px;
  margin-bottom: 50px;
`

const Title = styled.h1`
  font-family: 'Poppins';
  font-weight: 700;
  font-size: 30px;
  line-height: 38px;
  display: flex;
  align-items: center;
  color: #000000;
  margin-top: 16px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    margin-top: 32px;
  }
`
const Text = styled.div`
  font-family: 'Poppins';
  font-weight: 400;
  font-size: 18px;
  line-height: 28px;
  display: flex;
  align-items: center;
  color: #8692a6;
`

const FormLayout = ({ title, text, children }: IFormLayoutProps) => {
  return (
    <Container>
      <Content>
        <TopContainer>
          <BackButton />
          <Link href='/'>
            <Logo />
          </Link>
          <span></span>
        </TopContainer>
        <TextContainer>
          <Title>{title}</Title>
          <Text>{text}</Text>
        </TextContainer>
        {children}
      </Content>
    </Container>
  )
}

export default FormLayout
