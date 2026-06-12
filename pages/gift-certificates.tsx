import styled from '@emotion/styled'
import { GetStaticProps, InferGetStaticPropsType } from 'next'
import { useRouter } from 'next/router'
import React from 'react'
import en from '../common/locales/en'
import is from '../common/locales/is'
import Button from '../components/button/Button'
import Footer from '../components/footer/Footer'
import Header from '../components/header/Header'
import { Title, Text } from '../components/image-text/ImageText'
import { getNavigation } from '../modules/contentful/api'

const Container = styled.div`
  background-color: #f9f9f9;
`

const Content = styled.section`
  padding: 40px 24px 60px;
  display: flex;
  max-width: 1240px;
  margin: 0 auto;
  gap: 60px;
  flex-direction: column-reverse;
  min-height: 70vh;
  align-items: center;
  justify-content: center;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    padding: 60px 48px;
    flex-direction: row;
    gap: 80px;
  }
`

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 600px;
`

const ImageContainer = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s ease;

  &:hover {
    transform: translateY(-5px);
  }

  img {
    width: 100%;
    object-fit: cover;
    align-self: start;
    @media ${({ theme }) => theme.breakpoints.tablet} {
      width: 100%;
    }
  }
`

const StyledButton = styled(Button)`
  margin-top: 8px;
  padding: 12px 28px;
  font-weight: 600;
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover span {
    transform: translateX(4px);
  }
`

const ArrowIcon = styled.span`
  display: inline-block;
  transition: transform 0.2s ease;
`

const Giftcard = ({ navigation }: InferGetStaticPropsType<typeof getStaticProps>) => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is

  const giftCertificateLink: string =
    locale === 'en' ? 'https://book.bagbee.is/giftcertificate' : 'https://book.bagbee.is/gjafabref'

  return (
    <Container>
      <Header navigation={navigation.header} />
      <Content>
        <TextContainer>
          <Title>{t.giftcardPage.title}</Title>
          <Text>{t.giftcardPage.paragraph1}</Text>
          <a href={giftCertificateLink} target="_blank" rel="noreferrer">
            <StyledButton>
              {t.giftcardPage.buttonText}
              <ArrowIcon>→</ArrowIcon>
            </StyledButton>
          </a>
        </TextContainer>
        <ImageContainer>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/giftcard.png" alt="" />
        </ImageContainer>
      </Content>
      <Footer navigation={navigation.footer} />
    </Container>
  )
}

export const getStaticProps = (async ({ locale }) => {
  const navigation = await getNavigation({ locale: locale || '' })
  return {
    props: { navigation },
    revalidate: 10,
  }
}) satisfies GetStaticProps

export default Giftcard
