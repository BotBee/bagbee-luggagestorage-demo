import React, { useCallback } from 'react'
import styled from '@emotion/styled'
import { AsYouType } from 'libphonenumber-js'

// Phone input for the partner portal — visually identical to the partner
// portal <Input> (42px, white background, partner-portal focus colour) but
// with two behaviours layered on top:
//
//   1. Input filter: only digits and a single leading "+" are accepted.
//      Letters and punctuation are blocked at the keydown handler so they
//      never appear; paste content is stripped to dial-able characters.
//      Mobile keyboards open to the numeric pad (`inputMode="tel"` +
//      `type="tel"`).
//
//   2. Live formatting, biased to Icelandic numbers because that's the
//      vast majority of partner-portal traffic:
//        "5812345"      becomes  "581-2345"     (Iceland, 7-digit local)
//        "899-4957"     becomes  "899-4957"
//        "+447911..."   becomes  "+44 7911 ..."  (international via AsYouType)
//        "+3545812345"  becomes  "+354 581-2345" (Iceland with country code)
//      The hyphen between digit 3 and 4 of an IS number is the Icelandic
//      convention (Símaskráin formats them this way). Other countries
//      retain the AsYouType formatter's native spacing.
//
// Normalisation to E.164 still happens server-side in
// utils/phoneNormalize.ts before the value lands in Airtable, so this
// component doesn't have to produce a canonical format — its only job
// is to make the input UX pleasant and unambiguous.

const StyledInput = styled.input`
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  height: 42px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #d9dde2;
  background: white;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  /* Tabular numerals so the formatted string doesn't jitter as the user
     types — each digit takes the same width. */
  font-variant-numeric: tabular-nums;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  &:focus {
    border-color: #3d7165;
  }
`

interface PartnerPhoneInputProps {
  value: string
  // eslint-disable-next-line no-unused-vars
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}

// Apply the Icelandic Símaskrá convention "XXX-XXXX" to a 7-digit local
// number. Returns the input unchanged if it isn't exactly 7 digits.
const formatIcelandicLocal = (digits: string): string => {
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  // Longer than 7 — likely the user is typing a country code without a
  // '+'. Fall back to a space-separated layout so the digits don't run
  // together; the AsYouType path picks up cleanly once the user adds
  // '+'.
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)} ${digits.slice(7)}`
}

const formatPhone = (raw: string): string => {
  // Drop everything that isn't a digit or '+'. We don't preserve the
  // user's spaces / hyphens — they'd fight the formatter mid-string.
  let filtered = raw.replace(/[^\d+]/g, '')
  // A '+' is only meaningful as the leading character (country-code
  // marker). Strip any stray ones the user slipped in mid-string via
  // paste or arrow-key wandering.
  filtered = filtered.replace(/(?!^)\+/g, '')
  if (filtered === '') return ''

  // Local Icelandic path — most common case. No '+' prefix means the PM
  // is typing a domestic number and we render it in the local
  // Símaskrá format "XXX-XXXX" rather than the AsYouType-default
  // space-separated form. This is what tour-operator project managers
  // recognise as a "phone number that looks right".
  if (!filtered.startsWith('+')) {
    return formatIcelandicLocal(filtered)
  }

  // International path. Hand off to libphonenumber's formatter.
  try {
    const formatter = new AsYouType('IS')
    const formatted = formatter.input(filtered)
    // For +354 numbers specifically, swap the space between the third
    // and fourth digit for a hyphen so the format matches the local
    // convention. AsYouType gives us "+354 581 2345"; we want
    // "+354 581-2345".
    if (/^\+354\s/.test(formatted)) {
      return formatted.replace(/^(\+354\s\d{3})\s(\d{4})(.*)$/, '$1-$2$3')
    }
    return formatted || filtered
  } catch {
    return filtered
  }
}

const PartnerPhoneInput: React.FC<PartnerPhoneInputProps> = ({
  value,
  onChange,
  placeholder = '581-2345',
  required,
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhone(e.target.value)
      onChange(formatted)
    },
    [onChange],
  )

  // Keydown guard so single-character typing also feels clean — block
  // alphabetic keys outright so the user gets visual feedback (nothing
  // happens when they press a letter), instead of seeing the letter
  // appear for a frame and then disappear on the reformat.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const k = e.key
      // Always allow navigation / editing keys.
      if (
        k === 'Backspace' ||
        k === 'Delete' ||
        k === 'Tab' ||
        k === 'Enter' ||
        k === 'ArrowLeft' ||
        k === 'ArrowRight' ||
        k === 'ArrowUp' ||
        k === 'ArrowDown' ||
        k === 'Home' ||
        k === 'End' ||
        e.metaKey ||
        e.ctrlKey
      ) {
        return
      }
      // Allow digits, and a leading '+' (only at position 0). We don't
      // accept typed spaces or hyphens — the formatter inserts the
      // hyphen automatically once the 4th digit lands.
      if (/^\d$/.test(k)) return
      if (k === '+' && (e.currentTarget.selectionStart ?? 0) === 0) return
      e.preventDefault()
    },
    [],
  )

  return (
    <StyledInput
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      required={required}
    />
  )
}

export default PartnerPhoneInput
