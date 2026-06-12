/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import styled from '@emotion/styled'

/**
 * Rectangular geofence used to bias Places Autocomplete toward the capital
 * area. north/east/south/west are the envelope of the service polygon
 * (GeoJSON ring, [lng, lat] vertices).
 *
 * NOTE: the legacy AutocompleteService treats `bounds` as a *bias*, not a hard
 * restriction (only the Autocomplete widget supports strictBounds). Combined
 * with the `country: 'is'` component restriction below, results are Iceland-only
 * and capital-area-weighted, which is the behaviour we want for the pickup flow.
 */
const ADDRESS_AUTOCOMPLETE_BOUNDS = {
  north: 64.1919416459,
  south: 63.9543787326,
  east: -21.6471884156,
  west: -22.5979591142,
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
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (initialValue === undefined) return
    setInputValue(initialValue)
  }, [initialValue])

  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const boundsRef = useRef<google.maps.LatLngBounds | null>(null)
  const placesNsRef = useRef<typeof google.maps.places | null>(null)
  const onPlaceSelectRef = useRef(onPlaceSelect)
  onPlaceSelectRef.current = onPlaceSelect
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load the Places library once.
  useEffect(() => {
    if (!apiKey) return
    let cancelled = false
    const loader = new Loader({ apiKey, version: 'weekly' })
    loader
      .load()
      .then((google) => {
        const maps = google.maps as typeof google.maps & {
          importLibrary: (name: string) => Promise<unknown>
        }
        return maps.importLibrary('places').then(() => {
          if (cancelled) return
          const places = google.maps.places
          placesNsRef.current = places
          autocompleteServiceRef.current = new places.AutocompleteService()
          // PlacesService needs an element (or Map) to attach to; a detached
          // div is the standard headless pattern when there is no visible map.
          placesServiceRef.current = new places.PlacesService(document.createElement('div'))
          sessionTokenRef.current = new places.AutocompleteSessionToken()
          boundsRef.current = new google.maps.LatLngBounds(
            { lat: ADDRESS_AUTOCOMPLETE_BOUNDS.south, lng: ADDRESS_AUTOCOMPLETE_BOUNDS.west },
            { lat: ADDRESS_AUTOCOMPLETE_BOUNDS.north, lng: ADDRESS_AUTOCOMPLETE_BOUNDS.east },
          )
        })
      })
      .catch((err) => {
        // Surface load failures instead of dying silently (the previous
        // silent failure is exactly what made a disabled API look like a
        // mysterious dead field).
        // eslint-disable-next-line no-console
        console.error('[PlaceAutocompleteInput] Google Maps Places failed to load:', err)
      })
    return () => {
      cancelled = true
    }
  }, [apiKey])

  // Close dropdown when clicking outside.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchSuggestions = useCallback((input: string) => {
    const service = autocompleteServiceRef.current
    const places = placesNsRef.current
    if (!service || !places || !sessionTokenRef.current || input.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    service.getPlacePredictions(
      {
        input,
        sessionToken: sessionTokenRef.current,
        componentRestrictions: { country: 'is' },
        ...(boundsRef.current ? { bounds: boundsRef.current } : {}),
      },
      (predictions, status) => {
        if (status !== places.PlacesServiceStatus.OK || !predictions) {
          // ZERO_RESULTS is a normal "nothing matched" outcome — anything else
          // is a real failure worth logging (e.g. REQUEST_DENIED).
          if (status !== places.PlacesServiceStatus.ZERO_RESULTS) {
            // eslint-disable-next-line no-console
            console.error('[PlaceAutocompleteInput] getPlacePredictions failed:', status)
          }
          setSuggestions([])
          setOpen(false)
          return
        }
        setSuggestions(predictions)
        setOpen(predictions.length > 0)
        setHighlightedIndex(-1)
      },
    )
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    // Also propagate the typed text to the store so customers who
    // proceed without clicking a Google autocomplete suggestion (slow
    // suggestions, fast typing, paste, mobile) still have their address
    // saved. If they later pick a suggestion, handleSelect overwrites
    // with the canonical formatted address + postal code. Postcode
    // stays '' when typed-only — the booking flow falls back to
    // capacity-only slot gating in that case (no postal-code rules
    // applied), matching the legacy unknown-postcode behaviour.
    onPlaceSelectRef.current(val, val, '')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250)
  }

  // Rotate session token after each selection — one session (queries + a
  // single details fetch) is Google's billable unit.
  const rotateSessionToken = () => {
    const places = placesNsRef.current
    if (places) sessionTokenRef.current = new places.AutocompleteSessionToken()
  }

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    const fallbackName =
      prediction.structured_formatting?.main_text ?? prediction.description ?? ''
    setOpen(false)
    setSuggestions([])

    const service = placesServiceRef.current
    const places = placesNsRef.current
    if (!service || !places) {
      setInputValue(fallbackName)
      onPlaceSelectRef.current(fallbackName, fallbackName, '')
      return
    }

    service.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['name', 'formatted_address', 'address_components'],
        sessionToken: sessionTokenRef.current ?? undefined,
      },
      (place, status) => {
        if (!place || status !== places.PlacesServiceStatus.OK) {
          // eslint-disable-next-line no-console
          console.error('[PlaceAutocompleteInput] getDetails failed:', status)
          setInputValue(fallbackName)
          onPlaceSelectRef.current(fallbackName, fallbackName, '')
          rotateSessionToken()
          return
        }
        const rawAddress = place.formatted_address ?? fallbackName
        const displayName = place.name ?? fallbackName
        // Places returns a Google Plus Code (e.g. "544P+F35, 104 Reykjavík,
        // Iceland") as the formatted address for spots with no street address —
        // notably the cruise piers. Showing that to a customer who just picked
        // "Skarfabakki Harbour" is confusing, so swap the leading Plus Code for
        // the friendly name: "Skarfabakki Harbour, 104 Reykjavík, Iceland".
        // Still geocodable (named pier) and still matches downstream cruise-port
        // detection. Real street addresses / hotels have no Plus Code, so this
        // branch never touches them.
        const PLUS_CODE_RE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}/i
        const address =
          PLUS_CODE_RE.test(rawAddress) && displayName && !PLUS_CODE_RE.test(displayName)
            ? rawAddress.replace(PLUS_CODE_RE, displayName)
            : rawAddress
        // Extract Iceland 3-digit postcode from addressComponents (the
        // canonical source). Fall back to '' so the API gates by capacity only.
        const postalComponent = place.address_components?.find((c) =>
          c.types?.includes('postal_code'),
        )
        const postalCode = postalComponent?.short_name ?? postalComponent?.long_name ?? ''
        setInputValue(address)
        onPlaceSelectRef.current(address, displayName, postalCode)
        rotateSessionToken()
      },
    )
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
            const main = s.structured_formatting?.main_text ?? s.description ?? ''
            const secondary = s.structured_formatting?.secondary_text ?? ''
            return (
              <DropdownItem
                key={s.place_id ?? i}
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
