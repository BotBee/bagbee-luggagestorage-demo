/* eslint-disable no-unused-vars */
import { create } from 'zustand'
import {
  Airline,
  Airport,
  ArrivalInformation,
  Booking,
  Customer,
  FlightInformation,
  PickupInformation,
  Price,
  ServiceType,
  FlightData,
} from '../common/types'

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
  updatePostalCode: (postalCode: PickupInformation['postalCode']) => void
  updatePickupSlot: (pickupSlots: PickupInformation['pickupSlot']) => void
  updatePickupDate: (pickupDate: PickupInformation['pickupDate']) => void
  updatePickupLocation: (
    pickupLocation: PickupInformation['pickupLocation'],
    hotelName: PickupInformation['hotelName']
  ) => void
  handleBaggage: (amount: number) => void
  handleOddsize: (oddSizeAmount: number) => void
  // Service type
  updateServiceType: (serviceType: ServiceType) => void
  // Arrival-specific actions
  updateArrivalAirline: (airline: Airline) => void
  updateArrivalDepartureAirport: (airport: Airport) => void
  updateArrivalArrivalAirport: (airport: Airport) => void
  updateArrivalDepartureDate: (date: Date) => void
  updateArrivalSelectedFlight: (flight: FlightData) => void
  updateArrivalAvailableFlights: (flights: FlightData[]) => void
  updateArrivalBaggage: (amount: number) => void
  updateArrivalOddsize: (oddSizeAmount: number) => void
  updateArrivalCheckoutPrice: (price: Price) => void
  updateArrivalInfo: (info: Partial<ArrivalInformation>) => void
  // Pending discount code from prefilled URL
  pendingDiscountCode: string | undefined
  setPendingDiscountCode: (code: string | undefined) => void
}

export const useBookingStore = create<BookingState>((set) => ({
  pendingDiscountCode: undefined,
  setPendingDiscountCode: (code: string | undefined) => set({ pendingDiscountCode: code }),
  booking: {
    serviceType: 'departure',
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
    // Arrival service defaults
    arrivalFlightInformation: {
      airline: { iata: '', icao: '', name: '' },
      arrivalAirport: {
        iata: 'KEF',
        icao: 'BIKF',
        name: 'Keflavik Airport',
        city: 'Keflavik',
        countryCode: 'IS',
      },
      arrivalDate: '',
      departureAirport: {
        iata: '',
        icao: '',
        name: '',
        countryCode: '',
        city: '',
      },
      departureDate: new Date(),
      flightNumber: '',
      selectedFlight: undefined,
    },
    arrivalBaggageInformation: {
      baggage: { amount: 1, oddSizeAmount: 0 },
    },
    arrivalInfo: {
      deliveryAddress: '',
      deliveryHotelName: '',
      deliverySlot: '',
      meetingPoint: 'customs_gate',
      comments: '',
    },
    arrivalCheckoutPrice: {
      amount: 0,
      currency: 'ISK',
    },
  },
  updateComments: (comments: PickupInformation['comments']) => {
    set((state) => ({
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
    hotelName: PickupInformation['hotelName']
  ) => {
    set((state) => ({
      booking: {
        ...state.booking,
        pickupInformation: {
          ...state.booking.pickupInformation,
          pickupLocation,
          hotelName,
        },
      },
    }))
  },
  updatePostalCode: (postalCode: PickupInformation['postalCode']) => {
    set((state) => ({
      booking: {
        ...state.booking,
        pickupInformation: {
          ...state.booking.pickupInformation,
          postalCode,
        },
      },
    }))
  },
  updatePickupSlot: (pickupSlot: PickupInformation['pickupSlot']) => {
    set((state) => ({
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
      booking: { ...state.booking, customerInfo: customer },
    })),
  clearCustomerData: () => set({ booking: undefined }),
  updateAirline: (airline: Airline) =>
    set((state) => ({
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
      booking: {
        ...state.booking,
        availableFlights: flights,
      },
    })),
  // Service type
  updateServiceType: (serviceType: ServiceType) =>
    set((state) => ({
      booking: { ...state.booking, serviceType },
    })),
  // Arrival actions
  updateArrivalAirline: (airline: Airline) =>
    set((state) => ({
      booking: {
        ...state.booking,
        arrivalFlightInformation: {
          ...state.booking.arrivalFlightInformation!,
          airline,
        },
      },
    })),
  updateArrivalDepartureAirport: (airport: Airport) =>
    set((state) => ({
      booking: {
        ...state.booking,
        arrivalFlightInformation: {
          ...state.booking.arrivalFlightInformation!,
          departureAirport: airport,
        },
      },
    })),
  updateArrivalArrivalAirport: (airport: Airport) =>
    set((state) => ({
      booking: {
        ...state.booking,
        arrivalFlightInformation: {
          ...state.booking.arrivalFlightInformation!,
          arrivalAirport: airport,
        },
      },
    })),
  updateArrivalDepartureDate: (date: Date) =>
    set((state) => ({
      booking: {
        ...state.booking,
        arrivalFlightInformation: {
          ...state.booking.arrivalFlightInformation!,
          departureDate: date,
        },
      },
    })),
  updateArrivalSelectedFlight: (flight: FlightData) =>
    set((state) => ({
      booking: {
        ...state.booking,
        arrivalFlightInformation: {
          ...state.booking.arrivalFlightInformation!,
          selectedFlight: flight,
        },
      },
    })),
  updateArrivalAvailableFlights: (flights: FlightData[]) =>
    set((state) => ({
      booking: {
        ...state.booking,
        arrivalAvailableFlights: flights,
      },
    })),
  updateArrivalBaggage: (amount: number) =>
    set((state) => ({
      booking: {
        ...state.booking,
        arrivalBaggageInformation: {
          ...state.booking.arrivalBaggageInformation!,
          baggage: {
            ...state.booking.arrivalBaggageInformation!.baggage,
            amount,
          },
        },
      },
    })),
  updateArrivalOddsize: (oddSizeAmount: number) =>
    set((state) => ({
      booking: {
        ...state.booking,
        arrivalBaggageInformation: {
          ...state.booking.arrivalBaggageInformation!,
          baggage: {
            ...state.booking.arrivalBaggageInformation!.baggage,
            oddSizeAmount,
          },
        },
      },
    })),
  updateArrivalCheckoutPrice: (price: Price) =>
    set((state) => ({
      booking: {
        ...state.booking,
        arrivalCheckoutPrice: price,
      },
    })),
  updateArrivalInfo: (info: Partial<ArrivalInformation>) =>
    set((state) => ({
      booking: {
        ...state.booking,
        arrivalInfo: {
          ...state.booking.arrivalInfo!,
          ...info,
        },
      },
    })),
}))
