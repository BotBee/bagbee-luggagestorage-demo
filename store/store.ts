/* eslint-disable no-unused-vars */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  Airline,
  Airport,
  Booking,
  Customer,
  FastTrackBooking,
  FlightInformation,
  PickupInformation,
  Price,
} from '../common/types'
import { FlightData } from '../common/types'

interface BookingState {
  booking: Booking
  updateCustomer: (customer: Customer) => void
  clearCustomerData: () => void
  updateAirline: (airline: Airline) => void
  updateDepartureAirport: (airport: Airport) => void
  updateAvailableFlights: (flights: FlightData[]) => void
  updateArrivalAirport: (airport: Airport) => void
  updateDepartureDate: (date: FlightInformation['departureDate']) => void
  updateSelectedFlight: (flight: FlightData) => void
  updateCheckoutPrice: (price: Price) => void
  updateComments: (pickupSlots: PickupInformation['comments']) => void
  updatePickupSlot: (pickupSlots: PickupInformation['pickupSlot']) => void
  updatePickupDate: (pickupDate: PickupInformation['pickupDate']) => void
  updatePickupLocation: (
    pickupLocation: PickupInformation['pickupLocation'],
    hotelName: PickupInformation['hotelName'],
    postalCode?: PickupInformation['postalCode']
  ) => void
  handleBaggage: (amount: number) => void
  handleOddsize: (oddSizeAmount: number) => void
  /** Fast track store */
  fastTrack: FastTrackBooking
  updateFastTrack: (fastTrack: Partial<FastTrackBooking>) => void
}

// Reviver runs on every property when rehydrating from localStorage so we
// can rebuild Date instances. JSON serialises Date → ISO string and the rest
// of the app expects real Date objects (e.g. `.toLocaleDateString()`).
// Be conservative — only revive keys we know are dates so we don't mistake
// a future ISO-shaped string in some other field.
const DATE_KEYS = new Set(['departureDate', 'pickupDate'])
const reviveDates = (key: string, value: unknown): unknown => {
  if (DATE_KEYS.has(key) && typeof value === 'string') {
    return new Date(value)
  }
  return value
}

export const useBookingStore = create<BookingState>()(
  persist(
    (set) => ({
  booking: {
    customerInfo: {
      name: '',
      address: '',
      email: '',
      phoneNumber: '',
      companyId: '',
      agreesToTermsAndConditions: false,
      discountCode: undefined,
    },
    baggageInformation: {
      baggage: { amount: 1, oddSizeAmount: 0 },
    },
    pickupInformation: {
      pickupSlot: '',
      pickupLocation: '',
      postalCode: '',
      deliveryAddress: 'Keflavíkurflugvöllur',
      comments: '',
      hotelName: '',
      isHotel: 'Hótel',
      pickupDate: new Date(),
    },
    flightInformation: {
      airline: { iata: '', icao: '', name: '' },
      arrivalAirport: {
        iata: '',
        icao: '',
        name: '',
        countryCode: '',
        city: '',
      },

      arrivalDate: '',
      departureAirport: {
        iata: 'KEF',
        icao: 'BIKF',
        name: 'Keflavik Airport',
        city: 'Keflavik',
        countryCode: 'IS',
      },
      departureDate: new Date(),
      flightNumber: '',
      selectedFlight: undefined,
    },
    checkoutPrice: {
      amount: 0,
      currency: 'ISK',
    },
  },
  updateComments: (comments: PickupInformation['comments']) => {
    set((state) => ({
      ...state,
      booking: {
        ...state.booking,
        pickupInformation: {
          ...state.booking.pickupInformation,
          comments,
        },
      },
    }))
  },
  updatePickupLocation: (
    pickupLocation: PickupInformation['pickupLocation'],
    hotelName: PickupInformation['hotelName'],
    postalCode?: PickupInformation['postalCode']
  ) => {
    set((state) => ({
      ...state,
      booking: {
        ...state.booking,
        pickupInformation: {
          ...state.booking.pickupInformation,
          pickupLocation,
          hotelName,
          // Preserve the previous postalCode if the caller doesn't supply one
          // (e.g. a deep-link query that only gave us an address string).
          ...(postalCode !== undefined ? { postalCode } : {}),
        },
      },
    }))
  },
  updatePickupSlot: (pickupSlot: PickupInformation['pickupSlot']) => {
    set((state) => ({
      ...state,
      booking: {
        ...state.booking,
        pickupInformation: {
          ...state.booking.pickupInformation,
          pickupSlot,
        },
      },
    }))
  },
  updatePickupDate: (pickupDate: PickupInformation['pickupDate']) => {
    set((state) => ({
      ...state,
      booking: {
        ...state.booking,
        pickupInformation: {
          ...state.booking.pickupInformation,
          pickupDate,
        },
      },
    }))
  },
  updateCheckoutPrice: (price: Price) => {
    set((state) => ({
      ...state,
      booking: {
        ...state.booking,
        checkoutPrice: {
          amount: price.amount,
          currency: price.currency,
        },
      },
    }))
  },
  updateCustomer: (customer: Customer) =>
    set((state) => ({
      ...state,
      booking: { ...state.booking, customerInfo: customer },
    })),
  clearCustomerData: () => set({ booking: undefined }),
  updateAirline: (airline: Airline) =>
    set((state) => ({
      ...state,
      booking: {
        ...state.booking,
        flightInformation: {
          ...state.booking.flightInformation,
          airline: airline,
        },
      },
    })),
  updateDepartureAirport: (airport: Airport) =>
    set((state) => ({
      ...state,
      booking: {
        ...state.booking,
        flightInformation: {
          ...state.booking.flightInformation,
          departureAirport: airport,
        },
      },
    })),
  updateArrivalAirport: (airport: Airport) =>
    set((state) => ({
      ...state,
      booking: {
        ...state.booking,
        flightInformation: {
          ...state.booking.flightInformation,
          arrivalAirport: airport,
        },
      },
    })),
  updateDepartureDate: (date: FlightInformation['departureDate']) =>
    set((state) => ({
      ...state,
      booking: {
        ...state.booking,
        flightInformation: {
          ...state.booking.flightInformation,
          departureDate: date,
        },
      },
    })),
  updateSelectedFlight: (flight: FlightData) =>
    set((state) => ({
      ...state,
      booking: {
        ...state.booking,
        flightInformation: {
          ...state.booking.flightInformation,
          selectedFlight: flight,
        },
      },
    })),
  handleBaggage: (amount: number) =>
    set((state) => ({
      ...state,
      booking: {
        ...state.booking,
        baggageInformation: {
          ...state.booking.baggageInformation,
          baggage: {
            ...state.booking.baggageInformation.baggage,
            amount,
          },
        },
      },
    })),
  handleOddsize: (oddSizeAmount: number) =>
    set((state) => ({
      ...state,
      booking: {
        ...state.booking,
        baggageInformation: {
          ...state.booking.baggageInformation,
          baggage: {
            ...state.booking.baggageInformation.baggage,
            oddSizeAmount,
          },
        },
      },
    })),
  updateAvailableFlights: (flights: FlightData[]) =>
    set((state) => ({
      ...state,
      booking: {
        ...state.booking,
        availableFlights: flights,
      },
    })),
    /** Fast track store */
  fastTrack: {
    departureDate: undefined,
    flightInformation: {
      flightNumber: '',
      airline: { iata: '', icao: '', name: '' },
      departureAirport: { iata: '', icao: '', name: '', countryCode: '', city: '' },
      arrivalAirport: { iata: '', icao: '', name: '', countryCode: '', city: '' },
      departureDate: new Date(),
      arrivalDate: '',
    },
    arrivalAirport: undefined,
    customerInfo: {
      name: '',
      address: '',
      email: '',
      phoneNumber: '',
      companyId: '',
      agreesToTermsAndConditions: false,
      discountCode: undefined,
    },
    passengers: [],
    availableFlights: [],
    checkoutPrice: {
      amount: 0,
      currency: 'ISK',
    },
  },
  updateFastTrack: (fastTrack: Partial<FastTrackBooking>) =>
    set((state) => ({
      ...state,
      fastTrack: {
        ...state.fastTrack,
        ...fastTrack,
      },
    })),
    }),
    {
      // Persist the booking + fast-track state to localStorage so a customer
      // who is bounced back from Rapyd's hosted checkout (success, cancel,
      // tab refresh, accidental close) can resume their booking instead of
      // starting over. The store survives the full page unload that happens
      // when we redirect to the Rapyd domain.
      name: 'bagbee-booking-store',
      // v2: stop persisting `departureDate` / `pickupDate` — when a customer
      // returned days later the stale dates pre-selected a now-disabled day
      // on the calendar and effectively soft-blocked the booking flow. Dates
      // always start fresh on each visit; the customer reselects (one extra
      // click vs. broken UI). v2 also forces a clean slate for anyone whose
      // localStorage has a v1 snapshot — those get discarded on first load.
      version: 2,
      storage: createJSONStorage(() => localStorage, { reviver: reviveDates }),
      // Drop transient lookup data + dates that go stale across visits.
      partialize: (state) => ({
        booking: {
          ...state.booking,
          availableFlights: undefined,
          flightInformation: {
            ...state.booking?.flightInformation,
            departureDate: undefined,
            arrivalDate: undefined,
            selectedFlight: undefined,
          },
          pickupInformation: {
            ...state.booking?.pickupInformation,
            pickupDate: undefined,
          },
        },
        fastTrack: {
          ...state.fastTrack,
          availableFlights: [],
          flightInformation: {
            ...state.fastTrack?.flightInformation,
            departureDate: undefined,
            arrivalDate: undefined,
            selectedFlight: undefined,
          },
          departureDate: undefined,
        },
      }),
      // On rehydrate, defend against a stored snapshot that's missing
      // expected shape (e.g. v1 leftover where booking is partial). Ensure
      // dates default to fresh `new Date()` so the calendar never lands on
      // a stale day. Without this, the date click-handler's guard silently
      // ate clicks when the persisted state was malformed.
      merge: (persisted: any, current) => {
        const safe = { ...current }
        if (persisted?.booking) {
          safe.booking = {
            ...current.booking,
            ...persisted.booking,
            flightInformation: {
              ...current.booking.flightInformation,
              ...(persisted.booking.flightInformation || {}),
              departureDate: new Date(),
              arrivalDate: '',
              selectedFlight: undefined,
            },
            pickupInformation: {
              ...current.booking.pickupInformation,
              ...(persisted.booking.pickupInformation || {}),
              pickupDate: new Date(),
            },
            availableFlights: undefined,
          }
        }
        if (persisted?.fastTrack) {
          safe.fastTrack = {
            ...current.fastTrack,
            ...persisted.fastTrack,
            flightInformation: {
              ...current.fastTrack.flightInformation,
              ...(persisted.fastTrack.flightInformation || {}),
              departureDate: new Date(),
              arrivalDate: '',
              selectedFlight: undefined,
            },
            departureDate: undefined,
            availableFlights: [],
          }
        }
        return safe
      },
    },
  ),
)
