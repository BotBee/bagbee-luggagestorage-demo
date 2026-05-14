import styled from '@emotion/styled'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ReactNode } from 'react'

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
  align-items: center;
  gap: 12px;
  min-width: 0;
  @media (max-width: ${MOBILE}) {
    gap: 8px;
  }
`

const BrandLogo = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: linear-gradient(135deg, #3d7165 0%, #20c933 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 800;
  font-family: 'Poppins', sans-serif;
  letter-spacing: -0.5px;
  font-size: 16px;
  flex-shrink: 0;
  @media (max-width: ${MOBILE}) {
    width: 32px;
    height: 32px;
    font-size: 14px;
    border-radius: 9px;
  }
`

const BrandText = styled.div`
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  font-family: 'Poppins', sans-serif;
  min-width: 0;
`

const BrandTitle = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: #000929;
  white-space: nowrap;
  @media (max-width: ${MOBILE}) {
    font-size: 13px;
  }
`

const BrandSubtitle = styled.div`
  font-size: 11px;
  color: #696f79;
  white-space: nowrap;
  @media (max-width: ${MOBILE}) {
    display: none;
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
  partnerDisplayName,
  children,
}: {
  partnerDisplayName: string
  children: ReactNode
}) => {
  const router = useRouter()
  const path = router.pathname

  const logout = async () => {
    await fetch('/api/partners/iceland-travel/logout', { method: 'POST' })
    router.replace('/partners/iceland-travel/login')
  }

  const isActive = (href: string) => path === href || path.startsWith(href + '/')

  return (
    <Wrapper>
      <TopBar>
        <TopBarInner>
          <Brand>
            <BrandLogo>BB</BrandLogo>
            <BrandText>
              <BrandTitle>BagBee Partner Portal</BrandTitle>
              <BrandSubtitle>{partnerDisplayName}</BrandSubtitle>
            </BrandText>
          </Brand>
          <Nav>
            <NavLink
              href="/partners/iceland-travel/dashboard"
              isActive={isActive('/partners/iceland-travel/dashboard')}
            >
              Dashboard
            </NavLink>
            <NavLink
              href="/partners/iceland-travel/orders/new"
              isActive={isActive('/partners/iceland-travel/orders/new')}
            >
              + New order
            </NavLink>
            <LogoutButton onClick={logout}>Log out</LogoutButton>
          </Nav>
        </TopBarInner>
      </TopBar>
      <Content>{children}</Content>
      <Footer>
        Invoice-business orders are billed after delivery. Edits are sent to BagBee
        instantly. Questions? bagbee@bagbee.is
      </Footer>
    </Wrapper>
  )
}

export default PartnerLayout
