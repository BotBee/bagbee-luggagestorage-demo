import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styled from '@emotion/styled'
import { keyframes } from '@emotion/react'

/**
 * Co-branded payment hand-off — shown ONLY for partner-popup checkouts
 * (luggagelockers.is, bikerent.is) between the booking form and Rapyd's hosted
 * checkout. It reassures the customer that their partner booking is paid
 * securely through BagBee, then redirects to Rapyd.
 *
 * Query:
 *   to     = the Rapyd checkout URL to continue to (only *.rapyd.net allowed)
 *   source = 'luggage-lockers' | 'bikerent'  (drives the partner wordmark)
 *
 * Safe by construction: it will only ever redirect to a rapyd.net host. Anything
 * else falls back to a manual link.
 */

const PARTNERS: Record<string, { name: string; color: string; sub: string }> = {
  'luggage-lockers': { name: 'Luggage Lockers', color: '#1f6feb', sub: 'BSÍ Bus Terminal · Reykjavík' },
  bikerent: { name: 'Bike Rent Iceland', color: '#0f9d58', sub: 'BSÍ Bus Terminal · bike-box storage' },
}

const isRapydUrl = (u: string): boolean => {
  try {
    const url = new URL(u)
    return url.protocol === 'https:' && /(^|\.)rapyd\.net$/.test(url.hostname)
  } catch {
    return false
  }
}

const fade = keyframes`from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; }`
const spin = keyframes`to { transform: rotate(360deg); }`

const Page = styled.div`
  min-height: 100vh;
  background: #f4f6f9;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-family: 'Poppins', Arial, sans-serif;
`
const Card = styled.div`
  background: #fff;
  border: 1px solid #eceef2;
  border-radius: 24px;
  box-shadow: 0 24px 70px -28px rgba(18, 20, 29, 0.28);
  padding: 40px 34px;
  width: 100%;
  max-width: 460px;
  text-align: center;
  animation: ${fade} 0.5s ease both;
`
const Lockup = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 28px;
`
const Wordmark = styled.span<{ $color: string }>`
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 18px;
  line-height: 1.05;
  color: ${({ $color }) => $color};
  max-width: 150px;
  text-align: right;
`
const Times = styled.span`
  color: #c2c8d2;
  font-size: 18px;
  font-weight: 400;
`
const CoBrand = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`
const Logo = styled.img`
  height: 26px;
  width: auto;
  display: block;
`
const Tag = styled.span`
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #9aa3b2;
`
const Spinner = styled.div`
  width: 40px;
  height: 40px;
  margin: 4px auto 22px;
  border: 3px solid #e6e9ef;
  border-top-color: #12141d;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`
const Title = styled.h1`
  font-size: 20px;
  font-weight: 600;
  color: #12141d;
  margin: 0 0 8px;
`
const Body = styled.p`
  font-size: 14px;
  color: #6b7280;
  line-height: 1.55;
  margin: 0 0 20px;
`
const Lock = styled.p`
  font-size: 12px;
  color: #9aa3b2;
  margin: 0 0 6px;
`
const Manual = styled.a`
  font-size: 13px;
  color: #1f6feb;
  text-decoration: none;
  font-weight: 600;
  &:hover { text-decoration: underline; }
`
const ErrorBody = styled.p`
  font-size: 14px;
  color: #b91c1c;
  line-height: 1.55;
  margin: 8px 0 0;
`

export default function PaymentHandoff() {
  const router = useRouter()
  const [tooSlow, setTooSlow] = useState(false)

  const { to, partner } = useMemo(() => {
    const rawTo = typeof router.query.to === 'string' ? router.query.to : ''
    const src = typeof router.query.source === 'string' ? router.query.source : ''
    return {
      to: rawTo && isRapydUrl(rawTo) ? rawTo : '',
      partner: PARTNERS[src] || { name: 'BagBee', color: '#12141d', sub: '' },
    }
  }, [router.query.to, router.query.source])

  useEffect(() => {
    if (!router.isReady || !to) return
    // ?preview=1 freezes the screen (no redirect) for design review.
    if (router.query.preview === '1') return
    const go = setTimeout(() => {
      window.location.href = to
    }, 1700)
    const slow = setTimeout(() => setTooSlow(true), 4000)
    return () => {
      clearTimeout(go)
      clearTimeout(slow)
    }
  }, [router.isReady, to])

  const ready = router.isReady

  return (
    <Page>
      <Head>
        <title>Taking you to secure payment — BagBee</title>
        <meta name='robots' content='noindex' />
      </Head>
      <Card>
        <Lockup>
          <Wordmark $color={partner.color}>{partner.name}</Wordmark>
          <Times>×</Times>
          <CoBrand>
            <Logo src='/images/bagbee-logo-green.svg' alt='BagBee' />
            <Tag>secure payments</Tag>
          </CoBrand>
        </Lockup>

        {ready && !to ? (
          <>
            <Title>Payment link missing</Title>
            <ErrorBody>
              We couldn&apos;t start your payment. Please go back and try again.
            </ErrorBody>
          </>
        ) : (
          <>
            <Spinner />
            <Title>Taking you to secure payment…</Title>
            <Body>
              Your {partner.name} booking is processed securely by BagBee. You&apos;ll be
              redirected to our payment provider in a moment.
            </Body>
            <Lock>🔒 Powered by Rapyd</Lock>
            {tooSlow && to && (
              <Manual href={to}>Not redirected? Continue to payment →</Manual>
            )}
          </>
        )}
      </Card>
    </Page>
  )
}
