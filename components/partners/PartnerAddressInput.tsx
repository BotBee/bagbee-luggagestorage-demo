/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import styled from '@emotion/styled'

// Address autocomplete for the partner portal.
//
// Mirrors the customer-side PlaceAutocompleteInput (same Google Places
// Autocomplete Data API, same session-token reuse) but with:
//   - styling that matches the partner-portal `<Input>` (42px height,
//     white bg, dd/mm/yyyy + min-width:0 row friendly)
//   - Iceland-wide region restriction (no Reykjavík-only geofence —
//     partners often deliver to KEF airport which lives outside the
//     customer-flow geofence)
//   - simpler callback contract: just the formatted address string
//
// Why this matters operationally: OptimoRoute's `create_order` returns
// ERR_LOC_GEOCODING when the address can't be pinned on a map. A partner
// typing "Vör" (just the restaurant name, no street) breaks the delivery
// half of a Pickup & Delivery booking. Forcing the partner to pick a
// real Google-resolved place eliminates this whole class of bug — the
// address that ends up in Airtable is always geocodable.

// ------------------------- Places API types -------------------------
// The Data API isn't in @types/google.maps yet, so we declare what we use.

interface SessionToken {}
interface AddressComponent {
  types?: string[]
  shortText?: string
  longText?: string
}
interface PlaceResult {
  fetchFields: (opts: { fields: string[] }) => Promise<void>
  formattedAddress?: string
  displayName?: string
  addressComponents?: AddressComponent[]
}
interface FormattableText {
  text: string
}
interface PlacePrediction {
  mainText?: FormattableText
  secondaryText?: FormattableText
  text?: FormattableText
  toPlace: () => Promise<PlaceResult>
}
interface Suggestion {
  placePrediction: PlacePrediction
}
interface AutocompleteSuggestionAPI {
  fetchAutocompleteSuggestions: (req: {
    input: string
    sessionToken: SessionToken
    includedRegionCodes?: string[]
    includedPrimaryTypes?: string[]
  }) => Promise<{ suggestions: Suggestion[] }>
}
interface PlacesLibrary {
  AutocompleteSuggestion: AutocompleteSuggestionAPI
  AutocompleteSessionToken: new () => SessionToken
}

// ------------------------- styling -------------------------

const Wrapper = styled.div`
  position: relative;
`

// Same height/typography as the partner-portal Input so the field
// blends into the form grid without standing out.
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
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  &:focus {
    border-color: #3d7165;
  }
`

const Dropdown = styled.ul`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #ffffff;
  border: 1px solid #e5e6eb;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  list-style: none;
  margin: 0;
  padding: 6px 0;
  z-index: 1000;
  max-height: 280px;
  overflow-y: auto;
`

const DropdownItem = styled.li<{ highlighted: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  cursor: pointer;
  background: ${({ highlighted }) => (highlighted ? '#f1f7f5' : 'transparent')};
  font-family: 'Poppins', sans-serif;
  &:hover {
    background: #f1f7f5;
  }
`

const MainText = styled.span`
  font-weight: 600;
  font-size: 14px;
  color: #000929;
`

const SecondaryText = styled.span`
  font-size: 12px;
  color: #696f79;
`

// ------------------------- component -------------------------

export interface PartnerAddressInputProps {
  apiKey: string
  placeholder?: string
  required?: boolean
  value: string
  // Fired as the user types each character (typed-text passthrough) and
  // when a suggestion is picked (canonical Google-formatted address).
  // The form should store whatever string lands here as the field value.
  onChange: (address: string) => void
}

const PartnerAddressInput: React.FC<PartnerAddressInputProps> = ({
  apiKey,
  placeholder,
  required,
  value,
  onChange,
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [open, setOpen] = useState(false)

  const placesRef = useRef<PlacesLibrary | null>(null)
  const sessionTokenRef = useRef<SessionToken | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load the Places library once on mount.
  useEffect(() => {
    if (!apiKey) return
    const loader = new Loader({ apiKey, version: 'weekly' })
    loader.load().then((google) => {
      const maps = google.maps as typeof google.maps & {
        importLibrary: (name: string) => Promise<unknown>
      }
      maps.importLibrary('places').then((lib) => {
        placesRef.current = lib as PlacesLibrary
        sessionTokenRef.current = new (lib as PlacesLibrary).AutocompleteSessionToken()
      })
    })
  }, [apiKey])

  // Close dropdown on outside click.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchSuggestions = useCallback(async (input: string) => {
    const places = placesRef.current
    if (!places || !sessionTokenRef.current || input.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    try {
      const { suggestions: results } =
        await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: sessionTokenRef.current,
          // No geofence — partner portal handles addresses across Iceland
          // (KEF, Reykjavík, the harbor, occasionally Selfoss for special
          // requests). Region restriction to .is is enough to filter out
          // overseas noise.
          includedRegionCodes: ['is'],
          includedPrimaryTypes: ['establishment', 'geocode'],
        })
      setSuggestions(results)
      setOpen(results.length > 0)
      setHighlightedIndex(-1)
    } catch {
      setSuggestions([])
      setOpen(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    // Propagate typed text immediately — if the partner submits before
    // picking a suggestion, the raw typed value still saves. That mirrors
    // the customer-flow behaviour and avoids surprising data loss.
    onChangeRef.current(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250)
  }

  const handleSelect = async (suggestion: Suggestion) => {
    const prediction = suggestion.placePrediction
    const fallback = prediction.mainText?.text ?? prediction.text?.text ?? ''
    setOpen(false)
    setSuggestions([])

    try {
      const place = await prediction.toPlace()
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'addressComponents'],
      })
      const address = place.formattedAddress ?? fallback
      onChangeRef.current(address)
    } catch {
      onChangeRef.current(fallback)
    }

    // Rotate session token after each selection — Google's pricing model
    // treats one session as one billable unit; rotating ensures the next
    // search starts a fresh session.
    if (placesRef.current) {
      sessionTokenRef.current = new placesRef.current.AutocompleteSessionToken()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      // Only consume Enter when the dropdown is open with a highlighted
      // item — else let the form submit normally.
      if (highlightedIndex >= 0) {
        e.preventDefault()
        handleSelect(suggestions[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <Wrapper ref={wrapperRef}>
      <StyledInput
        type="text"
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <Dropdown>
          {suggestions.map((s, i) => {
            const main =
              s.placePrediction.mainText?.text ?? s.placePrediction.text?.text ?? ''
            const secondary = s.placePrediction.secondaryText?.text ?? ''
            return (
              <DropdownItem
                key={i}
                highlighted={i === highlightedIndex}
                onMouseDown={() => handleSelect(s)}
                onMouseEnter={() => setHighlightedIndex(i)}
              >
                <MainText>{main}</MainText>
                {secondary && <SecondaryText>{secondary}</SecondaryText>}
              </DropdownItem>
            )
          })}
        </Dropdown>
      )}
    </Wrapper>
  )
}

export default PartnerAddressInput
