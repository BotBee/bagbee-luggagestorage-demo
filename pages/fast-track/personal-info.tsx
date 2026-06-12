import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useForm, FormProvider, useFieldArray } from 'react-hook-form'
import { FastTrackBooking, Passenger } from '../../common/types'
import { useBookingStore } from '../../store/store'
import Button from '../../components/button/Button'
import FormLayout from '../../components/form/FormLayout'
import InputErrorMessage from '../../components/form/InputErrorMessage'
import styled from '@emotion/styled'
import TextInput from '../../components/form/text-input/TextInput'
import { ApplicationRoutes } from '../../utils/routing'
import { NextSeo } from 'next-seo'
import is from '../../common/locales/is'
import en from '../../common/locales/en'
import { calculateFastTrackPrice } from '../../utils/pricing'
import dayjs from 'dayjs'
import { getFlights } from '../../modules/isaviaAPI/api'
import { buildFastTrackItems, trackBeginCheckout } from '../../utils/analytics'

export const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
`

export const Label = styled.label`
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-weight: 400;
  font-size: 16px;
  line-height: 20px;
  display: flex;
  align-items: center;
  color: rgb(99, 101, 103);
  margin-bottom: 12px;
`

const ButtonContainer = styled.div`
  margin-top: 50px;
`

const CompanyButton = styled.button`
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.green};
  &:hover {
    color: ${({ theme }) => theme.colors.yellow};
    text-decoration: underline;
  }
`

const CheckboxContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 48px;
  margin-bottom: 48px;
  white-space: nowrap;
  align-items: center;
  label {
    border-radius: 6px;
    font-weight: 500;
    font-size: 15px;
    line-height: 18px;
    display: flex;
    align-items: center;
    font-family: Poppins;
    color: #12141d;
    background: none;
    width: 100%;
    a {
      color: ${({ theme }) => theme.colors.green};
      margin-left: 4px;
    }
  }
`

const PassengersContainer = styled.div`
  margin-top: 48px;
  margin-bottom: 48px;
`

const PassengerSection = styled.div`
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e0e0e0;
  &:last-child {
    border-bottom: none;
  }
`

const PassengerTitle = styled.h3`
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-weight: 600;
  font-size: 18px;
  line-height: 27px;
  color: #12141d;
  margin-bottom: 12px;
`

const PassengerSubTitleText = styled.p`
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-size: 14px;
  line-height: 20px;
  color: rgb(99, 101, 103);
  margin-bottom: 24px;
`

const PassengerInputsRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

const RemovePassengerButton = styled.button`
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-size: 14px;
  font-weight: 600;
  color: #dc3545;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-top: 8px;
  &:hover {
    text-decoration: underline;
  }
`

const AddPassengerButton = styled.button`
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.green};
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  &:hover {
    color: ${({ theme }) => theme.colors.yellow};
    text-decoration: underline;
  }
`

type FormData = FastTrackBooking['customerInfo'] & { passengers: Passenger[] }

const ChooseAirline = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const { fastTrack, updateFastTrack } = useBookingStore()
  const methods = useForm<FormData>({
    defaultValues: {
      email: fastTrack.customerInfo?.email || '',
      companyId: fastTrack.customerInfo?.companyId || '',
      agreesToTermsAndConditions: fastTrack.customerInfo?.agreesToTermsAndConditions || false,
      passengers:
        fastTrack.passengers && fastTrack.passengers.length > 0
          ? fastTrack.passengers
          : [{ firstName: '', lastName: '' }],
    },
  })

  const {
    handleSubmit,
    register,
    control,
    formState: { isSubmitting, errors, isValid, isSubmitSuccessful },
  } = methods

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'passengers',
  })

  const [isCompany, setIsCompany] = useState<boolean>(!!fastTrack.customerInfo?.companyId)

  useEffect(() => {
    if (!router.isReady) return

    let ignore = false

    const {
      First_name,
      Last_Name,
      airline_code,
      airline_flight_number,
      flight_date,
      email,
    } = router.query

    if (First_name && Last_Name && airline_code && airline_flight_number && flight_date && email) {
      const departureDate = dayjs(flight_date as string).format('YYYY-MM-DD')

      getFlights(departureDate).then((availableFlights) => {
        if (!ignore) {
          const flightDate = new Date(flight_date as string)

          if (dayjs(flightDate).isBefore(dayjs())) {
            router.push(ApplicationRoutes.pages.fastTrack.index)
            return
          }

          const selectedFlight = availableFlights?.find((flight) => {
            return (
              flight.FlightNumber.replace(/^0/, '') === (airline_flight_number as string) &&
              flight.AirlineIATA === (airline_code as string)
            )
          })

          if (!selectedFlight) {
            router.push(ApplicationRoutes.pages.fastTrack.index)
            return
          }

          const passenger = {
            firstName: First_name as string,
            lastName: Last_Name as string,
          }

          methods.setValue('email', decodeURIComponent(email as string))
          methods.setValue('passengers', [passenger])

          updateFastTrack({
            flightInformation: {
              ...fastTrack.flightInformation,
              departureDate: flightDate,
              airline: {
                iata: selectedFlight.AirlineIATA || '',
                icao: '',
                name: selectedFlight.AirlineDesc || '',
              },
              arrivalAirport: {
                iata: selectedFlight.OriginDestAirportIATA || '',
                icao: '',
                name: selectedFlight.OriginDestAirportDesc || '',
                countryCode: '',
                city: '',
              },
              selectedFlight,
            },
          })
        }
      })
    } else if (
      !fastTrack.flightInformation.airline.iata ||
      !fastTrack.flightInformation.airline.name ||
      !fastTrack.flightInformation.arrivalAirport.iata ||
      !fastTrack.flightInformation.arrivalAirport.name ||
      !fastTrack.flightInformation.arrivalAirport.countryCode ||
      !fastTrack.flightInformation.arrivalAirport.city ||
      !fastTrack.flightInformation.selectedFlight?.FlightNumber ||
      !fastTrack.flightInformation.selectedFlight?.AirlineIATA ||
      !fastTrack.flightInformation.selectedFlight?.OriginDestAirportIATA
    ) {
      router.push(ApplicationRoutes.pages.fastTrack.index)
    }

    return () => {
      ignore = true
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query, fastTrack.departureDate, updateFastTrack])

  const onSubmit = async ({ passengers, ...values }: FormData) => {
    const price = calculateFastTrackPrice(passengers.length)
    updateFastTrack({
      customerInfo: {
        ...fastTrack.customerInfo,
        ...values,
      },
      passengers,
      checkoutPrice: {
        amount: price,
        currency: 'ISK',
      },
    })
    const items = buildFastTrackItems({ ...fastTrack, passengers })
    trackBeginCheckout(price, items, fastTrack.customerInfo?.discountCode?.code)
    router.push(ApplicationRoutes.pages.fastTrack.confirmOrder)
  }

  return (
    <FormProvider {...methods}>
      <NextSeo title="Bagbee | Contact details" />
      <FormLayout title={t.contactInfoStep.title} text={t.contactInfoStep.subtitle}>
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* PASSENGER INPUTS */}
          <PassengersContainer>
            <PassengerTitle>{t.contactInfoStep.passengersTitle}</PassengerTitle>
            <PassengerSubTitleText>{t.contactInfoStep.passengersSubTitle}</PassengerSubTitleText>
            {fields.map((field, index) => {
              const passengerTitle = `${t.contactInfoStep.passengerTitle} ${index + 1}`

              return (
                <PassengerSection key={field.id}>
                  <PassengerTitle>{passengerTitle}</PassengerTitle>
                  <PassengerInputsRow>
                    <InputContainer>
                      <Label htmlFor={`passengers.${index}.firstName`}>
                        {t.contactInfoStep.passengerFirstNameLabel}*
                      </Label>
                      <TextInput
                        id={`passengers.${index}.firstName`}
                        placeholder={t.contactInfoStep.passengerFirstNamePlaceholder}
                        {...register(`passengers.${index}.firstName` as const, {
                          required: { value: true, message: 'First name is required' },
                          minLength: {
                            value: 2,
                            message: 'First name must be at least 2 characters',
                          },
                        })}
                      />
                      {errors.passengers?.[index]?.firstName?.message && (
                        <InputErrorMessage
                          errorMessage={errors.passengers[index]?.firstName?.message!!}
                        />
                      )}
                    </InputContainer>
                    <InputContainer>
                      <Label>{t.contactInfoStep.passengerLastNameLabel}*</Label>
                      <TextInput
                        placeholder={t.contactInfoStep.passengerLastNamePlaceholder}
                        {...register(`passengers.${index}.lastName` as const, {
                          required: { value: true, message: 'Last name is required' },
                          minLength: {
                            value: 2,
                            message: 'Last name must be at least 2 characters',
                          },
                        })}
                      />
                      {errors.passengers?.[index]?.lastName?.message && (
                        <InputErrorMessage
                          errorMessage={errors.passengers[index]?.lastName?.message!!}
                        />
                      )}
                    </InputContainer>
                  </PassengerInputsRow>
                  {fields.length > 1 && (
                    <RemovePassengerButton type="button" onClick={() => remove(index)}>
                      {t.contactInfoStep.removePassengerButton}
                    </RemovePassengerButton>
                  )}
                </PassengerSection>
              )
            })}
            {fields.length < 4 && (
              <AddPassengerButton
                type="button"
                onClick={() => append({ firstName: '', lastName: '' })}
              >
                {t.contactInfoStep.addPassengerButton}
              </AddPassengerButton>
            )}
          </PassengersContainer>

          {/* EMAIL */}
          <InputContainer>
            <Label>{t.contactInfoStep.emailLabel}*</Label>
            <TextInput
              placeholder={t.contactInfoStep.emailPlaceholder}
              {...register('email', {
                required: 'E-mail is required',
                minLength: {
                  value: 5,
                  message: 'E-mail must be at least 5 characters',
                },
                pattern: {
                  value:
                    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
                  message: 'E-mail contains invalid characters',
                },
              })}
            />
            {errors.email?.message && <InputErrorMessage errorMessage={errors.email.message!!} />}
          </InputContainer>

          {/* TERMS AND CONDITIONS */}
          <CheckboxContainer>
            <input
              type="checkbox"
              {...register('agreesToTermsAndConditions', {
                required: { value: true, message: 'This field is required' },
                value: true,
              })}
            />
            <label>
              {t.contactInfoStep.termsCheckbox.partOne}
              <a href="/terms-conditions" target="_blank">
                {t.contactInfoStep.termsCheckbox.partTwo}
              </a>
            </label>
          </CheckboxContainer>

          {/* COMPANY ID */}
          {isCompany && (
            <InputContainer>
              <Label>{t.contactInfoStep.companyIdLabel}</Label>
              <TextInput
                placeholder={t.contactInfoStep.companyIdPlaceholder}
                {...register('companyId')}
              />
              {errors.companyId?.message && (
                <InputErrorMessage errorMessage={errors.companyId.message!!} />
              )}
            </InputContainer>
          )}
          {!isCompany ? (
            <CompanyButton type="button" onClick={() => setIsCompany(true)}>
              {t.contactInfoStep.companyButton}
            </CompanyButton>
          ) : (
            <CompanyButton type="button" onClick={() => setIsCompany(false)}>
              {t.contactInfoStep.companyOffButton}
            </CompanyButton>
          )}

          {/* SUBMIT BUTTON */}
          <ButtonContainer>
            <Button
              type="submit"
              disabled={isSubmitting || !isValid}
              loading={isSubmitting || isSubmitSuccessful}
              fullWidth
            >
              {t.contactInfoStep.submitButtonText}
            </Button>
          </ButtonContainer>
        </form>
      </FormLayout>
    </FormProvider>
  )
}

export default ChooseAirline
