/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import styled from '@emotion/styled'

/**
 * Rectangular geofence for Places Autocomplete (API supports bounds, not arbitrary polygons).
 * north/east/south/west are the envelope of the service polygon (GeoJSON ring, [lng, lat] vertices).
 */
const ADDRESS_AUTOCOMPLETE_LOCATION_RESTRICTION = {
  north: 64.1919416459,
  south: 63.9543787326,
  east: -21.6471884156,
  west: -22.5979591142,
}

// Types for the Places Autocomplete Data API (not yet in @types/google.maps 3.50)
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
    locationRestriction?: object
    includedRegionCodes?: string[]
    includedPrimaryTypes?: string[]
  }) => Promise<{ suggestions: Suggestion[] }>
}
interface PlacesLibrary {
  AutocompleteSuggestion: AutocompleteSuggestionAPI
  AutocompleteSessionToken: new () => SessionToken
}

const Wrapper = styled.div`
  position: relative;
`

const StyledInput = styled.input`
  height: 64px;
  width: 100%;
  border: 1px solid #8692a6;
  border-radius: 6px;
  font-weight: 500;
  font-size: 16px;
  line-height: 18px;
  font-family: Poppins, sans-serif;
  color: #12141d;
  background: #ffffff;
  padding: 0 32px;
  box-sizing: border-box;
  outline: none;

  &::placeholder {
    color: #8692a6;
    font-weight: 400;
  }

  &:focus {
    background: #ffffff;
    box-shadow: 0px 4px 10px 3px rgba(0, 0, 0, 0.11);
  }
`

const Dropdown = styled.ul`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0px 4px 16px rgba(0, 0, 0, 0.12);
  list-style: none;
  margin: 0;
  padding: 8px 0;
  z-index: 1000;
`

const DropdownItem = styled.li<{ highlighted: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 24px;
  cursor: pointer;
  background: ${({ highlighted }) => (highlighted ? '#f5f7fa' : 'transparent')};
  gap: 16px;

  &:hover {
    background: #f5f7fa;
  }
`

const MainText = styled.span`
  font-weight: 600;
  font-size: 15px;
  color: #12141d;
  font-family: Poppins, sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const SecondaryText = styled.span`
  font-size: 14px;
  color: #696f79;
  font-family: Poppins, sans-serif;
  white-space: nowrap;
  flex-shrink: 0;
`

export interface PlaceAutocompleteInputProps {
  apiKey: string
  placeholder?: string
  initialValue?: string
  onPlaceSelect: (address: string, placeName: string, postalCode: string) => void
}

export default function PlaceAutocompleteInput({
  apiKey,
  placeholder,
  initialValue,
  onPlaceSelect,
}: PlaceAutocompleteInputProps) {
  const [inputValue, setInputValue] = useState(initialValue ?? '')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (initialValue === undefined) return
    setInputValue(initialValue)
  }, [initialValue])

  const placesRef = useRef<PlacesLibrary | null>(null)
  const sessionTokenRef = useRef<SessionToken | null>(null)
  const onPlaceSelectRef = useRef(onPlaceSelect)
  onPlaceSelectRef.current = onPlaceSelect
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load the Places library once
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

  // Close dropdown when clicking outside
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
          locationRestriction: ADDRESS_AUTOCOMPLETE_LOCATION_RESTRICTION,
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
    setInputValue(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250)
  }

  const handleSelect = async (suggestion: Suggestion) => {
    const prediction = suggestion.placePrediction
    const fallbackName = prediction.mainText?.text ?? prediction.text?.text ?? ''
    setOpen(false)
    setSuggestions([])

    try {
      const place = await prediction.toPlace()
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'addressComponents'],
      })
      const address = place.formattedAddress ?? fallbackName
      // Extract Iceland 3-digit postcode from Places addressComponents (the
      // canonical source). Fall back to '' so the API gates by capacity only.
      const postalComponent = place.addressComponents?.find((c) =>
        c.types?.includes('postal_code'),
      )
      const postalCode = postalComponent?.shortText ?? postalComponent?.longText ?? ''
      setInputValue(address)
      onPlaceSelectRef.current(address, place.displayName ?? fallbackName, postalCode)
    } catch {
      setInputValue(fallbackName)
      onPlaceSelectRef.current(fallbackName, fallbackName, '')
    }

    // Rotate session token after each selection
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
      e.preventDefault()
      if (highlightedIndex >= 0) handleSelect(suggestions[highlightedIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <Wrapper ref={wrapperRef}>
      <StyledInput
        type='text'
        value={inputValue}
        placeholder={placeholder}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onKeyPress={(e) => e.key === 'Enter' && e.preventDefault()}
        autoComplete='off'
      />
      {open && suggestions.length > 0 && (
        <Dropdown>
          {suggestions.map((s, i) => {
            const main = s.placePrediction.mainText?.text ?? s.placePrediction.text?.text ?? ''
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
