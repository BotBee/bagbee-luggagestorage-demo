import Header from '../../components/header/Header'
import Message from '../../components/message/Message'
import styled from '@emotion/styled'

import FrowningFace from '../../public/icons/FrowningFace'
import Button from '../../components/button/Button'
import Link from 'next/link'
import { GetStaticProps, InferGetStaticPropsType } from 'next'
import { getNavigation } from '../../modules/contentful/api'
import { useRouter } from 'next/router'
import { useState } from 'react'
import is from '../../common/locales/is'
import en from '../../common/locales/en'

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0 24px;
  height: calc(100vh - 100px);
  > div {
    margin-bottom: 24px;
  }
`

const ButtonStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 360px;
`

const SecondaryLink = styled(Link)`
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-weight: 500;
  font-size: 14px;
  text-align: center;
  color: ${({ theme }) => theme.colors.green};
  text-decoration: underline;
  margin-top: 8px;
`

const ErrorText = styled.p`
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-weight: 400;
  font-size: 14px;
  color: #d24343;
  text-align: center;
  margin-top: 8px;
`

type TableType = 'baggage' | 'fast-track'

const isValidType = (v: unknown): v is TableType =>
  v === 'baggage' || v === 'fast-track'

const Cancel = ({ navigation }: InferGetStaticPropsType<typeof getStaticProps>) => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is

  // Rapyd round-tripped here via error_payment_url. mapper.ts (and the retry
  // endpoint) embed recordId + tableType so we can offer a one-click retry
  // against the same Airtable order — no need to redo the wizard.
  const recordIdParam = router.query.recordId
  const recordId = typeof recordIdParam === 'string' ? recordIdParam : undefined
  const typeParam = router.query.type
  const tableType: TableType = isValidType(typeParam) ? typeParam : 'baggage'

  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const handleRetry = async () => {
    if (!recordId || retrying) return
    setRetrying(true)
    setRetryError(null)
    try {
      const res = await fetch('/api/rapyd/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, tableType, locale: locale ?? 'is' }),
      })
      const json = await res.json().catch(() => ({}))

      // The webhook may have flipped Greitt → true between the cancel and the
      // retry click — in that race, send them straight to the success page.
      if (res.status === 409 && json?.alreadyPaid) {
        router.push(`/payment/success?recordId=${encodeURIComponent(recordId)}`)
        return
      }

      if (!res.ok || !json?.redirectUrl) {
        setRetryError(t.cancelStep.retryError)
        setRetrying(false)
        return
      }

      // Hard-navigate to Rapyd's hosted checkout.
      window.location.href = json.redirectUrl
    } catch (err) {
      console.error('[payment/cancel] retry failed', err)
      setRetryError(t.cancelStep.retryError)
      setRetrying(false)
    }
  }

  return (
    <>
      <Header navigation={navigation.header} />
      <Container>
        <Message
          asset={<FrowningFace />}
          title={t.cancelStep.title}
          text={t.cancelStep.message}
        />
        <ButtonStack>
          {recordId ? (
            <>
              <Button onClick={handleRetry} loading={retrying} disabled={retrying} fullWidth>
                {t.cancelStep.retryButton}
              </Button>
              <SecondaryLink href='/book'>{t.cancelStep.startOverButton}</SecondaryLink>
            </>
          ) : (
            <Link href='/book'>
              <Button fullWidth>{t.cancelStep.backToBookingButton}</Button>
            </Link>
          )}
          {retryError && <ErrorText>{retryError}</ErrorText>}
        </ButtonStack>
      </Container>
    </>
  )
}

export const getStaticProps = (async ({ locale }) => {
  const navigation = await getNavigation({ locale: locale || '' })
  return {
    props: { navigation },
    revalidate: 86400,
  }
}) satisfies GetStaticProps

export default Cancel
