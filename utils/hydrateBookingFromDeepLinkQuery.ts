import dayjs from 'dayjs'
import * as utc from 'dayjs/plugin/utc'
import * as timezone from 'dayjs/plugin/timezone'
import { AirportCollection } from '../constants/AirportCollection'
import { getFlights } from '../modules/isaviaAPI/api'
import { useBookingStore } from '../store/store'
import { applyPickupDeepLinkQuery } from './applyPickupDeepLinkQuery'
import { findBookAirlineByIata } from './findBookAirlineByIata'
import { calculateCheckoutPrice } from './pricing'

// @ts-expect-error dayjs plugin typing
dayjs.extend(utc)
// @ts-expect-error dayjs plugin typing
dayjs.extend(timezone)

export type BookingDeepLinkQuery = Record<string, string | string[] | undefined>

export type HydrateBookingDeepLinkResult = 'ok' | 'redirect'

function firstQueryParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value[0] : value
}

/**
 * Applies the same URL-driven booking state as the pick-up deep link: flight match (when
 * airline_code + airline_flight_number + flight_date are present), optional bags/odd_bags,
 * checkout price, then contact/pickup/discount via applyPickupDeepLinkQuery.
 */
export async function hydrateBookingFromDeepLinkQuery(
  query: BookingDeepLinkQuery,
  locale: string | undefined,
): Promise<HydrateBookingDeepLinkResult> {
  const airline_code = firstQueryParam(query.airline_code)
  const airline_flight_number = firstQueryParam(query.airline_flight_number)
  const flight_date = firstQueryParam(query.flight_date)
  const bagsQ = firstQueryParam(query.bags)
  const odd_bagsQ = firstQueryParam(query.odd_bags)

  if (!airline_code || !airline_flight_number || !flight_date) {
    await applyPickupDeepLinkQuery(query, locale)
    return 'ok'
  }

  const departureDateStr = dayjs(flight_date).format('YYYY-MM-DD')
  const flightDate = new Date(flight_date)

  try {
    const availableFlights = await getFlights(departureDateStr)

    if (dayjs(flightDate).isBefore(dayjs(), 'day')) {
      return 'redirect'
    }

    const code = airline_code.toUpperCase()
    const flightNo = airline_flight_number.replace(/^0+/, '') || airline_flight_number

    const selectedFlight = availableFlights?.find((flight) => {
      const fn = flight.FlightNumber.replace(/^0+/, '') || flight.FlightNumber
      return fn === flightNo && (flight.AirlineIATA || '').toUpperCase() === code
    })

    if (!selectedFlight) {
      return 'redirect'
    }

    const {
      updateAvailableFlights,
      updateDepartureDate,
      updateAirline,
      updateArrivalAirport,
      updateSelectedFlight,
      handleBaggage,
      handleOddsize,
      updateCheckoutPrice,
    } = useBookingStore.getState()

    const airportMeta = AirportCollection.find((y) => y.iata === selectedFlight.OriginDestAirportIATA)
    const knownAirline = findBookAirlineByIata(selectedFlight.AirlineIATA)

    updateAvailableFlights(availableFlights)
    updateDepartureDate(flightDate)
    updateAirline({
      iata: selectedFlight.AirlineIATA || '',
      name: selectedFlight.AirlineDesc,
      icao: knownAirline?.icao ?? (selectedFlight.AirlineIATA || 'UNK'),
    })
    updateArrivalAirport({
      iata: selectedFlight.OriginDestAirportIATA,
      name: airportMeta?.name || selectedFlight.OriginDestAirportDesc,
      city: airportMeta?.city || '',
      countryCode: airportMeta?.country || '',
    })

    const scheduled = dayjs.tz(selectedFlight.ScheduledDateTime)
    const isMorningFlight = scheduled.get('hour') < 15
    updateSelectedFlight({ ...selectedFlight, isMorningFlight })

    if (bagsQ !== undefined) {
      const n = Number(bagsQ)
      if (Number.isFinite(n) && n >= 0) handleBaggage(Math.floor(n))
    }
    if (odd_bagsQ !== undefined) {
      const n = Number(odd_bagsQ)
      if (Number.isFinite(n) && n >= 0) handleOddsize(Math.floor(n))
    }

    const baggage = useBookingStore.getState().booking.baggageInformation.baggage
    const currency = useBookingStore.getState().booking.checkoutPrice.currency
    updateCheckoutPrice({
      amount: calculateCheckoutPrice(baggage.amount, baggage.oddSizeAmount),
      currency,
    })

    await applyPickupDeepLinkQuery(query, locale)
    return 'ok'
  } catch {
    return 'redirect'
  }
}
