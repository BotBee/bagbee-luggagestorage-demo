import { useEffect, useRef, useState } from 'react'
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

const MailLink = styled.a`
  display: inline-block;
  margin-top: 18px;
  color: #1D3C34;
  font-weight: 600;
  text-decoration: underline;
`

export default function StoragePaymentSuccess() {
  const router = useRouter()
  const { bookingId, kind } = router.query as { bookingId?: string; kind?: string }
  const [errored, setErrored] = useState(false)
  const ranRef = useRef(false)

  useEffect(() => {
    if (!router.isReady) return
    if (!bookingId) return
    // React 18 StrictMode mounts effects twice in dev — guard so we don't
    // double-fire the confirm-payment call.
    if (ranRef.current) return
    ranRef.current = true

    // Ask the server to verify with Rapyd that the payment actually went
    // through. For `kind=topup` (self-service edit), the server applies the
    // pending changes; otherwise it marks the booking Paid + writes
    // `Rapyd Payment ID` (needed for future refunds). If this call fails or
    // returns 409 (Rapyd hasn't captured yet), the webhook will catch up
    // within seconds — so we still redirect either way.
    const body = kind === 'topup' ? { bookingId, kind: 'topup' } : { bookingId }
    axios
      .post('/api/storage/confirm-payment', body)
      .finally(() => {
        router.replace(`/storage/${bookingId}`)
      })
  }, [router.isReady, bookingId, kind, router])

  // Safety net: if `bookingId` never arrives (stale URL, manual paste),
  // show a friendly error after a beat instead of spinning forever.
  useEffect(() => {
    if (!router.isReady) return
    if (bookingId) return
    const timeout = setTimeout(() => setErrored(true), 4000)
    return () => clearTimeout(timeout)
  }, [router.isReady, bookingId])

  if (errored) {
    return (
      <Page>
        <NextSeo title='Booking not found — BagBee' noindex />
        <Card>
          <Icon>⚠️</Icon>
          <Title>We couldn&apos;t find that booking</Title>
          <Body>
            The link you used may be incomplete. If you just paid, your booking
            should appear in your email. Otherwise, please contact us and
            we&apos;ll sort it out.
          </Body>
          <MailLink href='mailto:bagbee@bagbee.is'>bagbee@bagbee.is</MailLink>
        </Card>
      </Page>
    )
  }

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
