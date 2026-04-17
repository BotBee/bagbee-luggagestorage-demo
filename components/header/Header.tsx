import styled from '@emotion/styled'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import Logo from '../../public/icons/Logo'

interface IHeaderProps {
  hideNav?: boolean
}
const Container = styled.section`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 100px;
  max-width: 1240px;
  margin: 0 auto;
  padding: 0px 24px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    padding: 0 48px;
  }
`
const LocaleButton = styled.button`
  display: flex;
  gap: 12px;
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-size: 14px;
  font-weight: 600;
  border: 1px solid ${({ theme }) => theme.colors.green};
  color: ${({ theme }) => theme.colors.green};
  align-items: center;
  border-radius: 12px;
  padding: 8px 16px;
  box-shadow: 0px 17px 62px rgba(2, 6, 12, 0.1);
  &:hover {
    /* background-color: ${({ theme }) => theme.colors.orange}; */
    color: ${({ theme }) => theme.colors.orange};
    border: 1px solid ${({ theme }) => theme.colors.orange};
  }
`

const Navigation = styled.nav`
  display: none;
  gap: 40px;
  a {
    &:hover {
      color: ${({ theme }) => theme.colors.black};
    }
  }
  @media (min-width: 1000px) {
    display: flex;
  }
`
const Header = ({ hideNav }: IHeaderProps) => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is

  const changeLocale = (locale: string) => {
    // Pushing the new locale to the router
    router.push(
      {
        query: router.query,
      },
      router.asPath,
      { locale }
    )
  }
  return (
    <Container id='header'>
      <Link href={router.pathname === '/' ? '#landing' : '/'}>
        <Logo />
      </Link>
      {!hideNav && (
        <Navigation>
          <Link href='/#how-it-works'>{t.navbar.howItWorks}</Link>
          <Link href='/#why-bagbee'>{t.navbar.why}</Link>
          <Link href='/#prices'>{t.navbar.prices}</Link>
          <Link href='/#faq'>{t.navbar.FAQ}</Link>
          <Link href='/#contact'>{t.navbar.contact}</Link>
        </Navigation>
      )}
      {router.locale === 'is' ? (
        <LocaleButton onClick={() => changeLocale('en')}>
          🇬🇧 <p>English</p>
        </LocaleButton>
      ) : (
        <LocaleButton onClick={() => changeLocale('is')}>
          🇮🇸 <p>Íslenska</p>
        </LocaleButton>
      )}
    </Container>
  )
}

export default Header
