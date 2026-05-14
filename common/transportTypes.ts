// Types for the /transport booking flow. Mirrors the data we collect on the
// page and the shape the pricing engine consumes. No runtime code lives here.

export type LocationKind =
  | 'kef-airport'
  | 'cruise-skarfabakki'
  | 'cruise-midbakki'
  | 'cruise-kornargardar'
  | 'hotel-pickup'
  | 'hotel-delivery'
  | 'bsi-flybus'
  | 'manual-address'

export type TimeSlotCategory = 'morning' | 'evening'

export type Locale = 'en' | 'is'

export type LocalizedLabel = { en: string; is: string }

export type TransportLocation = {
  kind: LocationKind
  label: LocalizedLabel
  availableForPickup: boolean
  availableForDelivery: boolean
  // KEF airport flag — adds the airport surcharge per leg and opens the
  // outside-opening-hours toggle.
  triggersAirportSurcharge: boolean
  hasOutsideHoursToggle: boolean
  // Conditional fields revealed in the form once this location is selected.
  requiresFlightNumber: boolean
  requiresCruiseShipName: boolean
  requiresHotelName: boolean
  requiresAddress: boolean
  sortOrder: number
}

export type TransportTimeSlot = {
  value: string // e.g. '08:00 - 08:30' — used as the canonical key + displayed text
  category: TimeSlotCategory
  isFlexible: boolean // the wide '08:00 - 12:00 (flexible for the driver)' style
  availableForPickup: boolean
  availableForDelivery: boolean
  sortOrder: number
}

export type TransportAddress = {
  street: string
  zip: string
  hotelName: string // empty unless a hotel location is chosen
}

export type TransportCustomer = {
  name: string
  email: string
  phoneNumber: string
  bookingForCompany: boolean
  kennitala: string // ID for individuals OR company number when bookingForCompany
  comments: string
}

// KEF pickup has two possible service modes, resolved server-side based on
// what we're already running that morning:
//   arrival-service — BagBee driver meets the customer at arrivals on a
//                     morning we're already running a KEF route. Standard
//                     AIRPORT_SURCHARGE per leg.
//   locker          — customer drops bags in our two Bike Pit lockers, we
//                     collect on the next noon or 22:00 trip. Replaces the
//                     AIRPORT_SURCHARGE on the pickup leg with LOCKER_FEE.
// /api/transport/kef-availability returns which mode applies; null means
// we haven't checked yet (no date or no KEF pickup selected).
export type KefPickupMode = 'arrival-service' | 'locker'

export type TransportBooking = {
  // Dates — ISO YYYY-MM-DD strings (we never carry Date objects across the
  // wire; the Apr 2026 partial-order incident burned us on dayjs(undefined)).
  pickupDate: string | null
  deliveryDate: string | null

  bagsCount: number

  // Pick-up leg
  pickupLocation: LocationKind | null
  pickupTime: string | null
  pickupAddress: TransportAddress
  pickupFlightNumber: string // arrival flight number for KEF pick-up
  pickupCruiseShipName: string
  pickupOutsideHours: boolean
  pickupLeaveAtReception: boolean // hotel pickup checkbox
  pickupKefMode: KefPickupMode | null // only meaningful when pickupLocation = kef-airport

  // Delivery leg
  deliveryLocation: LocationKind | null
  deliveryTime: string | null
  deliveryAddress: TransportAddress
  deliveryFlightNumber: string // departure flight number for KEF delivery
  deliveryCruiseShipName: string
  deliveryOutsideHours: boolean
  deliveryLeaveAtReception: boolean

  customer: TransportCustomer
}

export type TransportPricingConstants = {
  legBaseFee: number
  extraBagFee: number
  storagePerBagPerDay: number
  airportSurcharge: number
  outsideHoursMultiplier: number
  // Default supplement applied when a manual address has a zip with no
  // per-postcode override in the Airtable table. We still require an entry
  // in the postcode-surcharge map to fire — we don't auto-apply on unknown
  // postcodes.
  reykjanesbaerSupplement: number
  bulkDiscountThreshold: number
  bulkDiscountRate: number
  vatRate: number
  // KEF Bike Pit locker drop-off. Replaces airportSurcharge on the pickup
  // leg when pickupKefMode === 'locker'. Only available Jun–Aug.
  lockerFee: number
  lockerCapacityPerDay: number
  lockerSeasonStartMonth: number // 1-12 inclusive
  lockerSeasonEndMonth: number // 1-12 inclusive
}

export type PriceLineItem = {
  key: string
  label: LocalizedLabel
  amount: number
}

export type PriceBreakdown = {
  lineItems: PriceLineItem[]
  subtotal: number
  discount: number
  total: number
  vatIncluded: number
  currency: 'ISK'
}

export type PricingContext = {
  pricing: TransportPricingConstants
  // Map of postcode → ISK surcharge. Loaded from the Postal Code Cutoffs
  // table (`Transport Surcharge` column). e.g. { '230': 28000 }.
  postcodeSurcharges: Record<string, number>
}

// Response shape of /api/transport/kef-availability. Lives here (not in the
// API route file) so client components can import the type without dragging
// in the route's server-only dependencies through Next.js's dependency graph.
export type KefDriverWindow = {
  startHour: number // 0–23.99, decimal so 06:30 = 6.5
  endHour: number
  label: string // raw Tímasetning string, useful for debugging
}

export type KefAvailability = {
  driverWindows: KefDriverWindow[]
  lockersInUse: number
  lockerCapacity: number
  inLockerSeason: boolean
}
