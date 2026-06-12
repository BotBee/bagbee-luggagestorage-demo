import styled from '@emotion/styled'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import { validateDiscountCode } from '../../modules/AirTable/api'
import { useBookingStore } from '../../store/store'
import Button from '../button/Button'
import TextInput from '../form/text-input/TextInput'

// Reusable discount-code input.
// - When no code is applied: renders a toggle button ("Do you have a discount
//   code?") that expands to reveal the input + apply button.
// - When a code is applied (discount > 0): renders pre-expanded with a green
//   frame highlighting the applied code. Toggle is hidden — the customer
//   shouldn't be tempted to "remove" without an explicit action.
//
// Used on both bag-selection (so customers see the option while looking at
// price) and confirm-order (so applied codes show prominently before payment).
// Source of truth is `bookingState.customerInfo.discountCode` in the store.

interface IDiscountCodeInputProps {
  // When true, render the input expanded even with no applied code.
  // Currently unused but kept as an escape hatch if a future page wants it.
  forceExpanded?: boolean
}

const Wrapper = styled.div`
  margin-bottom: 24px;
`

const FieldRow = styled.div`
  display: flex;
  gap: 16px;
  flex-direction: column;
  margin-top: 12px;

  @media ${({ theme }) => theme.breakpoints.tablet} {
    flex-direction: row;
  }
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

const ToggleButton = styled.button`
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.green};
  margin-bottom: 24px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  &:hover {
    color: ${({ theme }) => theme.colors.yellow};
    text-decoration: underline;
  }
`

const DiscountCodeInput = ({ forceExpanded = false }: IDiscountCodeInputProps) => {
  const { locale } = useRouter()
  const t = (locale === 'en' ? en : is).confirmOrderStep.discount

  const bookingState = useBookingStore((state) => state.booking)
  const updateCustomer = useBookingStore((state) => state.updateCustomer)

  const appliedDiscount = bookingState.customerInfo.discountCode
  const hasAppliedCode = useMemo(
    () => Boolean(appliedDiscount && appliedDiscount.discount > 0),
    [appliedDiscount],
  )

  // Default expanded state intentionally starts `false` even when a code
  // is in the store — the persisted Zustand state isn't available during
  // SSR, so initialising from `hasAppliedCode` would cause a hydration
  // mismatch (server renders the collapsed toggle, client jumps to the
  // expanded frame). The useEffect below re-sets it once we're on the
  // client. forceExpanded callers accept the open-from-mount cost (no
  // server vs client divergence in that case since it's a static prop).
  const [expanded, setExpanded] = useState<boolean>(forceExpanded)
  const [inputValue, setInputValue] = useState<string>('')
  const [isFetching, setIsFetching] = useState<boolean>(false)
  const [validationState, setValidationState] = useState<
    'idle' | 'success' | 'error'
  >('idle')

  // Re-sync once the persisted store has hydrated (or whenever the customer
  // applies a code on another page before walking to here).
  useEffect(() => {
    if (hasAppliedCode) {
      setExpanded(true)
      setValidationState('success')
    } else {
      setValidationState('idle')
    }
  }, [hasAppliedCode])

  const onApply = async () => {
    const code = inputValue.trim()
    if (!code) {
      setValidationState('idle')
      return
    }
    setIsFetching(true)
    try {
      const result = await validateDiscountCode(code)
      if (!result.valid) {
        setValidationState('error')
        toast.error(t.discountCodeInvalid)
        updateCustomer({
          ...bookingState.customerInfo,
          discountCode: undefined,
        })
        return
      }
      updateCustomer({
        ...bookingState.customerInfo,
        discountCode: {
          code: result.code || code,
          discount: result.discount || 0,
        },
      })
      setValidationState('success')
      toast.success(`${t.discountCodeSuccessfullyAdded} ${result.discount}%`)
    } catch (error) {
      console.error(error)
      setValidationState('error')
      toast.error(t.errorValidatingDiscountCode)
    } finally {
      setIsFetching(false)
    }
  }

  // Collapsed: show the "Do you have a discount code?" toggle. An already-
  // applied code stays in the store either way (price strikethrough still
  // shows on confirm-order); the customer can re-expand to view/edit.
  if (!expanded) {
    return (
      <ToggleButton type='button' onClick={() => setExpanded(true)}>
        {t.iHaveDiscountCode}
      </ToggleButton>
    )
  }

  return (
    <>
      <Wrapper>
        <Label>{t.discountCode}</Label>
        <FieldRow>
          <TextInput
            placeholder={t.inputPlaceholder}
            success={validationState === 'success'}
            error={validationState === 'error'}
            defaultValue={appliedDiscount?.code || ''}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <Button
            type='button'
            loading={isFetching}
            disabled={isFetching || !inputValue}
            onClick={onApply}
          >
            {t.apply}
          </Button>
        </FieldRow>
      </Wrapper>
      <ToggleButton type='button' onClick={() => setExpanded(false)}>
        {t.iDontHaveDiscountCode}
      </ToggleButton>
    </>
  )
}

export default DiscountCodeInput
