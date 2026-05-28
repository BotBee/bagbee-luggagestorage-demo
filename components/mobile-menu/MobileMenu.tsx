import styled from '@emotion/styled'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { ILink } from '../../@types/generated/contentful'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import CloseIcon from '../../public/icons/CloseIcon'

interface IMobileMenuProps {
  isOpen: boolean
  onClose: () => void
  navigation: ILink[]
}

const Overlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: ${({ isOpen }) => (isOpen ? 1 : 0)};
  visibility: ${({ isOpen }) => (isOpen ? 'visible' : 'hidden')};
  transition: opacity 0.3s ease, visibility 0.3s ease;
`

const MenuContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  width: 320px;
  height: 100dvh;
  background-color: white;
  z-index: 1000;
  transform: ${({ isOpen }) => (isOpen ? 'translateX(0)' : 'translateX(100%)')};
  transition: transform 0.3s ease;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  padding: 24px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e6eb;
`

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #f5f5f5;
  }
`

const Navigation = styled.nav`
  display: flex;
  flex-direction: column;
  flex: 1;
`

const NavLink = styled(Link)`
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-size: 18px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.black};
  text-decoration: none;
  padding: 12px 0;
  border-bottom: 1px solid transparent;
  transition: color 0.2s ease, border-color 0.2s ease;

  &:hover {
    color: ${({ theme }) => theme.colors.green};
  }
`

const LocaleSection = styled.div`
  margin-top: auto;
  padding-top: 24px;
  border-top: 1px solid #e5e6eb;
`

const LocaleButton = styled.button`
  display: flex;
  gap: 12px;
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-size: 16px;
  font-weight: 600;
  border: 1px solid ${({ theme }) => theme.colors.green};
  color: ${({ theme }) => theme.colors.green};
  align-items: center;
  border-radius: 12px;
  padding: 12px 20px;
  background: white;
  width: 100%;
  justify-content: center;
  box-shadow: 0px 4px 12px rgba(2, 6, 12, 0.1);
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.orange};
    border-color: ${({ theme }) => theme.colors.orange};
    transform: translateY(-1px);
    box-shadow: 0px 6px 16px rgba(2, 6, 12, 0.15);
  }
`

const MobileMenu = ({ isOpen, onClose, navigation }: IMobileMenuProps) => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const changeLocale = (locale: string) => {
    router.push(
      {
        query: router.query,
      },
      router.asPath,
      { locale },
    )
    onClose()
  }

  return (
    <>
      <Overlay isOpen={isOpen} onClick={onClose} />
      <MenuContainer isOpen={isOpen}>
        <Header>
          <h2 style={{ margin: 0, fontFamily: 'Poppins', fontSize: '20px', fontWeight: '600' }}>
            {t.common.menu}
          </h2>
          <CloseButton onClick={onClose} aria-label={t.common.closeMenu}>
            <CloseIcon />
          </CloseButton>
        </Header>

        <Navigation>
          {navigation.map((item) => (
            <NavLink key={item.sys.id} href={item.fields.href} onClick={onClose}>
              {item.fields.displayText}
            </NavLink>
          ))}
        </Navigation>

        <LocaleSection>
          {router.locale === 'is' ? (
            <LocaleButton onClick={() => changeLocale('en')}>
              🇬🇧 <span>English</span>
            </LocaleButton>
          ) : (
            <LocaleButton onClick={() => changeLocale('is')}>
              🇮🇸 <span>Íslenska</span>
            </LocaleButton>
          )}
        </LocaleSection>
      </MenuContainer>
    </>
  )
}

export default MobileMenu
