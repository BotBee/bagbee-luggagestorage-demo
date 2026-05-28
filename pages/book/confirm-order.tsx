import styled from '@emotion/styled'
import { Error, FieldSet, Record } from 'airtable'
import { useRouter } from 'next/router'
import { NextSeo } from 'next-seo'
import { useContext, useEffect, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import toast, { Toaster } from 'react-hot-toast'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import { mapToOrder } from '../../common/mapper'
import { Customer } from '../../common/types'
import Button from '../../components/button/Button'
import FormLayout from '../../components/form/FormLayout'
import TextInput from '../../components/form/text-input/TextInput'
import InfoBox from '../../components/info-box/InfoBox'
import { Item } from '../../components/info-box/InfoBox.types'
import { UserContext } from '../../context/UserContext'
import { createOrder, validateDiscountCode } from '../../modules/AirTable/api'
import { makePayment } from '../../modules/rapydAPI/methods'
import { useBookingStore } from '../../store/store'
import { discountPrice, mapCurrencyToDisplay } from '../../utils/pricing'
import { ApplicationRoutes } from '../../utils/routing'
import { InputContainer, Label } from './personal-info'

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
  text-decoration: ${(props) => (props.strikethrough ? 'line-through' : 'none')};
  opacity: ${(props) => (props.strikethrough ? 0.3 : 1)};
`

const DiscountCodeButton = styled.button`
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.green};
  margin-bottom: 24px;
  &:hover {
    color: ${({ theme }) => theme.colors.yellow};
    text-decoration: underline;
  }
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

  const [discountCodeFound, setDiscountCodeFound] = useState<boolean | undefined>()
  const [showDiscountCodeInput, setShowDiscountCodeInput] = useState<boolean>(false)

  // eslint-disable-next-line no-unused-vars
  const [discountCode, setDiscountCode] = useState<any>()

  useEffect(() => {
    const d = bookingState.customerInfo.discountCode
    if (d && d.discount > 0) {
      setDiscountCodeFound(true)
      setDiscountCode({ Discount: d.discount })
    } else {
      setDiscountCodeFound(undefined)
      setDiscountCode(undefined)
    }
  }, [bookingState.customerInfo.discountCode])

  const onSubmit = async (values: Customer) => {
    updateCustomer(values)

    try {
      // Create order in Airtable with payment status incomplete
      const order: Record<FieldSet> = await createOrder(
        mapToOrder(bookingState, locale ?? '', referrer ?? ''),
      ).catch((error: Error) => {
        console.error('error')
        throw new Error(error.error, error.message, error.statusCode)
      })
      // If discount code is 100% then route user directly to success page
      if (useBookingStore.getState().booking.customerInfo.discountCode?.discount === 100) {
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
      value: bookingState?.flightInformation?.selectedFlight?.FlightNumber || '',
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

  const fetchDiscountCode = async (code: string) => {
    setIsFetching(true)
    try {
      const result = await validateDiscountCode(code)

      if (!result.valid) {
        setDiscountCodeFound(false)
        setDiscountCode(undefined)
        toast.error(t.confirmOrderStep.discount.discountCodeInvalid)
        updateCustomer({
          ...bookingState.customerInfo,
          discountCode: undefined,
        })
        return
      }

      // Successfully found an active discount code
      updateCustomer({
        ...bookingState.customerInfo,
        discountCode: {
          code: result.code || '',
          discount: result.discount || 0,
        },
      })
      setDiscountCode({ Discount: result.discount })
      setDiscountCodeFound(true)
      toast.success(`${t.confirmOrderStep.discount.discountCodeSuccessfullyAdded} ${result.discount}%`)
    } catch (error) {
      console.error(error)
      setDiscountCodeFound(false)
      toast.error(t.confirmOrderStep.discount.errorValidatingDiscountCode)
    } finally {
      setIsFetching(false)
    }
  }

  const [inputValue, setInputValue] = useState<string>('')
  const [isFetching, setIsFetching] = useState<boolean>(false)

  return (
    <FormProvider {...methods}>
      <Toaster toastOptions={{ style: { fontFamily: 'sans-serif' } }} />
      <NextSeo title="Bagbee | Confirm order" />
      <FormLayout title={t.confirmOrderStep.title} text={t.confirmOrderStep.subtitle}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <InfoBoxGrid>
            <InfoBox
              title={t.confirmOrderStep.personalInformationTitle}
              data={personalInformation}
            />
            <InfoBox title={t.confirmOrderStep.flightDetailsTitle} data={flightInformation} />
            <InfoBox title={t.confirmOrderStep.pickUpInfoTitle} data={pickUpInformation} />
          </InfoBoxGrid>

          {showDiscountCodeInput && (
            <InputContainer>
              <Label>{t.confirmOrderStep.discount.discountCode}</Label>
              <DiscountCodeContainer>
                <TextInput
                  placeholder={t.confirmOrderStep.discount.inputPlaceholder}
                  success={discountCodeFound}
                  error={discountCodeFound === false}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <Button
                  type="button"
                  loading={isFetching}
                  disabled={isFetching || !inputValue}
                  onClick={() => {
                    if (inputValue === '') {
                      setDiscountCodeFound(undefined)
                      return
                    }
                    fetchDiscountCode(inputValue)
                  }}
                >
                  {t.confirmOrderStep.discount.apply}
                </Button>
              </DiscountCodeContainer>
            </InputContainer>
          )}

          <DiscountCodeButton
            type="button"
            onClick={() => setShowDiscountCodeInput((prev) => !prev)}
          >
            {showDiscountCodeInput
              ? t.confirmOrderStep.discount.iDontHaveDiscountCode
              : t.confirmOrderStep.discount.iHaveDiscountCode}
          </DiscountCodeButton>

          <PriceContainer>
            <PriceLabel>{t.confirmOrderStep.totalPriceText}</PriceLabel>
            <div>
              <Price strikethrough={discountCodeFound}>{`${mapCurrencyToDisplay(
                bookingState.checkoutPrice.amount,
                bookingState.checkoutPrice.currency,
              )}`}</Price>
              {bookingState.customerInfo.discountCode &&
              bookingState.customerInfo.discountCode.discount > 0 ? (
                <Price>
                  {`${mapCurrencyToDisplay(
                    discountPrice(
                      bookingState.checkoutPrice.amount,
                      bookingState.customerInfo.discountCode.discount,
                    ),
                    bookingState.checkoutPrice.currency,
                  )}`}
                </Price>
              ) : null}
            </div>
          </PriceContainer>

          {/* TO DO: Validate state of booking before user can route to Rapyd */}
          <Button
            type="submit"
            disabled={isSubmitting || isSubmitSuccessful}
            fullWidth
            loading={isSubmitting || isSubmitSuccessful}
          >
            {t.confirmOrderStep.submitButton}
          </Button>
        </form>
      </FormLayout>
    </FormProvider>
  )
}

export default ConfirmOrder
