import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useForm, FormProvider, Controller } from 'react-hook-form'
import { Customer } from '../../common/types'
import { useBookingStore } from '../../store/store'
import Button from '../../components/button/Button'
import FormLayout from '../../components/form/FormLayout'
import InputErrorMessage from '../../components/form/InputErrorMessage'
import styled from '@emotion/styled'
import StyledPhoneInput from '../../components/form/phone-input/PhoneInput'
import TextInput from '../../components/form/text-input/TextInput'
import { ApplicationRoutes } from '../../utils/routing'
import { NextSeo } from 'next-seo'
import is from '../../common/locales/is'
import en from '../../common/locales/en'
import { validateStore } from '../../store/validateStore'

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
  color: #8692a6;
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
  margin-bottom: 24px;
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

const ChooseAirline = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const bookingState = useBookingStore((state) => state.booking)
  const updateCustomer = useBookingStore((state) => state.updateCustomer)
  const methods = useForm<Customer>({
    defaultValues: {
      name: bookingState.customerInfo.name || '',
      email: bookingState.customerInfo.email || '',
      phoneNumber: bookingState.customerInfo.phoneNumber || '',
      companyId: bookingState.customerInfo.companyId || '',
      agreesToTermsAndConditions:
        bookingState.customerInfo.agreesToTermsAndConditions || false,
    },
  })

  const {
    handleSubmit,
    register,
    control,
    formState: { isSubmitting, errors, isValid, isSubmitSuccessful },
  } = methods

  const [isCompany, setIsCompany] = useState<boolean>(
    !!bookingState.customerInfo.companyId
  )

  useEffect(() => {
    if (!validateStore(router.asPath, bookingState)) {
      router.push(ApplicationRoutes.pages.pickUp)
    }
  }, [bookingState, router])

  const onSubmit = async (values: Customer) => {
    updateCustomer({
      ...values,
      phoneNumber: `+${values.phoneNumber}`,
      discountCode: bookingState.customerInfo.discountCode,
    })
    router.push(ApplicationRoutes.pages.confirmOrder)
  }

  return (
    <FormProvider {...methods}>
      <NextSeo title='Bagbee | Contact details' />
      <FormLayout
        title={t.contactInfoStep.title}
        text={t.contactInfoStep.subtitle}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* NAME /> */}
          <InputContainer>
            <Label>{t.contactInfoStep.fullNameLabel}*</Label>
            <TextInput
              placeholder={t.contactInfoStep.fullNamePlaceholder}
              {...register('name', {
                required: { value: true, message: 'This field is required' },
                minLength: {
                  value: 3,
                  message: 'Name must be longer than 3 characters',
                },
              })}
            />
            {errors.name?.message && (
              <InputErrorMessage errorMessage={errors.name.message!!} />
            )}
          </InputContainer>

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
            {errors.email?.message && (
              <InputErrorMessage errorMessage={errors.email.message!!} />
            )}
          </InputContainer>
          <InputContainer>
            <Label>{t.contactInfoStep.phoneNumberLabel}*</Label>
            <Controller
              name='phoneNumber'
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <StyledPhoneInput {...field} value='+354' />
              )}
            />
          </InputContainer>

          {/* COMPANY ID */}
          {isCompany && (
            <InputContainer>
              <Label>{t.contactInfoStep.companyIdLabel}</Label>
              <TextInput
                placeholder={t.contactInfoStep.companyIdPlaceholder}
                {...register('companyId')}
              />
              {errors.name?.message && (
                <InputErrorMessage errorMessage={errors.name.message!!} />
              )}
            </InputContainer>
          )}
          {!isCompany ? (
            <CompanyButton type='button' onClick={() => setIsCompany(true)}>
              {t.contactInfoStep.companyButton}
            </CompanyButton>
          ) : (
            <CompanyButton type='button' onClick={() => setIsCompany(false)}>
              {t.contactInfoStep.companyOffButton}
            </CompanyButton>
          )}
          <ButtonContainer>
            <CheckboxContainer>
              <input
                type='checkbox'
                {...register('agreesToTermsAndConditions', {
                  required: { value: true, message: 'This field is required' },
                  value: true,
                })}
              />
              <label>
                {t.contactInfoStep.termsCheckbox.partOne}
                <a href='/terms-conditions' target='_blank'>
                  {t.contactInfoStep.termsCheckbox.partTwo}
                </a>
              </label>
            </CheckboxContainer>
            <Button
              type='submit'
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
