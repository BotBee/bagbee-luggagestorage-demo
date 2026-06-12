/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import styled from '@emotion/styled'

// Address autocomplete for the partner portal.
//
// Mirrors the customer-side PlaceAutocompleteInput (same legacy Google Places
// AutocompleteService + PlacesService, same session-token reuse) but with:
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
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [open, setOpen] = useState(false)

  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const placesNsRef = useRef<typeof google.maps.places | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load the Places library once on mount.
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
          placesServiceRef.current = new places.PlacesService(document.createElement('div'))
          sessionTokenRef.current = new places.AutocompleteSessionToken()
        })
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[PartnerAddressInput] Google Maps Places failed to load:', err)
      })
    return () => {
      cancelled = true
    }
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
        // No geofence — partner portal handles addresses across Iceland
        // (KEF, Reykjavík, the harbor, occasionally Selfoss for special
        // requests). Country restriction to .is filters out overseas noise.
        componentRestrictions: { country: 'is' },
      },
      (predictions, status) => {
        if (status !== places.PlacesServiceStatus.OK || !predictions) {
          if (status !== places.PlacesServiceStatus.ZERO_RESULTS) {
            // eslint-disable-next-line no-console
            console.error('[PartnerAddressInput] getPlacePredictions failed:', status)
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
    // Propagate typed text immediately — if the partner submits before
    // picking a suggestion, the raw typed value still saves. That mirrors
    // the customer-flow behaviour and avoids surprising data loss.
    onChangeRef.current(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250)
  }

  // Rotate session token after each selection — Google's pricing model
  // treats one session as one billable unit.
  const rotateSessionToken = () => {
    const places = placesNsRef.current
    if (places) sessionTokenRef.current = new places.AutocompleteSessionToken()
  }

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    const fallback = prediction.structured_formatting?.main_text ?? prediction.description ?? ''
    setOpen(false)
    setSuggestions([])

    const service = placesServiceRef.current
    const places = placesNsRef.current
    if (!service || !places) {
      onChangeRef.current(fallback)
      return
    }

    service.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['name', 'formatted_address'],
        sessionToken: sessionTokenRef.current ?? undefined,
      },
      (place, status) => {
        if (!place || status !== places.PlacesServiceStatus.OK) {
          // eslint-disable-next-line no-console
          console.error('[PartnerAddressInput] getDetails failed:', status)
          onChangeRef.current(fallback)
          rotateSessionToken()
          return
        }
        const formatted = place.formatted_address ?? ''
        const name = place.name ?? ''
        // Hotels, restaurants, landmarks etc. ("establishment" results)
        // have a name distinct from their street address. Partners searched
        // for the hotel by name on purpose — collapsing the field to the bare
        // street ("Aðalgata 60, …") loses the context the customer recognises
        // ("Courtyard by Marriott Keflavik Airport"). We prepend the name so
        // both pieces survive into Airtable, the order confirmation email, and
        // the OptimoRoute payload (which still geocodes correctly because the
        // street follows the comma).
        //
        // Plain geocode results (street-only picks like "Hringbraut 100")
        // have a name that's already a substring of the formatted address,
        // so we don't double it up in that case.
        const isDistinctName =
          name.trim().length > 0 && !formatted.toLowerCase().includes(name.toLowerCase())
        const address = isDistinctName ? `${name}, ${formatted}` : formatted || fallback
        onChangeRef.current(address)
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

export default PartnerAddressInput
