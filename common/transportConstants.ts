import {
  TransportLocation,
  TransportTimeSlot,
  TransportPricingConstants,
} from './transportTypes'

// Pickup/delivery dropdown options. Source of truth for the form.
// To add a location: add a row here and translations in en.ts / is.ts.
// `triggersAirportSurcharge` is what binds a location to the +28800/leg fee.
export const TRANSPORT_LOCATIONS: TransportLocation[] = [
  {
    kind: 'kef-airport',
    label: { en: 'KEF International Airport', is: 'Keflavíkurflugvöllur' },
    availableForPickup: true,
    availableForDelivery: true,
    triggersAirportSurcharge: true,
    hasOutsideHoursToggle: true,
    requiresFlightNumber: true,
    requiresCruiseShipName: false,
    requiresHotelName: false,
    requiresAddress: false,
    sortOrder: 10,
  },
  {
    kind: 'cruise-skarfabakki',
    label: { en: 'Skarfabakki Cruise Terminal', is: 'Skarfabakki' },
    availableForPickup: true,
    availableForDelivery: true,
    triggersAirportSurcharge: false,
    hasOutsideHoursToggle: false,
    requiresFlightNumber: false,
    requiresCruiseShipName: true,
    requiresHotelName: false,
    requiresAddress: false,
    sortOrder: 20,
  },
  {
    kind: 'cruise-midbakki',
    label: { en: 'Miðbakki Cruise Terminal', is: 'Miðbakki' },
    availableForPickup: true,
    availableForDelivery: true,
    triggersAirportSurcharge: false,
    hasOutsideHoursToggle: false,
    requiresFlightNumber: false,
    requiresCruiseShipName: true,
    requiresHotelName: false,
    requiresAddress: false,
    sortOrder: 30,
  },
  {
    kind: 'cruise-kornargardar',
    label: { en: 'Kornagarðar Cruise Terminal', is: 'Kornagarðar' },
    availableForPickup: true,
    availableForDelivery: true,
    triggersAirportSurcharge: false,
    hasOutsideHoursToggle: false,
    requiresFlightNumber: false,
    requiresCruiseShipName: true,
    requiresHotelName: false,
    requiresAddress: false,
    sortOrder: 40,
  },
  {
    kind: 'hotel-pickup',
    label: { en: 'Hotel pick-up', is: 'Sótt á hótel' },
    availableForPickup: true,
    availableForDelivery: false,
    triggersAirportSurcharge: false,
    hasOutsideHoursToggle: false,
    requiresFlightNumber: false,
    requiresCruiseShipName: false,
    requiresHotelName: true,
    requiresAddress: true,
    sortOrder: 50,
  },
  {
    kind: 'hotel-delivery',
    label: { en: 'Hotel delivery', is: 'Afhent á hótel' },
    availableForPickup: false,
    availableForDelivery: true,
    triggersAirportSurcharge: false,
    hasOutsideHoursToggle: false,
    requiresFlightNumber: false,
    requiresCruiseShipName: false,
    requiresHotelName: true,
    requiresAddress: true,
    sortOrder: 60,
  },
  {
    kind: 'bsi-flybus',
    label: { en: 'BSÍ bus terminal (Flybus)', is: 'BSÍ (Flybus)' },
    availableForPickup: true,
    availableForDelivery: true,
    triggersAirportSurcharge: false,
    hasOutsideHoursToggle: false,
    requiresFlightNumber: false,
    requiresCruiseShipName: false,
    requiresHotelName: false,
    requiresAddress: false,
    sortOrder: 70,
  },
  {
    kind: 'manual-address',
    label: { en: 'Enter address manually', is: 'Skrá heimilisfang' },
    availableForPickup: true,
    availableForDelivery: true,
    triggersAirportSurcharge: false,
    hasOutsideHoursToggle: false,
    requiresFlightNumber: false,
    requiresCruiseShipName: false,
    requiresHotelName: false,
    requiresAddress: true,
    sortOrder: 80,
  },
]

// Time slot dropdown options. Pickup slots are restricted to morning + the
// flexible evening band (driver only swings out late if asked); delivery
// has more granular evening hours because the driver is already on the route.
export const TRANSPORT_TIME_SLOTS: TransportTimeSlot[] = [
  // Morning — available for both pickup and delivery
  {
    value: '08:00 - 12:00 (flexible for the driver)',
    category: 'morning',
    isFlexible: true,
    availableForPickup: true,
    availableForDelivery: true,
    sortOrder: 10,
  },
  { value: '08:00 - 08:30', category: 'morning', isFlexible: false, availableForPickup: true, availableForDelivery: true, sortOrder: 20 },
  { value: '08:30 - 09:00', category: 'morning', isFlexible: false, availableForPickup: true, availableForDelivery: true, sortOrder: 30 },
  { value: '09:00 - 10:00', category: 'morning', isFlexible: false, availableForPickup: true, availableForDelivery: true, sortOrder: 40 },
  { value: '10:00 - 11:00', category: 'morning', isFlexible: false, availableForPickup: true, availableForDelivery: true, sortOrder: 50 },
  { value: '11:00 - 12:00', category: 'morning', isFlexible: false, availableForPickup: true, availableForDelivery: true, sortOrder: 60 },

  // Evening flex — both legs
  {
    value: '19:00 - 22:00 (flexible for the driver)',
    category: 'evening',
    isFlexible: true,
    availableForPickup: true,
    availableForDelivery: true,
    sortOrder: 100,
  },
  // Evening hourly — delivery only (pickup doesn't currently expose these)
  { value: '17:00 - 18:00', category: 'evening', isFlexible: false, availableForPickup: false, availableForDelivery: true, sortOrder: 110 },
  { value: '18:00 - 19:00', category: 'evening', isFlexible: false, availableForPickup: false, availableForDelivery: true, sortOrder: 120 },
  { value: '19:00 - 20:00', category: 'evening', isFlexible: false, availableForPickup: false, availableForDelivery: true, sortOrder: 130 },
  { value: '20:00 - 21:00', category: 'evening', isFlexible: false, availableForPickup: false, availableForDelivery: true, sortOrder: 140 },
]

// BSI counter has its own opening hours (06:45–17:00 in Jun–Aug) plus an
// after-hours locker option. Different from the regular morning/evening
// route slots above. Used for both pickup and delivery when the leg is BSÍ.
//
// The 'After 17:00' value is special — it routes the booking through the
// BSÍ locker system. The dispatcher emails the customer a PIN + locker
// number; recognised on the dispatch side by the literal string in the
// `Tímasetning` Airtable column.
export const BSI_AFTER_HOURS_SLOT = 'After 17:00 (BSÍ luggage locker)'

export const TRANSPORT_BSI_TIME_SLOTS: TransportTimeSlot[] = [
  { value: '06:45 - 09:00', category: 'morning', isFlexible: false, availableForPickup: true, availableForDelivery: true, sortOrder: 10 },
  { value: '09:00 - 12:00', category: 'morning', isFlexible: false, availableForPickup: true, availableForDelivery: true, sortOrder: 20 },
  { value: '12:00 - 15:00', category: 'morning', isFlexible: false, availableForPickup: true, availableForDelivery: true, sortOrder: 30 },
  { value: '15:00 - 17:00', category: 'morning', isFlexible: false, availableForPickup: true, availableForDelivery: true, sortOrder: 40 },
  { value: BSI_AFTER_HOURS_SLOT, category: 'evening', isFlexible: false, availableForPickup: true, availableForDelivery: true, sortOrder: 50 },
]

// Fallback when the Airtable pricing fetch fails. These mirror the Transport
// Pricing table in the BagBee Pricelist & Calculator base (appNuoiEB2GzoR4Ak).
// Keep them in sync — if you change an Airtable row, change the matching
// constant here too so the fallback isn't lying.
export const FALLBACK_TRANSPORT_PRICING: TransportPricingConstants = {
  legBaseFee: 6990,
  extraBagFee: 1990,
  storagePerBagPerDay: 500,
  airportSurcharge: 28800,
  outsideHoursMultiplier: 0.6,
  reykjanesbaerSupplement: 28000,
  bulkDiscountThreshold: 10,
  bulkDiscountRate: 0.1,
  vatRate: 0.24,
  lockerFee: 10000,
  lockerCapacityPerDay: 2,
  lockerSeasonStartMonth: 6, // June
  lockerSeasonEndMonth: 8, // August
}

// Postcode → surcharge map, used until the Airtable Transport Surcharge
// column read is wired up server-side. Mirrors what's in the Airtable row.
export const FALLBACK_POSTCODE_SURCHARGES: Record<string, number> = {
  '230': 28000, // Reykjanesbær (serviced)
}

export const findLocation = (kind: string | null | undefined): TransportLocation | undefined =>
  kind ? TRANSPORT_LOCATIONS.find((l) => l.kind === kind) : undefined

export const pickupLocationOptions = (): TransportLocation[] =>
  TRANSPORT_LOCATIONS.filter((l) => l.availableForPickup).sort((a, b) => a.sortOrder - b.sortOrder)

export const deliveryLocationOptions = (): TransportLocation[] =>
  TRANSPORT_LOCATIONS.filter((l) => l.availableForDelivery).sort((a, b) => a.sortOrder - b.sortOrder)

// Time slot options for a given leg. Returns the BSI-specific slot set when
// the leg is at BSÍ Flybus (its own opening hours + after-hours locker
// option), and the regular morning/evening route slots otherwise.
export const timeSlotOptionsForLocation = (
  location: string | null | undefined,
  side: 'pickup' | 'delivery',
): TransportTimeSlot[] => {
  const source =
    location === 'bsi-flybus' ? TRANSPORT_BSI_TIME_SLOTS : TRANSPORT_TIME_SLOTS
  const flag = side === 'pickup' ? 'availableForPickup' : 'availableForDelivery'
  return source
    .filter((s) => s[flag])
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

// Legacy helpers — kept for any external callers; new code should use
// timeSlotOptionsForLocation so it adapts to the selected location.
export const pickupTimeSlotOptions = (): TransportTimeSlot[] =>
  timeSlotOptionsForLocation(null, 'pickup')

export const deliveryTimeSlotOptions = (): TransportTimeSlot[] =>
  timeSlotOptionsForLocation(null, 'delivery')
