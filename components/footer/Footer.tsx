import styled from '@emotion/styled'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import Facebook from '../../public/icons/Facebook'
import Instagram from '../../public/icons/Instagram'
import LinkedIn from '../../public/icons/LinkedIn'
import Logo from '../../public/icons/Logo'

const Container = styled.footer`
  width: 100%;
  background-color: white;
`

const Content = styled.div`
  max-width: 1440px;
  padding: 24px;
  display: grid;
  margin: 0 auto;
  padding: 60px 24px;
  gap: 60px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    gap: 16px;
    padding: 80px 24px;
    grid-template-columns: 3fr 1.2fr 1.2fr 1.2fr;
  }
`

const BrandContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 180px;
`
const Tagline = styled.p`
  font-weight: 400;
  font-size: 16px;
  line-height: 25px;
  color: #70798b;
`

const Copyright = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: space-between;
  max-width: 1440px;
  margin: 0 auto;
  border-top: 1px solid rgba(0, 0, 0, 0.09);
  padding: 40px 24px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    flex-direction: row;
  }
`

const ListTitle = styled.p`
  font-weight: 500;
  font-size: 20px;
  line-height: 30px;
  color: ${({ theme }) => theme.colors.black};
  margin-bottom: 16px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    margin-bottom: 30px;
  }
`

const CopyrightText = styled.p`
  font-weight: 400;
  font-size: 16px;
  line-height: 22px;
  color: #70798b;
`

const ALink = styled.a`
  display: flex;
  gap: 8px;
  align-items: center;
  svg {
    path {
      fill: ${({ theme }) => theme.colors.greyDark};
    }
  }
`

const LinkText = styled.p`
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 400;
  font-size: 16px;
  line-height: 25px;
  color: #70798b;
  margin: 6px 0;
  &:hover {
    color: ${({ theme }) => theme.colors.black};
  }
`

const TermsLinkContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    gap: 12px;
    flex-direction: row;
  }
`

const Footer = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  return (
    <>
      <Container id='contact'>
        <Content>
          <BrandContainer>
            <Logo />
            <Tagline>{t.footer.tagline}</Tagline>
          </BrandContainer>
          <div>
            <ListTitle>{t.footer.linksHeading}</ListTitle>
            <Link href='/#header'>
              <LinkText>{t.navbar.home}</LinkText>
            </Link>

            <Link href='/#prices'>
              <LinkText>{t.navbar.prices}</LinkText>
            </Link>
            <Link href='/#faq'>
              <LinkText>{t.navbar.FAQ}</LinkText>
            </Link>
            <Link href='/gift-certificates'>
              <LinkText>{t.navbar.giftCertificates}</LinkText>
            </Link>
            <Link href='/about'>
              <LinkText>{t.navbar.about}</LinkText>
            </Link>
          </div>
          <div>
            <ListTitle>{t.footer.contactHeading}</ListTitle>
            <a href='tel:+3545785900'>
              <LinkText>+354 5785900</LinkText>
            </a>
            <a href='mailto:bagbee@bagbee.is'>
              <LinkText>bagbee@bagbee.is</LinkText>
            </a>
            <ALink
              href='https://instagram.com/bagbee_iceland?igshid=YmMyMTA2M2Y='
              target='_blank'
            >
              <Instagram />
              <LinkText>Instagram</LinkText>
            </ALink>
            <ALink
              href='https://www.facebook.com/profile.php?id=100088950572823'
              target='_blank'
            >
              <Facebook />
              <LinkText>Facebook</LinkText>
            </ALink>
            <ALink
              href='https://www.linkedin.com/company/bagbee-iceland/'
              target='_blank'
            >
              <LinkedIn />
              <LinkText>LinkedIn</LinkText>
            </ALink>
          </div>
          <div>
            <ListTitle>{t.footer.addressHeading}</ListTitle>
            <LinkText>Gróska, Bjargargata 1</LinkText>
            <LinkText>102, Reykjavík</LinkText>
            <LinkText>Iceland</LinkText>
          </div>
        </Content>
        <Copyright>
          <CopyrightText>
            Copyright © {new Date().getFullYear()} BagBee. {t.footer.copyright}
          </CopyrightText>
          <TermsLinkContainer>
            <Link href='/privacy-policy'>{t.footer.privacyPolicy}</Link>
            <Link href='/terms-conditions'>{t.footer.termsAndConditions}</Link>
          </TermsLinkContainer>
        </Copyright>
      </Container>
    </>
  )
}

export default Footer
