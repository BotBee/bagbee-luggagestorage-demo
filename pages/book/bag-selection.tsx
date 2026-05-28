import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import Button from '../../components/button/Button'
import FormLayout from '../../components/form/FormLayout'
import PriceCalculator from '../../components/price-calculator/PriceCalculator'
import { useBookingStore } from '../../store/store'
import { validateStore } from '../../store/validateStore'
import styled from '@emotion/styled'

import { hydrateBookingFromDeepLinkQuery } from '../../utils/hydrateBookingFromDeepLinkQuery'
import { calculateCheckoutPrice } from '../../utils/pricing'
import { ApplicationRoutes } from '../../utils/routing'

const ButtonContainer = styled.div`
  margin-top: 50px;
`
const BagSelection = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const bookingState = useBookingStore((state) => state.booking)
  const [deepLinkReady, setDeepLinkReady] = useState(false)

  useEffect(() => {
    if (!router.isReady) return

    let cancelled = false

    void (async () => {
      const result = await hydrateBookingFromDeepLinkQuery(router.query, router.locale)
      if (cancelled) return
      if (result === 'redirect') {
        router.replace(ApplicationRoutes.pages.book)
      }
      setDeepLinkReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [
    router.isReady,
    router.locale,
    router.query.airline_code,
    router.query.airline_flight_number,
    router.query.flight_date,
    router.query.bags,
    router.query.odd_bags,
    router.query.discount_code,
    router.query.name,
    router.query.customer_name,
    router.query.email,
    router.query.phone,
    router.query.address,
    router,
  ])

  useEffect(() => {
    if (!router.isReady || !deepLinkReady) return
    if (!validateStore(router.asPath, bookingState)) {
      router.push(ApplicationRoutes.pages.book)
    }
  }, [bookingState, deepLinkReady, router])

  const updateCheckoutPrice = useBookingStore((state) => state.updateCheckoutPrice)
  const numberOfBags = bookingState.baggageInformation.baggage.amount
  const numberOfOddsize = bookingState.baggageInformation.baggage.oddSizeAmount
  const onSubmit = async () => {
    const price = calculateCheckoutPrice(numberOfBags, numberOfOddsize)
    updateCheckoutPrice({
      amount: price,
      currency: bookingState.checkoutPrice.currency,
    })
    router.push(ApplicationRoutes.pages.pickUp)
  }

  return (
    <>
      <FormLayout title={t.bagSelectionStep.title} text={t.bagSelectionStep.subtitle}>
        <NextSeo title="Bagbee | Luggage items" />
        <PriceCalculator hideTitle hideButton />
        <ButtonContainer>
          <Button
            type="submit"
            fullWidth
            onClick={onSubmit}
            disabled={numberOfBags + numberOfOddsize < 1}
          >
            {t.bagSelectionStep.submitButton}
          </Button>
        </ButtonContainer>
      </FormLayout>
    </>
  )
}

export default BagSelection
