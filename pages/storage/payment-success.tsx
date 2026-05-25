import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { NextSeo } from 'next-seo'
import styled from '@emotion/styled'
import { keyframes } from '@emotion/react'
import axios from 'axios'

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const Page = styled.div`
  min-height: 100vh;
  background: #f7f8fa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Poppins', sans-serif;
  padding: 24px;
`

const Card = styled.div`
  background: #fff;
  border: 1px solid #e6e9ee;
  border-radius: 14px;
  padding: 48px 44px;
  max-width: 480px;
  width: 100%;
  text-align: center;
  animation: ${fadeIn} 0.5s ease both;
`

const Icon = styled.div`
  font-size: 40px;
  margin-bottom: 16px;
`

const Title = styled.h1`
  font-size: 22px;
  font-weight: 700;
  color: #0b0f1a;
  margin: 0 0 10px;
`

const Body = styled.p`
  color: #6b7280;
  font-size: 15px;
  line-height: 1.6;
  margin: 0;
`

export default function StoragePaymentSuccess() {
  const router = useRouter()
  const { bookingId } = router.query as { bookingId?: string }

  useEffect(() => {
    if (!bookingId) return
    axios
      .patch(`/api/storage/${bookingId}`, { 'Payment Status': 'Paid' })
      .finally(() => {
        // Always redirect to the order page — even if the PATCH fails the
        // rapyd-webhook will catch the payment and mark it Paid
        router.replace(`/storage/${bookingId}`)
      })
  }, [bookingId])

  return (
    <Page>
      <NextSeo title='Confirming payment — BagBee' noindex />
      <Card>
        <Icon>⏳</Icon>
        <Title>Confirming payment…</Title>
        <Body>Please wait, you&apos;ll be redirected to your booking in a moment.</Body>
      </Card>
    </Page>
  )
}
