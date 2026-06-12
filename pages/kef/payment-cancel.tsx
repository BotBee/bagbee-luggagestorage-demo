import { NextSeo } from 'next-seo'
import Link from 'next/link'
import styled from '@emotion/styled'
import Logo from '../../public/icons/Logo'

const Page = styled.div`
  min-height: 100vh; background: linear-gradient(135deg, #fff8ec 0%, #ffeacc 100%);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Poppins', sans-serif; padding: 24px;
`
const TopBar = styled.header`position: fixed; top: 0; left: 0; padding: 20px 28px;`
const Card = styled.div`
  background: rgba(255,255,255,0.9); border-radius: 28px; padding: 48px 40px;
  max-width: 520px; width: 100%; text-align: center; box-shadow: 0 20px 60px -20px rgba(29,60,52,0.25);
`
const Icon = styled.div`
  width: 72px; height: 72px; border-radius: 50%; background: #fee2e2;
  display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 22px;
`
const Title = styled.h1`font-size: 26px; font-weight: 700; color: #000929; margin: 0 0 12px;`
const Body = styled.p`color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 26px;`
const Btn = styled.a`
  display: inline-block; background: #1d3c34; color: #fff; font-weight: 600; font-size: 15px;
  padding: 14px 28px; border-radius: 14px; text-decoration: none; margin: 4px; &:hover { opacity: 0.9; }
`
const BtnOutline = styled(Btn)`background: transparent; border: 1.5px solid #1d3c34; color: #1d3c34;`

export default function KefPaymentCancel() {
  return (
    <Page>
      <NextSeo title='Payment not completed — BagBee' noindex />
      <TopBar><Link href='/' aria-label='BagBee home'><Logo /></Link></TopBar>
      <Card>
        <Icon>✖</Icon>
        <Title>Payment not completed</Title>
        <Body>No charge was made. Your locker was not reserved — you can start a new booking whenever you&apos;re ready.</Body>
        <div>
          <Btn href='/embed/kef-lockers'>Start a new booking</Btn>
          <BtnOutline href='https://www.luggagelockers.is'>Back to Luggage Lockers</BtnOutline>
        </div>
      </Card>
    </Page>
  )
}
