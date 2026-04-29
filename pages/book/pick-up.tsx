import { useRouter } from 'next/router'
import { FormProvider, useForm } from 'react-hook-form'
import { Customer } from '../../common/types'
import Button from '../../components/button/Button'
import FormLayout from '../../components/form/FormLayout'
import PlaceAutocompleteInput from '../../components/form/place-autocomplete-input/PlaceAutocompleteInput'
import { useBookingStore } from '../../store/store'
import styled from '@emotion/styled'
import TextArea from '../../components/form/text-area/TextArea'
import InfoText from '../../components/info-text/InfoText'
import { ApplicationRoutes } from '../../utils/routing'
import { useEffect, useState } from 'react'
import { validateStore } from '../../store/validateStore'
import { NextSeo } from 'next-seo'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import EcoLeaf from '../../public/icons/EcoLeaf'
import AvailablePickupTimes from '../../components/available-pickup-times/AvailablePickupTimes'
import { hydrateBookingFromDeepLinkQuery } from '../../utils/hydrateBookingFromDeepLinkQuery'

const Flexbox = styled.div`
  display: flex;
  margin-bottom: 50px;

  gap: 8px;
  label {
    font-weight: 400;
    font-size: 14px;
  }
`

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
  const bookingState = useBookingStore((state) => state.booking)

  const [pickupDeepLinkReady, setPickupDeepLinkReady] = useState(false)

  useEffect(() => {
    if (!router.isReady) return

    let cancelled = false

    void (async () => {
      const result = await hydrateBookingFromDeepLinkQuery(router.query, router.locale)
      if (cancelled) return
      if (result === 'redirect') {
        router.replace(ApplicationRoutes.pages.book)
      }
      setPickupDeepLinkReady(true)
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
    if (!router.isReady || !pickupDeepLinkReady) return
    if (!validateStore(router.asPath, bookingState)) {
      router.push(ApplicationRoutes.pages.book)
    }
  }, [bookingState, pickupDeepLinkReady, router])

  const updatePickUpLocation = useBookingStore(
    (state) => state.updatePickupLocation
  )
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

  const handlePlaceSelect = (
    address: string,
    placeName: string,
    postalCode: string,
  ) => {
    updatePickUpLocation(address, placeName, postalCode)
  }

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

              <PlaceAutocompleteInput
                apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}
                placeholder={t.pickUpStep.addressLabel}
                initialValue={bookingState.pickupInformation.pickupLocation || undefined}
                onPlaceSelect={handlePlaceSelect}
              />
            </div>
            <div>
              <Label>{t.pickUpStep.pickUpTimeLabel}</Label>
              <InfoText>{t.pickUpStep.pickUpInfoBox}</InfoText>
              <div>
                <AvailablePickupTimes />
                <Flexbox>
                  <EcoLeaf />
                  <Label>{t.pickUpStep.ecoInfo}</Label>
                </Flexbox>
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
