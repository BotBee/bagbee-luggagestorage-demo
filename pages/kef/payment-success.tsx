import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { NextSeo } from 'next-seo'
import Link from 'next/link'
import styled from '@emotion/styled'
import { keyframes } from '@emotion/react'
import axios from 'axios'
import Logo from '../../public/icons/Logo'

const fadeIn = keyframes`from { opacity:0; transform: translateY(16px);} to {opacity:1; transform:none;}`

const Page = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #eaf7ef 0%, #e6f0ff 100%);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Poppins', sans-serif; padding: 24px;
`
const TopBar = styled.header`position: fixed; top: 0; left: 0; padding: 20px 28px;`
const Card = styled.div`
  background: rgba(255,255,255,0.9); border-radius: 28px; padding: 48px 40px;
  max-width: 540px; width: 100%; text-align: center;
  box-shadow: 0 24px 70px -28px rgba(18,20,29,0.28); animation: ${fadeIn} 0.5s ease both;
`
const Icon = styled.div`
  width: 72px; height: 72px; border-radius: 50%; background: #d8f3e1;
  display: flex; align-items: center; justify-content: center; font-size: 34px; margin: 0 auto 22px;
`
const Title = styled.h1`font-size: 26px; font-weight: 700; color: #000929; margin: 0 0 12px;`
const Body = styled.p`color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 26px;`
const Btn = styled.a`
  display: inline-block; background: #1d3c34; color: #fff; font-weight: 600; font-size: 15px;
  padding: 14px 28px; border-radius: 14px; text-decoration: none; margin: 4px; &:hover { opacity: 0.9; }
`
const BtnOutline = styled(Btn)`background: transparent; border: 1.5px solid #1d3c34; color: #1d3c34;`

export default function KefPaymentSuccess() {
  const router = useRouter()
  const [manageUrl, setManageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!router.isReady) return
    const bookingId = router.query.bookingId as string | undefined
    if (!bookingId) return
    // Fire the confirmation email (safety net for a slow webhook) and fetch the
    // booking number so we can show the manage link right here too.
    axios.post('/api/kef/confirm-payment', { bookingId }).catch(() => undefined)
    axios
      .get(`/api/kef/${bookingId}`)
      .then(({ data }) => {
        if (data?.bookingNumber) setManageUrl(`/kef/${data.bookingNumber}`)
      })
      .catch(() => undefined)
  }, [router.isReady, router.query.bookingId])

  return (
    <Page>
      <NextSeo title='Booking confirmed — BagBee' noindex />
      <TopBar><Link href='/' aria-label='BagBee home'><Logo /></Link></TopBar>
      <Card>
        <Icon>🚲</Icon>
        <Title>Your bike-box locker is booked</Title>
        <Body>
          Payment received — thank you! We&apos;ll email your <strong>locker number and
          PIN code</strong> a few hours before your drop-off window, and a confirmation
          with your booking details is on its way now.
        </Body>
        <div>
          {manageUrl && <Btn href={manageUrl}>View or change your booking</Btn>}
          <BtnOutline href='https://www.luggagelockers.is'>Back to Luggage Lockers</BtnOutline>
        </div>
      </Card>
    </Page>
  )
}
