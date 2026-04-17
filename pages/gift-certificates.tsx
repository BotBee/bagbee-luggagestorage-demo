import styled from '@emotion/styled'
import { useRouter } from 'next/router'
import React from 'react'
import en from '../common/locales/en'
import is from '../common/locales/is'
import Button from '../components/button/Button'
import Footer from '../components/footer/Footer'
import Header from '../components/header/Header'
import { Title, Text } from '../components/image-text/ImageText'

const Container = styled.div`
  background-color: #f5f5f5;
`

const Content = styled.section`
  padding: 24px 24px;
  padding-bottom: 48px;
  display: flex;
  max-width: 1240px;
  margin: 0 auto;
  gap: 40px;
  flex-direction: column;
  min-height: 60vh;
  align-items: center;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    padding: 48px 48px;
    flex-direction: row;
  }
`

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`
const ImageContainer = styled.div`
  display: flex;
  width: 100%;
  img {
    width: 100%;
    align-self: start;
    @media ${({ theme }) => theme.breakpoints.tablet} {
      width: 400px;
    }
  }
`
const Giftcard = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is

  const giftCertificateLink: string =
    locale === 'en'
      ? 'https://forms.fillout.com/t/rWDmySh64qus'
      : 'https://forms.fillout.com/t/q14PKEorTUus'

  return (
    <Container>
      <Header />
      <Content>
        <ImageContainer>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src='/images/giftcard.png' alt='' />
        </ImageContainer>
        <TextContainer>
          <Title>{t.giftcardPage.title}</Title>
          <Text>{t.giftcardPage.paragraph1}</Text>
          <Text>{t.giftcardPage.paragraph2}</Text>
          <a href={giftCertificateLink} target='_blank' rel='noreferrer'>
            <Button>{t.giftcardPage.buttonText}</Button>
          </a>
        </TextContainer>
      </Content>
      <Footer />
    </Container>
  )
}

export default Giftcard
