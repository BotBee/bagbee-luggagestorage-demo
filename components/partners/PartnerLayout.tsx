import styled from '@emotion/styled'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ReactNode } from 'react'
import Logo from '../../public/icons/Logo'
import { PartnerId } from '../../utils/partnerAuth'

const Wrapper = styled.div`
  min-height: 100vh;
  background: linear-gradient(180deg, #f5f6fa 0%, #ebf0f4 100%);
  padding-bottom: 80px;
`

const TopBar = styled.header`
  position: sticky;
  top: 0;
  z-index: 30;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #e5e6eb;
`

const MOBILE = '720px'

const TopBarInner = styled.div`
  max-width: 1280px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  @media (max-width: ${MOBILE}) {
    padding: 10px 14px;
    gap: 8px;
  }
`

const Brand = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
  line-height: 1;
  min-width: 0;
`

// The Logo SVG component renders the "BagBee" word-mark in F3AD3C orange.
// We scale it down for the topbar slot — by default it's 106×30; the
// wrapper just adjusts the visible width so it sits nicely with the
// "Partner portal" caption underneath.
const LogoMark = styled.div`
  display: flex;
  align-items: center;
  & svg {
    height: 22px;
    width: auto;
  }
  @media (max-width: ${MOBILE}) {
    & svg {
      height: 18px;
    }
  }
`

const BrandSubtitle = styled.div`
  font-family: 'Poppins', sans-serif;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #696f79;
  margin-top: 2px;
  @media (max-width: ${MOBILE}) {
    font-size: 9px;
  }
`

const Nav = styled.nav`
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Poppins', sans-serif;
  flex-shrink: 0;
  @media (max-width: ${MOBILE}) {
    gap: 4px;
  }
`

const NavLink = styled(Link, {
  shouldForwardProp: (prop) => prop !== 'isActive',
})<{ isActive: boolean }>`
  font-size: 13px;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: 10px;
  text-decoration: none;
  color: ${({ isActive }) => (isActive ? 'white' : '#000929')};
  background: ${({ isActive }) => (isActive ? '#3d7165' : 'transparent')};
  transition: background 0.15s ease, color 0.15s ease;
  white-space: nowrap;
  &:hover {
    background: ${({ isActive }) => (isActive ? '#345f55' : '#e9eef3')};
  }
  @media (max-width: ${MOBILE}) {
    font-size: 12px;
    padding: 6px 10px;
  }
`

const LogoutButton = styled.button`
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  padding: 8px 14px;
  border-radius: 10px;
  background: transparent;
  color: #696f79;
  border: 1px solid #e5e6eb;
  cursor: pointer;
  white-space: nowrap;
  &:hover {
    background: #f5f6fa;
    color: #000929;
  }
  @media (max-width: ${MOBILE}) {
    font-size: 11px;
    padding: 6px 10px;
  }
`

const Content = styled.main`
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 24px;
  @media (max-width: ${MOBILE}) {
    padding: 16px 14px;
  }
`

const Footer = styled.footer`
  max-width: 1280px;
  margin: 24px auto 0;
  padding: 16px 24px;
  font-family: 'Poppins', sans-serif;
  font-size: 11px;
  color: #a3a4a7;
  text-align: center;
`

export const PartnerLayout = ({
  partnerId,
  children,
}: {
  partnerId: PartnerId
  // Accepted but currently unused — the topbar shows the BagBee logo
  // + "Partner portal" caption instead of the agency name. Kept on the
  // signature so callers (dashboard, login, order pages) don't break.
  partnerDisplayName?: string
  children: ReactNode
}) => {
  const router = useRouter()
  // useRouter().pathname returns the route template with the dynamic slug
  // literal, e.g. `/partners/[partnerId]/dashboard`. We compare against the
  // real URL by substituting the actual partnerId in.
  const dashboardHref = `/partners/${partnerId}/dashboard`
  const newOrderHref = `/partners/${partnerId}/orders/new`
  const actualPath = router.asPath.split('?')[0]
  const isActive = (href: string) =>
    actualPath === href || actualPath.startsWith(href + '/')

  const logout = async () => {
    await fetch(`/api/partners/${partnerId}/logout`, { method: 'POST' })
    router.replace(`/partners/${partnerId}/login`)
  }

  return (
    <Wrapper>
      <TopBar>
        <TopBarInner>
          <Brand>
            <LogoMark>
              <Logo fill="#3d7165" />
            </LogoMark>
            <BrandSubtitle>Partner portal</BrandSubtitle>
          </Brand>
          <Nav>
            <NavLink href={dashboardHref} isActive={isActive(dashboardHref)}>
              Dashboard
            </NavLink>
            <NavLink href={newOrderHref} isActive={isActive(newOrderHref)}>
              + New order
            </NavLink>
            <LogoutButton onClick={logout}>Log out</LogoutButton>
          </Nav>
        </TopBarInner>
      </TopBar>
      <Content>{children}</Content>
      <Footer>bagbee@bagbee.is</Footer>
    </Wrapper>
  )
}

export default PartnerLayout
