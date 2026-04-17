import { useRouter } from 'next/router'
import {
  usePlacesWidget,
  ReactGoogleAutocompleteProps,
} from 'react-google-autocomplete'
import { FormProvider, useForm } from 'react-hook-form'
import { Customer } from '../../common/types'
import Button from '../../components/button/Button'
import FormLayout from '../../components/form/FormLayout'
import TextInput from '../../components/form/text-input/TextInput'
import { useBookingStore } from '../../store/store'
import styled from '@emotion/styled'
import TextArea from '../../components/form/text-area/TextArea'
import InfoText from '../../components/info-text/InfoText'
import { ApplicationRoutes } from '../../utils/routing'
import { useEffect } from 'react'
import { validateStore } from '../../store/validateStore'
import { NextSeo } from 'next-seo'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import AvailablePickupTimes from '../../components/available-pickup-times/AvailablePickupTimes'

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

const PickUp = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  // Initialize googlemaps script
  const bookingState = useBookingStore((state) => state.booking)

  useEffect(() => {
    if (!validateStore(router.asPath, bookingState)) {
      router.push(ApplicationRoutes.pages.book)
    }
  }, [bookingState, router])

  const updatePickUpLocation = useBookingStore(
    (state) => state.updatePickupLocation
  )
  const updatePostalCode = useBookingStore((state) => state.updatePostalCode)
  const updateComments = useBookingStore((state) => state.updateComments)
  const methods = useForm<Customer>({})
  const { handleSubmit } = methods
  const onSubmit = async () => {
    if (
      !bookingState.pickupInformation.pickupLocation ||
      !bookingState.pickupInformation.pickupSlot
    )
      return
    router.push(ApplicationRoutes.pages.personalInfo)
  }

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

      // Extract postal code from address components
      // @ts-ignore
      const postalComponent = place.address_components?.find(
        // @ts-ignore
        (component: any) => component.types.includes('postal_code')
      )
      updatePostalCode(postalComponent?.long_name ?? '')

      return updatePickUpLocation(place.formatted_address ?? '', hotelName[0])
    },
  })

  // dayBeforeDeparture is used when the user has a morning flight and will get a bag pick up the day before his departure
  let dayBeforeDeparture: Date = new Date(
    bookingState.flightInformation.departureDate
  )
  dayBeforeDeparture.setDate(
    bookingState.flightInformation.departureDate.getDate() - 1
  )

  return (
    <>
      <FormProvider {...methods}>
        <NextSeo title='Bagbee | Pick up details' />
        <FormLayout title={t.pickUpStep.title} text={t.pickUpStep.subtitle}>
          <StyledForm onSubmit={handleSubmit(onSubmit)}>
            <div>
              <Label>{t.pickUpStep.addressLabel}</Label>

              <TextInput
                // It seems the ref provided by usePlacesWidget is wrongly typed..
                // @ts-ignore
                ref={ref}
                placeholder={
                  bookingState.pickupInformation.pickupLocation &&
                  bookingState.pickupInformation.pickupLocation
                }
                onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  // To prevent bugs that occur when user submits with the enter key. Doesn't always work... 🙄
                  e.key === 'Enter' && e.preventDefault()
                }}
                onChange={(e: any) => {
                  updatePickUpLocation(e.target.value, '')
                  updatePostalCode('')
                }}
              />
            </div>
            <div>
              <Label>{t.pickUpStep.pickUpTimeLabel}</Label>
              <InfoText>{t.pickUpStep.pickUpInfoBox}</InfoText>
              <div>
                <AvailablePickupTimes />
              </div>
              <Label>{t.pickUpStep.commentLabel}</Label>
              <TextArea
                placeholder={bookingState.pickupInformation.comments || ''}
                onChange={(e: any) => updateComments(e.target.value)}
                maxLength={500}
              />
            </div>
            <div></div>
            <Button
              type='submit'
              disabled={
                !bookingState.pickupInformation.pickupLocation ||
                !bookingState.pickupInformation.pickupSlot
              }
              fullWidth
            >
              {t.pickUpStep.submitButton}
            </Button>
          </StyledForm>
        </FormLayout>
      </FormProvider>
    </>
  )
}

export default PickUp
