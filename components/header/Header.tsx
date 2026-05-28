import styled from '@emotion/styled'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import type { ILink } from '../../@types/generated/contentful'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import HamburgerMenu from '../../public/icons/HamburgerMenu'
import Logo from '../../public/icons/Logo'
import MobileMenu from '../mobile-menu/MobileMenu'

type IHeaderProps =
  | {
      hideNav: true
      navigation?: never
    }
  | {
      hideNav?: false
      navigation: ILink[]
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

  @media (max-width: 1023px) {
    display: none;
  }
`

const MobileMenuButton = styled.button`
  display: none;
  background: ${({ theme }) => theme.colors.yellow};
  color: white;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background-color 0.2s ease;
  margin-top: -8px;

  &:hover {
    background-color: ${({ theme }) => theme.colors.orange};
  }

  @media (max-width: 1023px) {
    display: flex;
    align-items: center;
    justify-content: center;
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
const Header = ({ hideNav, navigation }: IHeaderProps) => {
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { locale } = router
  const t = locale === 'en' ? en : is

  const changeLocale = (locale: string) => {
    // Pushing the new locale to the router
    router.push(
      {
        query: router.query,
      },
      router.asPath,
      { locale },
    )
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  // Disable page scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    // Cleanup function to restore scroll when component unmounts
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMobileMenuOpen])

  return (
    <>
      <Container id="header">
        <Link href={router.pathname === '/' ? '#landing' : '/'}>
          <Logo />
        </Link>
        {!hideNav && (
          <Navigation>
            {navigation.map((item) => (
              <Link key={item.sys.id} href={item.fields.href}>
                {item.fields.displayText}
              </Link>
            ))}
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
        {!hideNav && (
          <MobileMenuButton onClick={toggleMobileMenu} aria-label={t.common.openMenu}>
            <HamburgerMenu />
          </MobileMenuButton>
        )}
      </Container>
      {!hideNav && (
        <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} navigation={navigation} />
      )}
    </>
  )
}

export default Header
