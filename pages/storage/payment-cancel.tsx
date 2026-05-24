import Link from 'next/link'
import { NextSeo } from 'next-seo'
import styled from '@emotion/styled'
import { keyframes } from '@emotion/react'
import Logo from '../../public/icons/Logo'

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const Page = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #fff8ec 0%, #ffeacc 45%, #f7e0ff 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: 'Poppins', sans-serif;
  padding: 24px;
`

const TopBar = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  padding: 20px 28px;
  display: flex;
  align-items: center;
  z-index: 10;
`

const Card = styled.div`
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 28px;
  padding: 48px 44px;
  max-width: 520px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 60px -20px rgba(29, 60, 52, 0.25);
  animation: ${fadeIn} 0.6s ease both;
`

const Icon = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #fee2e2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin: 0 auto 24px;
`

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: #000929;
  margin: 0 0 12px;
`

const Body = styled.p`
  color: #6b7280;
  font-size: 15px;
  line-height: 1.6;
  margin: 0 0 28px;
`

const Btn = styled.a`
  display: inline-block;
  background: #1d3c34;
  color: #fff;
  font-weight: 600;
  font-size: 15px;
  padding: 14px 28px;
  border-radius: 14px;
  text-decoration: none;
  margin: 4px;
  &:hover { opacity: 0.9; }
`

const BtnOutline = styled(Btn)`
  background: transparent;
  border: 1.5px solid #1d3c34;
  color: #1d3c34;
`

export default function StoragePaymentCancel() {

  return (
    <Page>
      <NextSeo title='Payment cancelled — BagBee' noindex />
      <TopBar>
        <Link href='/' aria-label='BagBee home'>
          <Logo />
        </Link>
      </TopBar>

      <Card>
        <Icon>✖</Icon>
        <Title>Payment cancelled</Title>
        <Body>
          No charge was made. Your booking has not been confirmed — you can
          go back and try again whenever you&apos;re ready.
        </Body>
        <div>
          <Btn href='/luggagestorage'>Try again</Btn>
          <BtnOutline href='/'>Back to home</BtnOutline>
        </div>
      </Card>
    </Page>
  )
}
