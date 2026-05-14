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

  // Afternoon delivery slot — only offered for hotel deliveries. Cruise
  // terminals were previously included, but per operator feedback the
  // harbor flow needs evening hourly slots instead (cruise ships often
  // depart in the evening; bags need to be at the terminal by then).
  // Hotels happily take afternoon deliveries in to reception.
  {
    value: '14:00 - 15:00',
    category: 'morning', // category-naming wart; this is just an afternoon slot
    isFlexible: false,
    availableForPickup: false,
    availableForDelivery: true,
    sortOrder: 70,
    restrictDeliveryToLocations: ['hotel-delivery'],
  },

  // Evening flex — both legs
  {
    value: '19:00 - 22:00 (flexible for the driver)',
    category: 'evening',
    isFlexible: true,
    availableForPickup: true,
    availableForDelivery: true,
    sortOrder: 100,
  },
  // Evening hourly — delivery: available everywhere (existing behaviour).
  // Pickup: only at the three cruise terminals (cruise ships often
  // disembark late; hotels/KEF/manual addresses don't generate evening
  // pickup runs). Restricted via restrictPickupToLocations.
  {
    value: '17:00 - 18:00',
    category: 'evening',
    isFlexible: false,
    availableForPickup: true,
    availableForDelivery: true,
    sortOrder: 110,
    restrictPickupToLocations: ['cruise-skarfabakki', 'cruise-midbakki', 'cruise-kornargardar'],
  },
  {
    value: '18:00 - 19:00',
    category: 'evening',
    isFlexible: false,
    availableForPickup: true,
    availableForDelivery: true,
    sortOrder: 120,
    restrictPickupToLocations: ['cruise-skarfabakki', 'cruise-midbakki', 'cruise-kornargardar'],
  },
  {
    value: '19:00 - 20:00',
    category: 'evening',
    isFlexible: false,
    availableForPickup: true,
    availableForDelivery: true,
    sortOrder: 130,
    restrictPickupToLocations: ['cruise-skarfabakki', 'cruise-midbakki', 'cruise-kornargardar'],
  },
  {
    value: '20:00 - 21:00',
    category: 'evening',
    isFlexible: false,
    availableForPickup: true,
    availableForDelivery: true,
    sortOrder: 140,
    restrictPickupToLocations: ['cruise-skarfabakki', 'cruise-midbakki', 'cruise-kornargardar'],
  },
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

// Extract the START hour of a time-window string like '08:30 - 09:00' or
// '14:00 - 15:00 (flexible)'. Used to filter out slots that would be
// physically impossible given the pickup logistics. Returns null for
// special slots that don't have a parseable HH:MM start (e.g. the BSÍ
// after-hours locker option).
export const parseSlotStartHour = (slot: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(slot.trim())
  if (!m) return null
  const h = parseInt(m[1], 10) + parseInt(m[2], 10) / 60
  return Number.isFinite(h) ? h : null
}

// Earliest delivery hour given the pickup config, when pickup and delivery
// fall on the same calendar day. Multi-day deliveries return 0 (no
// constraint — bags can sit in BagBee's hands overnight).
//
// Logic: KEF pickup bags get into BagBee's hands at noon (morning landing,
// locker collection) or 22:00 (afternoon landing). Add ~2 hours buffer
// for the transit + handoff. Other pickup locations have a fast hand-off
// (driver collects directly from customer) so no minimum is enforced.
export const minSameDayDeliveryHour = (
  pickupLocation: string | null | undefined,
  pickupDate: string | null | undefined,
  deliveryDate: string | null | undefined,
  pickupTime: string | null | undefined,
): number => {
  if (!pickupDate || !deliveryDate) return 0
  if (pickupDate !== deliveryDate) return 0
  if (pickupLocation !== 'kef-airport') return 0
  const landing = parseSlotStartHour(pickupTime || '')
  // Without a known landing time, fall back to the morning-collection
  // assumption (noon + 2h buffer) — least restrictive of the same-day
  // limits, won't accidentally hide legit slots.
  if (landing === null) return 14
  if (landing < 12) return 14 // bags collected at noon → earliest 14:00
  // Landings at noon or later mean the next BagBee KEF run is 22:00;
  // same-day delivery after that is impractical. Return a number > 24
  // so every same-day delivery slot gets filtered out and the customer
  // sees an empty list, which is the truthful answer.
  return 25
}

// Time slot options for a given leg. Returns the BSI-specific slot set when
// the leg is at BSÍ Flybus (its own opening hours + after-hours locker
// option), and the regular morning/evening route slots otherwise. Slots
// can opt-in to specific locations on either side:
//   - restrictDeliveryToLocations narrows the slot to specific delivery
//     locations (e.g. 14:00–15:00 is hotel-delivery only).
//   - restrictPickupToLocations narrows the slot to specific pickup
//     locations (e.g. 17:00–21:00 hourly slots are cruise-terminal only).
// The `minStartHour` option filters out slots starting earlier than the
// given hour (used when KEF pickup makes morning same-day delivery
// physically impossible).
export const timeSlotOptionsForLocation = (
  location: string | null | undefined,
  side: 'pickup' | 'delivery',
  opts?: { minStartHour?: number },
): TransportTimeSlot[] => {
  const source =
    location === 'bsi-flybus' ? TRANSPORT_BSI_TIME_SLOTS : TRANSPORT_TIME_SLOTS
  const flag = side === 'pickup' ? 'availableForPickup' : 'availableForDelivery'
  const minHour = opts?.minStartHour ?? 0
  return source
    .filter((s) => s[flag])
    .filter((s) => {
      if (side === 'delivery') {
        if (!s.restrictDeliveryToLocations) return true
        return location ? s.restrictDeliveryToLocations.includes(location as any) : false
      }
      // pickup
      if (!s.restrictPickupToLocations) return true
      return location ? s.restrictPickupToLocations.includes(location as any) : false
    })
    .filter((s) => {
      if (minHour <= 0) return true
      const startH = parseSlotStartHour(s.value)
      // Slots without a parseable start (e.g. the BSÍ after-hours locker)
      // are kept as-is — the min-hour filter only applies to numeric slots.
      return startH === null ? true : startH >= minHour
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

// Legacy helpers — kept for any external callers; new code should use
// timeSlotOptionsForLocation so it adapts to the selected location.
export const pickupTimeSlotOptions = (): TransportTimeSlot[] =>
  timeSlotOptionsForLocation(null, 'pickup')

export const deliveryTimeSlotOptions = (): TransportTimeSlot[] =>
  timeSlotOptionsForLocation(null, 'delivery')
