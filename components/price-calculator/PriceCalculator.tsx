import styled from '@emotion/styled'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useEffect } from 'react'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import CalcMinus from '../../public/icons/CalcMinus'
import CalcPlus from '../../public/icons/CalcPlus'
import { useBookingStore } from '../../store/store'
import {
  calculateCheckoutPrice,
  mapCurrencyToDisplay,
} from '../../utils/pricing'
import { ApplicationRoutes } from '../../utils/routing'
import Button from '../button/Button'

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
  background: #ffffff;
  border-radius: 20px;
  width: 100%;
  padding: 32px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    padding: 52px;
  }
`

const Title = styled.p`
  font-weight: 600;
  font-size: 20px;
  line-height: 42px;
  color: #12141d;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    font-size: 28px;
  }
`

const CalculatorContainer = styled.div`
  display: flex;
  justify-content: center;
  border: 1px solid ${({ theme }) => theme.colors.yellow};
  border-radius: 20px;
  padding: 0 32px;
  align-items: center;
`
const QuantitySelector = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: max-content max-content max-content;
  gap: 24px;
  justify-content: center;
  align-items: center;
`
const NumberOfBags = styled.p`
  font-weight: 600;
  font-size: 80px;
  color: ${({ theme }) => theme.colors.black};
`
const PriceContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const PriceText = styled.p`
  font-weight: 400;
  font-size: 20px;
  line-height: 30px;
  color: #a3a4a7;
`

const Label = styled.p`
  margin-bottom: 12px;
  font-weight: 500;
`

const TotalBags = styled(Label)`
  margin-top: 12px;
  margin-bottom: -12px;
`
interface IPriceCalculator {
  hideTitle?: boolean
  hideButton?: boolean
}

const PriceCalculator = ({ hideTitle, hideButton }: IPriceCalculator) => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const bookingState = useBookingStore((state) => state.booking)
  const handleBaggage = useBookingStore((state) => state.handleBaggage)
  const handleOddsize = useBookingStore((state) => state.handleOddsize)

  const numberOfBags = bookingState.baggageInformation.baggage.amount
  const numberOfOddsize = bookingState.baggageInformation.baggage.oddSizeAmount
  useEffect(() => {}, [numberOfBags, numberOfOddsize])
  // eslint-disable-next-line no-unused-vars
  const increase = (func: (amount: number) => void, state: number) => {
    if (state == 30) {
      return
    }
    func(state + 1)
  }
  // eslint-disable-next-line no-unused-vars
  const decrease = (func: (amount: number) => void, state: number) => {
    if (state == 0) {
      return
    }
    func(state - 1)
  }

  return (
    <Container>
      {!hideTitle && <Title>{t.priceCalculator.title}</Title>}
      {/* BAGS */}
      <div>
        <Label>{t.bagSelectionStep.luggageText}</Label>
        <CalculatorContainer>
          <QuantitySelector>
            <button onClick={() => decrease(handleBaggage, numberOfBags)}>
              <CalcMinus />
            </button>
            <NumberOfBags>{numberOfBags}</NumberOfBags>
            <button onClick={() => increase(handleBaggage, numberOfBags)}>
              <CalcPlus />
            </button>
          </QuantitySelector>
        </CalculatorContainer>
      </div>
      {/* ODDSIZE */}
      <div>
        <Label>{t.bagSelectionStep.oddSizeText}</Label>
        <CalculatorContainer>
          <QuantitySelector>
            <button onClick={() => decrease(handleOddsize, numberOfOddsize)}>
              <CalcMinus />
            </button>
            <NumberOfBags>{numberOfOddsize}</NumberOfBags>
            <button onClick={() => increase(handleOddsize, numberOfOddsize)}>
              <CalcPlus />
            </button>
          </QuantitySelector>
        </CalculatorContainer>
        <TotalBags>
          {t.bagSelectionStep.totalBags} {numberOfBags + numberOfOddsize}
        </TotalBags>
      </div>
      <PriceContainer>
        <PriceText>{t.bagSelectionStep.priceText}</PriceText>
        <Title>
          {mapCurrencyToDisplay(
            calculateCheckoutPrice(numberOfBags, numberOfOddsize),
            bookingState.checkoutPrice.currency
          )}
        </Title>
      </PriceContainer>
      {!hideButton && (
        <Link href={ApplicationRoutes.pages.book}>
          <Button fullWidth>
            {t.priceCalculator.landingPageCheckInButtonText}
          </Button>
        </Link>
      )}
    </Container>
  )
}

export default PriceCalculator
