import styled from '@emotion/styled'
import { Error, FieldSet, Record } from 'airtable'
import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import { FormProvider, useForm } from 'react-hook-form'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import { mapToOrder } from '../../common/mapper'
import { Customer } from '../../common/types'
import Button from '../../components/button/Button'
import FormLayout from '../../components/form/FormLayout'
import InfoBox from '../../components/info-box/InfoBox'
import { Item } from '../../components/info-box/InfoBox.types'
import { createOrder } from '../../modules/AirTable/api'
import { makePayment } from '../../modules/rapydAPI/methods'
import { useBookingStore } from '../../store/store'
import { discountPrice, mapCurrencyToDisplay } from '../../utils/pricing'
import { useContext, useEffect, useState } from 'react'
import { UserContext } from '../../context/UserContext'
import { InputContainer, Label } from './personal-info'
import TextInput from '../../components/form/text-input/TextInput'
import toast, { Toaster } from 'react-hot-toast'
import { ApplicationRoutes } from '../../utils/routing'

const InfoBoxGrid = styled.div`
  display: grid;
  gap: 8px;
  margin-bottom: 24px;
`

const DiscountCodeContainer = styled.div`
  display: flex;
  gap: 16px;
  flex-direction: column;

  @media ${({ theme }) => theme.breakpoints.tablet} {
    flex-direction: row;
  }
`

const PriceContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 50px;
`

const PriceLabel = styled.p`
  font-weight: 400;
  font-size: 18px;
  line-height: 27px;
  display: flex;
  align-items: center;
  color: #000000;
`
const Price = styled.p<{ strikethrough?: boolean }>`
  font-weight: 600;
  font-size: 24px;
  line-height: 36px;
  color: #000000;
  text-decoration: ${(props) =>
    props.strikethrough ? 'line-through' : 'none'};
  opacity: ${(props) => (props.strikethrough ? 0.3 : 1)};
`

const ConfirmOrder = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const bookingState = useBookingStore((state) => state.booking)
  const updateCustomer = useBookingStore((state) => state.updateCustomer)
  const { referrer } = useContext(UserContext)
  const methods = useForm<Customer>({})

  const {
    handleSubmit,
    formState: { isSubmitting, isSubmitSuccessful },
  } = methods

  const [discountCodeFound, setDiscountCodeFound] = useState<
    boolean | undefined
  >()

  // eslint-disable-next-line no-unused-vars
  const [discountCode, setDiscountCode] = useState<any>()

  console.log('bookingState', bookingState)
  const onSubmit = async (values: Customer) => {
    updateCustomer(values)

    try {
      // Create order in Airtable with payment status incomplete
      const order: Record<FieldSet> = await createOrder(
        mapToOrder(bookingState, locale ?? '', referrer ?? '')
      ).catch((error: Error) => {
        console.error('error')
        throw new Error(error.error, error.message, error.statusCode)
      })
      // If discount code is 100% then route user directly to success page
      if (discountCode && discountCode.Discount === 100) {
        router.push(`${ApplicationRoutes.success}?recordId=${order.id}`)
        return
      }

      if (order && order.id) {
        // validateStore(router.asPath, bookingState)
        /** Send request to Rapyd */
        const result = await makePayment(order.id, bookingState, locale ?? 'is')

        /** Route user to Rapyd payment link */
        router.push(result.body.data.redirect_url)
      } else {
        // TODO: Add sentry and error page?
        console.error('no record id present!', order)
      }
    } catch (error) {
      // TODO: Add sentry
      console.error(error)
    }
  }

  const personalInformation: Item[] = [
    {
      title: t.contactInfoStep.fullNameLabel,
      value: bookingState.customerInfo.name,
    },
    {
      title: t.contactInfoStep.emailLabel,
      value: bookingState.customerInfo.email,
    },
    {
      title: t.contactInfoStep.phoneNumberLabel,
      value: bookingState.customerInfo.phoneNumber,
    },
  ]
  const flightInformation: Item[] = [
    {
      title: t.selectFlightStep.flightNumberText,
      value:
        bookingState?.flightInformation?.selectedFlight?.FlightNumber || '',
    },
    {
      title: t.departureDateStep.confirmTitle,
      value: bookingState.flightInformation.departureDate.toLocaleDateString(),
    },
    {
      title: t.airportStep.arrivalAirport,
      value: bookingState.flightInformation.arrivalAirport.name,
    },
  ]
  const pickUpInformation: Item[] = [
    {
      title: t.bagSelectionStep.luggageText,
      value: bookingState.baggageInformation.baggage.amount,
    },
    {
      title: t.bagSelectionStep.oddSizeText,
      value: bookingState.baggageInformation.baggage.oddSizeAmount,
    },
    {
      title: t.confirmOrderStep.pickUpItems.location,
      value: bookingState.pickupInformation.pickupLocation,
    },
    {
      title: t.confirmOrderStep.pickUpItems.time,
      value: bookingState.pickupInformation.pickupSlot,
    },
    {
      title: t.confirmOrderStep.pickUpItems.date,
      value: bookingState.pickupInformation.pickupDate.toLocaleDateString(),
    },
  ]

  const fetchDiscountFromAirtable = (code: string) => {
    // Disabled in demo: the previous implementation shipped a raw Airtable
    // PAT to the client bundle. Move to a server API route before re-enabling.
    setIsFetching(false)
    setDiscountCodeFound(false)
    toast.error('Discount codes are temporarily unavailable.')
    void code
  }

  const [inputValue, setInputValue] = useState<string>('')
  const [isFetching, setIsFetching] = useState<boolean>(false)
  const pendingDiscountCode = useBookingStore(state => state.pendingDiscountCode)
  const setPendingDiscountCode = useBookingStore(state => state.setPendingDiscountCode)

  // Auto-apply discount code from prefilled URL (stored via bag-selection page)
  useEffect(() => {
    const code = (router.query.discount_code as string) || pendingDiscountCode
    if (code && !discountCodeFound && !isFetching) {
      setInputValue(code)
      fetchDiscountFromAirtable(code)
      setPendingDiscountCode(undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.discount_code, pendingDiscountCode])

  return (
    <>
      <FormProvider {...methods}>
        <Toaster toastOptions={{ style: { fontFamily: 'sans-serif' } }} />
        <NextSeo title='Bagbee | Confirm order' />
        <FormLayout
          title={t.confirmOrderStep.title}
          text={t.confirmOrderStep.subtitle}
        >
          <form onSubmit={handleSubmit(onSubmit)}>
            <InfoBoxGrid>
              <InfoBox
                title={t.confirmOrderStep.personalInformationTitle}
                data={personalInformation}
              />
              <InfoBox
                title={t.confirmOrderStep.flightDetailsTitle}
                data={flightInformation}
              />
              <InfoBox
                title={t.confirmOrderStep.pickUpInfoTitle}
                data={pickUpInformation}
              />
            </InfoBoxGrid>

            <InputContainer>
              <Label>{t.confirmOrderStep.discount.discountCode}</Label>
              <DiscountCodeContainer>
                <TextInput
                  placeholder={t.confirmOrderStep.discount.inputPlaceholder}
                  success={discountCodeFound}
                  error={discountCodeFound === false}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <Button
                  type='button'
                  loading={isFetching}
                  disabled={isFetching || !inputValue}
                  onClick={() => {
                    if (inputValue === '') {
                      setDiscountCodeFound(undefined)
                      return
                    }
                    return fetchDiscountFromAirtable(inputValue)
                  }}
                >
                  {t.confirmOrderStep.discount.apply}
                </Button>
              </DiscountCodeContainer>
            </InputContainer>

            <PriceContainer>
              <PriceLabel>{t.confirmOrderStep.totalPriceText}</PriceLabel>
              <div>
                <Price
                  strikethrough={discountCodeFound}
                >{`${mapCurrencyToDisplay(
                  bookingState.checkoutPrice.amount,
                  bookingState.checkoutPrice.currency
                )}`}</Price>
                {bookingState.customerInfo.discountCode &&
                bookingState.customerInfo.discountCode.discount > 0 ? (
                  <Price>
                    {`${mapCurrencyToDisplay(
                      discountPrice(
                        bookingState.checkoutPrice.amount,
                        bookingState.customerInfo.discountCode.discount
                      ),
                      bookingState.checkoutPrice.currency
                    )}`}
                  </Price>
                ) : null}
              </div>
            </PriceContainer>

            {/* TO DO: Validate state of booking before user can route to Rapyd */}
            <Button
              type='submit'
              disabled={isSubmitting || isSubmitSuccessful}
              fullWidth
              loading={isSubmitting || isSubmitSuccessful}
            >
              {t.confirmOrderStep.submitButton}
            </Button>
          </form>
        </FormLayout>
      </FormProvider>
    </>
  )
}

export default ConfirmOrder
