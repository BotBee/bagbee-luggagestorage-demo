import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { airlines } from '../../common/airlines'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import Button from '../../components/button/Button'
import FormLayout from '../../components/form/FormLayout'
import InfoText from '../../components/info-text/InfoText'
import PriceCalculator from '../../components/price-calculator/PriceCalculator'
import { useBookingStore } from '../../store/store'
import { validateStore } from '../../store/validateStore'
import styled from '@emotion/styled'

import { calculateCheckoutPrice } from '../../utils/pricing'
import { ApplicationRoutes } from '../../utils/routing'

const ButtonContainer = styled.div`
  margin-top: 50px;
`
const BagSelection = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const bookingState = useBookingStore(state => state.booking)
  const setPendingDiscountCode = useBookingStore(state => state.setPendingDiscountCode)

  useEffect(() => {
    if (!validateStore(router.asPath, bookingState)) {
      router.push(ApplicationRoutes.pages.book)
    }
  }, [bookingState, router])

  // Store discount code from URL for later use on confirm-order page
  useEffect(() => {
    const discountCode = router.query.discount_code as string | undefined
    if (discountCode) {
      setPendingDiscountCode(discountCode)
    }
  }, [router.query.discount_code, setPendingDiscountCode])

  const updateCheckoutPrice = useBookingStore(
    state => state.updateCheckoutPrice
  )
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
      <FormLayout
        title={t.bagSelectionStep.title}
        text={t.bagSelectionStep.subtitle}
      >
        <NextSeo title='Bagbee | Luggage items' />

        {bookingState.flightInformation.airline.iata ===
          airlines.icelandAir.iata && (
          <InfoText>{t.bagSelectionStep.infoBanner}</InfoText>
        )}

        <PriceCalculator hideTitle hideButton />
        <ButtonContainer>
          <Button
            type='submit'
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
