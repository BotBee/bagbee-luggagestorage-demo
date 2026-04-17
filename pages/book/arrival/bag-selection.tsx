import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import { airlines } from '../../../common/airlines'
import en from '../../../common/locales/en'
import is from '../../../common/locales/is'
import Button from '../../../components/button/Button'
import FormLayout from '../../../components/form/FormLayout'
import InfoText from '../../../components/info-text/InfoText'
import { useBookingStore } from '../../../store/store'
import styled from '@emotion/styled'
import CalcMinus from '../../../public/icons/CalcMinus'
import CalcPlus from '../../../public/icons/CalcPlus'

import {
  calculateCheckoutPrice,
  mapCurrencyToDisplay,
} from '../../../utils/pricing'
import { ApplicationRoutes } from '../../../utils/routing'

const ButtonContainer = styled.div`
  margin-top: 50px;
`

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

const ArrivalBagSelection = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const bookingState = useBookingStore((state) => state.booking)

  const updateArrivalBaggage = useBookingStore(
    (state) => state.updateArrivalBaggage
  )
  const updateArrivalOddsize = useBookingStore(
    (state) => state.updateArrivalOddsize
  )
  const updateArrivalCheckoutPrice = useBookingStore(
    (state) => state.updateArrivalCheckoutPrice
  )

  const numberOfBags =
    bookingState.arrivalBaggageInformation?.baggage.amount ?? 1
  const numberOfOddsize =
    bookingState.arrivalBaggageInformation?.baggage.oddSizeAmount ?? 0

  // eslint-disable-next-line no-unused-vars
  const increase = (func: (n: number) => void, state: number) => {
    if (state === 30) return
    func(state + 1)
  }

  // eslint-disable-next-line no-unused-vars
  const decrease = (func: (n: number) => void, state: number) => {
    if (state === 0) return
    func(state - 1)
  }

  const onSubmit = async () => {
    const price = calculateCheckoutPrice(numberOfBags, numberOfOddsize, 'arrival')
    updateArrivalCheckoutPrice({
      amount: price,
      currency: bookingState.arrivalCheckoutPrice?.currency || 'ISK',
    })
    router.push(ApplicationRoutes.arrival.delivery)
  }

  return (
    <>
      <FormLayout
        title={t.bagSelectionStep.title}
        text={t.bagSelectionStep.subtitle}
      >
        <NextSeo title='Bagbee | Arrival luggage items' />

        {bookingState.arrivalFlightInformation?.airline.iata ===
          airlines.icelandAir.iata && (
          <InfoText>{t.bagSelectionStep.infoBanner}</InfoText>
        )}

        <Container>
          {/* BAGS */}
          <div>
            <Label>{t.bagSelectionStep.luggageText}</Label>
            <CalculatorContainer>
              <QuantitySelector>
                <button
                  onClick={() => decrease(updateArrivalBaggage, numberOfBags)}
                >
                  <CalcMinus />
                </button>
                <NumberOfBags>{numberOfBags}</NumberOfBags>
                <button
                  onClick={() => increase(updateArrivalBaggage, numberOfBags)}
                >
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
                <button
                  onClick={() =>
                    decrease(updateArrivalOddsize, numberOfOddsize)
                  }
                >
                  <CalcMinus />
                </button>
                <NumberOfBags>{numberOfOddsize}</NumberOfBags>
                <button
                  onClick={() =>
                    increase(updateArrivalOddsize, numberOfOddsize)
                  }
                >
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
            <Label
              style={{ fontWeight: 600, fontSize: '20px', lineHeight: '42px' }}
            >
              {mapCurrencyToDisplay(
                calculateCheckoutPrice(numberOfBags, numberOfOddsize, 'arrival'),
                bookingState.arrivalCheckoutPrice?.currency || 'ISK'
              )}
            </Label>
          </PriceContainer>
        </Container>

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

export default ArrivalBagSelection
