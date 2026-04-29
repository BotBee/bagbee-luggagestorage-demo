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
      version: 1,
      storage: createJSONStorage(() => localStorage, { reviver: reviveDates }),
      // Drop transient lookup data that gets refetched on the next visit
      // anyway — keeps localStorage payload small and avoids stale schedules.
      partialize: (state) => ({
        booking: { ...state.booking, availableFlights: undefined },
        fastTrack: { ...state.fastTrack, availableFlights: [] },
      }),
    },
  ),
)
