import { useRouter } from 'next/router'
import {
  usePlacesWidget,
  ReactGoogleAutocompleteProps,
} from 'react-google-autocomplete'
import { FormProvider, useForm } from 'react-hook-form'
import Button from '../../../components/button/Button'
import FormLayout from '../../../components/form/FormLayout'
import TextInput from '../../../components/form/text-input/TextInput'
import { useBookingStore } from '../../../store/store'
import styled from '@emotion/styled'
import TextArea from '../../../components/form/text-area/TextArea'
import InfoText from '../../../components/info-text/InfoText'
import { ApplicationRoutes } from '../../../utils/routing'
import { useEffect, useMemo } from 'react'
import { NextSeo } from 'next-seo'

const Label = styled.label`
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-weight: 400;
  font-size: 16px;
  line-height: 20px;
  display: flex;
  align-items: center;
  color: #696f79;
  margin-bottom: 12px;
`

const StyledForm = styled.form`
  display: grid;
  gap: 32px;
`

const InfoCard = styled.div`
  background: #f8f9fa;
  border: 1px solid ${({ theme }) => theme.colors.greyLight};
  border-radius: 12px;
  padding: 16px 24px;
  font-family: 'Poppins';
  font-size: 14px;
  line-height: 20px;
  color: #12141d;

  strong {
    font-weight: 600;
    display: block;
    margin-bottom: 4px;
    color: #696f79;
    font-size: 13px;
  }
`

const ArrivalDelivery = () => {
  const router = useRouter()
  const bookingState = useBookingStore((state) => state.booking)
  const updateArrivalInfo = useBookingStore((state) => state.updateArrivalInfo)

  const methods = useForm({})
  const { handleSubmit } = methods

  // Calculate total bags for meeting point
  const totalBags =
    (bookingState.arrivalBaggageInformation?.baggage.amount ?? 0) +
    (bookingState.arrivalBaggageInformation?.baggage.oddSizeAmount ?? 0)

  const meetingPoint: 'customs_gate' | 'luggage_truck' =
    totalBags <= 10 ? 'customs_gate' : 'luggage_truck'

  const meetingPointText =
    meetingPoint === 'customs_gate'
      ? "We'll meet you outside the customs gate"
      : "We'll meet you at the luggage truck outside the terminal"

  // Calculate delivery window from landing time
  const deliverySlot = useMemo(() => {
    const selectedFlight =
      bookingState.arrivalFlightInformation?.selectedFlight
    if (!selectedFlight?.ScheduledDateTime) {
      return 'Delivery time will be confirmed'
    }

    const landingDate = new Date(selectedFlight.ScheduledDateTime)
    const landingHour = landingDate.getHours()

    if (landingHour < 13) {
      return 'Delivery between 14:00 - 16:00'
    } else if (landingHour < 17) {
      return 'Delivery between 17:00 - 22:00'
    } else {
      return 'Delivery next morning between 09:00 - 12:00'
    }
  }, [bookingState.arrivalFlightInformation?.selectedFlight])

  // Auto-update store with calculated meeting point and delivery slot
  useEffect(() => {
    updateArrivalInfo({
      meetingPoint,
      deliverySlot,
    })
  }, [meetingPoint, deliverySlot, updateArrivalInfo])

  // Google Places autocomplete for delivery address
  const { ref } = usePlacesWidget<ReactGoogleAutocompleteProps>({
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    options: {
      strictBounds: true,
      bounds: {
        north: 64.168864,
        south: 64.017664,
        east: 64.101766,
        west: 64.106564,
      },
      types: ['geocode', 'establishment'],
      componentRestrictions: { country: 'is' },
    },
    onPlaceSelected: (place) => {
      let hotelName = ['']
      if (ref.current) {
        // @ts-ignore
        const currentValue = ref.current?.value ?? []
        hotelName = currentValue ? currentValue.split(',') : ['']
      }

      updateArrivalInfo({
        deliveryAddress: place.formatted_address ?? '',
        deliveryHotelName: hotelName[0],
      })
    },
  })

  const onSubmit = async () => {
    if (!bookingState.arrivalInfo?.deliveryAddress) return
    router.push(ApplicationRoutes.arrival.personalInfo)
  }

  return (
    <>
      <FormProvider {...methods}>
        <NextSeo title='Bagbee | Delivery details' />
        <FormLayout
          title='Where should we deliver your bags?'
          text="We'll deliver to your hotel or address in Reykjavik"
        >
          <StyledForm onSubmit={handleSubmit(onSubmit)}>
            {/* Delivery address */}
            <div>
              <Label>Hotel or delivery address</Label>
              <TextInput
                // @ts-ignore
                ref={ref}
                placeholder={
                  bookingState.arrivalInfo?.deliveryAddress ||
                  'Search for a hotel or address...'
                }
                onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  e.key === 'Enter' && e.preventDefault()
                }}
                onChange={(e: any) => {
                  updateArrivalInfo({
                    deliveryAddress: e.target.value,
                    deliveryHotelName: '',
                  })
                }}
              />
            </div>

            {/* Meeting point info */}
            <div>
              <Label>Meeting point</Label>
              <InfoText>{meetingPointText}</InfoText>
            </div>

            {/* Delivery window info */}
            <div>
              <Label>Delivery window</Label>
              <InfoCard>
                <strong>Estimated delivery time</strong>
                {deliverySlot}
              </InfoCard>
            </div>

            {/* Comments */}
            <div>
              <Label>
                Comments or special instructions for delivery
              </Label>
              <TextArea
                placeholder={
                  bookingState.arrivalInfo?.comments ||
                  'E.g. hotel room number, specific instructions...'
                }
                onChange={(e: any) =>
                  updateArrivalInfo({ comments: e.target.value })
                }
                maxLength={500}
              />
            </div>

            <Button
              type='submit'
              disabled={!bookingState.arrivalInfo?.deliveryAddress}
              fullWidth
            >
              Next step
            </Button>
          </StyledForm>
        </FormLayout>
      </FormProvider>
    </>
  )
}

export default ArrivalDelivery
