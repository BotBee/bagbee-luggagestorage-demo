import styled from '@emotion/styled'
import { Error, FieldSet, Record } from 'airtable'
import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import { FormProvider, useForm } from 'react-hook-form'
import en from '../../../common/locales/en'
import is from '../../../common/locales/is'
import { Customer } from '../../../common/types'
import Button from '../../../components/button/Button'
import FormLayout from '../../../components/form/FormLayout'
import InfoBox from '../../../components/info-box/InfoBox'
import { Item } from '../../../components/info-box/InfoBox.types'
import { createOrder } from '../../../modules/AirTable/api'
import { makePayment } from '../../../modules/rapydAPI/methods'
import { useBookingStore } from '../../../store/store'
import {
  discountPrice,
  mapCurrencyToDisplay,
} from '../../../utils/pricing'
import { useContext, useEffect, useState } from 'react'
import { UserContext } from '../../../context/UserContext'
import TextInput from '../../../components/form/text-input/TextInput'
import toast, { Toaster } from 'react-hot-toast'
import { ApplicationRoutes } from '../../../utils/routing'
import dayjs from 'dayjs'

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

const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
`

const Label = styled.label`
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-weight: 400;
  font-size: 16px;
  line-height: 20px;
  display: flex;
  align-items: center;
  color: #8692a6;
  margin-bottom: 12px;
`

const DepartureNote = styled.div`
  background: #e8f5e9;
  border-radius: 12px;
  padding: 16px 24px;
  font-family: 'Poppins';
  font-size: 14px;
  line-height: 20px;
  color: #2e7d32;
  margin-bottom: 24px;
`

const ArrivalConfirmOrder = () => {
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
  const [discountCode, setDiscountCode] = useState<any>()
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

  const arrivalCheckoutPrice = bookingState.arrivalCheckoutPrice ?? {
    amount: 0,
    currency: 'ISK',
  }

  const mapToArrivalOrder = () => ({
    'Nafn viðskiptavinar': bookingState.customerInfo.name,
    Flugfélag: bookingState.arrivalFlightInformation?.airline.name || '',
    'Dagsetning flugs': dayjs(
      bookingState.arrivalFlightInformation?.departureDate
    ).format('YYYY/MM/DD'),
    'Dagsetning pick-up': dayjs(
      bookingState.arrivalFlightInformation?.departureDate
    ).format('YYYY/MM/DD'),
    Málstaðall: locale ?? '',
    Símanúmer: bookingState.customerInfo.phoneNumber,
    Flugnúmer:
      (bookingState.arrivalFlightInformation?.selectedFlight?.AirlineIATA ?? '') +
      (bookingState.arrivalFlightInformation?.selectedFlight?.FlightNumber?.replace(
        /^0/,
        ''
      ) ?? ''),
    Tímasetning: bookingState.arrivalInfo?.deliverySlot || '',
    Heimilisfang: bookingState.arrivalInfo?.deliveryAddress || '',
    'Delivery Address': bookingState.arrivalInfo?.deliveryAddress || '',
    'Annað (comment)': bookingState.arrivalInfo?.comments || '',
    'Hótel Nafn': bookingState.arrivalInfo?.deliveryHotelName || '',
    Tölvupóstfang: bookingState.customerInfo.email,
    Töskufjöldi_no:
      bookingState.arrivalBaggageInformation?.baggage.amount ?? 0,
    Töskufjöldi_no_yfirstærð:
      bookingState.arrivalBaggageInformation?.baggage.oddSizeAmount ?? 0,
    Áfangastaður:
      bookingState.arrivalFlightInformation?.departureAirport.name || '',
    Kennitala: bookingState.customerInfo.companyId,
    Greitt: false,
    Greiðslustaða: 'Ógreitt',
    Upphæð: discountPrice(
      arrivalCheckoutPrice.amount,
      bookingState.customerInfo.discountCode?.discount || 0
    ),
    Gengi: arrivalCheckoutPrice.currency,
    Tilvísun: referrer ?? '',
    'Discount Code': bookingState.customerInfo.discountCode?.code,
  })

  const onSubmit = async (values: Customer) => {
    updateCustomer(values)

    try {
      const order: Record<FieldSet> = await createOrder(
        mapToArrivalOrder()
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
        // Build a booking-like object for Rapyd payment using arrival prices
        const arrivalBookingForPayment = {
          ...bookingState,
          checkoutPrice: arrivalCheckoutPrice,
        }

        const result = await makePayment(
          order.id,
          arrivalBookingForPayment,
          locale ?? 'is'
        )

        router.push(result.body.data.redirect_url)
      } else {
        console.error('no record id present!', order)
      }
    } catch (error) {
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
        bookingState.arrivalFlightInformation?.selectedFlight?.FlightNumber ||
        '',
    },
    {
      title: 'Arrival date',
      value:
        bookingState.arrivalFlightInformation?.departureDate?.toLocaleDateString() ||
        '',
    },
    {
      title: 'Origin airport',
      value:
        bookingState.arrivalFlightInformation?.departureAirport.name || '',
    },
  ]

  const meetingPointDisplay =
    bookingState.arrivalInfo?.meetingPoint === 'customs_gate'
      ? 'Outside the customs gate'
      : 'At the luggage truck outside the terminal'

  const deliveryInformation: Item[] = [
    {
      title: t.bagSelectionStep.luggageText,
      value:
        bookingState.arrivalBaggageInformation?.baggage.amount ?? 0,
    },
    {
      title: t.bagSelectionStep.oddSizeText,
      value:
        bookingState.arrivalBaggageInformation?.baggage.oddSizeAmount ?? 0,
    },
    {
      title: 'Delivery address',
      value: bookingState.arrivalInfo?.deliveryAddress || '',
    },
    {
      title: 'Meeting point',
      value: meetingPointDisplay,
    },
    {
      title: 'Delivery window',
      value: bookingState.arrivalInfo?.deliverySlot || '',
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

  return (
    <>
      <FormProvider {...methods}>
        <Toaster toastOptions={{ style: { fontFamily: 'sans-serif' } }} />
        <NextSeo title='Bagbee | Confirm arrival order' />
        <FormLayout
          title={t.confirmOrderStep.title}
          text={t.confirmOrderStep.subtitle}
        >
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Note if departure was already booked */}
            {bookingState.serviceType === 'both' && (
              <DepartureNote>
                Departure service already booked
              </DepartureNote>
            )}

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
                title='Delivery information'
                data={deliveryInformation}
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
                  arrivalCheckoutPrice.amount,
                  arrivalCheckoutPrice.currency
                )}`}</Price>
                {bookingState.customerInfo.discountCode &&
                bookingState.customerInfo.discountCode.discount > 0 ? (
                  <Price>
                    {`${mapCurrencyToDisplay(
                      discountPrice(
                        arrivalCheckoutPrice.amount,
                        bookingState.customerInfo.discountCode.discount
                      ),
                      arrivalCheckoutPrice.currency
                    )}`}
                  </Price>
                ) : null}
              </div>
            </PriceContainer>

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

export default ArrivalConfirmOrder
