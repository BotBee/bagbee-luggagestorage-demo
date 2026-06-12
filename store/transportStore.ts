/* eslint-disable no-unused-vars */
import { create } from 'zustand'
import { TransportBooking } from '../common/transportTypes'

// In-memory only for v1. The original Fillout form didn't persist either, and
// dropping the `persist` middleware sidesteps a whole class of SSR/hydration
// mismatch bugs (server renders the empty default, client localStorage might
// have different state → React tears down the form tree). If we want
// "your last booking is remembered" later, we can add it back with explicit
// `skipHydration: true` + a manual `rehydrate()` call after mount.

const emptyBooking = (): TransportBooking => ({
  pickupDate: null,
  deliveryDate: null,
  bagsCount: 1,
  pickupLocation: null,
  pickupTime: null,
  pickupAddress: { street: '', zip: '', hotelName: '' },
  pickupFlightNumber: '',
  pickupCruiseShipName: '',
  pickupOutsideHours: false,
  pickupLeaveAtReception: false,
  pickupKefMode: null,
  deliveryLocation: null,
  deliveryTime: null,
  deliveryAddress: { street: '', zip: '', hotelName: '' },
  deliveryFlightNumber: '',
  deliveryCruiseShipName: '',
  deliveryOutsideHours: false,
  deliveryLeaveAtReception: false,
  customer: {
    name: '',
    email: '',
    phoneNumber: '',
    bookingForCompany: false,
    kennitala: '',
    comments: '',
  },
})

interface TransportState {
  booking: TransportBooking
  setBooking: (patch: Partial<TransportBooking>) => void
  setPickupAddress: (patch: Partial<TransportBooking['pickupAddress']>) => void
  setDeliveryAddress: (patch: Partial<TransportBooking['deliveryAddress']>) => void
  setCustomer: (patch: Partial<TransportBooking['customer']>) => void
  reset: () => void
}

export const useTransportStore = create<TransportState>((set) => ({
  booking: emptyBooking(),
  setBooking: (patch) =>
    set((state) => ({ booking: { ...state.booking, ...patch } })),
  setPickupAddress: (patch) =>
    set((state) => ({
      booking: {
        ...state.booking,
        pickupAddress: { ...state.booking.pickupAddress, ...patch },
      },
    })),
  setDeliveryAddress: (patch) =>
    set((state) => ({
      booking: {
        ...state.booking,
        deliveryAddress: { ...state.booking.deliveryAddress, ...patch },
      },
    })),
  setCustomer: (patch) =>
    set((state) => ({
      booking: {
        ...state.booking,
        customer: { ...state.booking.customer, ...patch },
      },
    })),
  reset: () => set({ booking: emptyBooking() }),
}))

// Debug handle on window — read live state from the browser console when
// troubleshooting a customer's stuck booking.
if (typeof window !== 'undefined') {
  ;(window as any).__bagbeeTransportStore = useTransportStore
}
