/**
 * Shared luggage-storage pricing. Used by:
 *   - /pages/luggagestorage.tsx          (client, initial booking form)
 *   - /pages/api/storage/checkout.ts     (server, initial booking)
 *   - /pages/api/storage/[id]/edit.ts    (server, edit + top-up flow)
 *
 * Single source of truth — when prices change, change them here.
 */

export const PRICE_LUGGAGE_PER_DAY = 1500
export const PRICE_BACKPACK_FLAT = 1000
export const PRICE_LATE_PER_BAG = 500
export const PRICE_DELIVERY_FLAT = 2500

/**
 * A set of storage rates. BagBee's own brand and the partner brands that sell
 * the same BSÍ depot (currently luggagelockers.is) charge different published
 * prices, so the booking's `Reference` field selects which profile applies —
 * see `getStorageRates`. Threaded through every place a total is (re)computed:
 * the embed form, checkout, the self-service edit, and the webhook/redirect
 * top-up apply paths.
 */
export type RateProfile = {
  luggagePerDay: number
  /** Per-item backpack/purse rate. Multiplied by days when `backpackPerDay`. */
  backpackRate: number
  backpackPerDay: boolean
  latePerBag: number
  deliveryFlat: number
}

/** BagBee's own /luggagestorage rates. The default for any untagged booking. */
export const RATE_BAGBEE: RateProfile = {
  luggagePerDay: PRICE_LUGGAGE_PER_DAY,
  backpackRate: PRICE_BACKPACK_FLAT,
  backpackPerDay: false,
  latePerBag: PRICE_LATE_PER_BAG,
  deliveryFlat: PRICE_DELIVERY_FLAT,
}

/**
 * luggagelockers.is published rates: bags 2000 ISK/day, backpacks 1000 ISK/day
 * (per-day, unlike BagBee's flat backpack fee). Late pickup (bags collected from
 * the lockers after 17:00) is 500 ISK per bag, same as BagBee. No hotel
 * delivery, so deliveryFlat is 0.
 */
export const RATE_LUGGAGE_LOCKERS: RateProfile = {
  luggagePerDay: 2000,
  backpackRate: 1000,
  backpackPerDay: true,
  latePerBag: PRICE_LATE_PER_BAG,
  deliveryFlat: 0,
}

/**
 * Source labels written to the BSI Storage `Reference` field. Every booking is
 * tagged by where it came from so the one shared table stays sortable:
 *   - luggagelockers.is  → partner popup (partner rates)
 *   - bikerent.is        → partner popup (bike-box pricing; see bikerentPricing)
 *   - bagbee.is          → BagBee's own /luggagestorage form (default rates)
 *   - "locally created"  → rows added by staff via an Airtable form (manual)
 */
export const LUGGAGE_LOCKERS_REFERENCE = 'luggagelockers.is'
export const BAGBEE_REFERENCE = 'bagbee.is'

/** Pick the rate profile for a (luggage) booking from its `Reference` field. */
export const getStorageRates = (reference?: string): RateProfile =>
  reference === LUGGAGE_LOCKERS_REFERENCE ? RATE_LUGGAGE_LOCKERS : RATE_BAGBEE

export type StorageInputs = {
  arrivalDate?: string
  departureDate?: string
  luggage?: number
  backpacks?: number
  late?: boolean
  delivery?: boolean
  /**
   * If set on the record, the booking is a "Storage and Check-in" job —
   * BagBee stores the bag for a few days, then checks it in for this flight
   * without meeting the customer again (passport + seal at drop-off).
   * Overrides every other Type of storage label.
   */
  flightDate?: string
}

export const daysBetween = (a?: string, b?: string): number => {
  if (!a || !b) return 0
  const s = new Date(a).getTime()
  const e = new Date(b).getTime()
  if (isNaN(s) || isNaN(e) || e < s) return 0
  return Math.max(1, Math.ceil((e - s) / 86400000))
}

export const calcStoragePrice = (v: StorageInputs, rates: RateProfile = RATE_BAGBEE) => {
  const days = daysBetween(v.arrivalDate, v.departureDate) || 1
  const luggage = Number(v.luggage) || 0
  const backpacks = Number(v.backpacks) || 0
  const backpack = rates.backpackPerDay
    ? backpacks * rates.backpackRate * days
    : backpacks * rates.backpackRate
  const base = luggage * rates.luggagePerDay * days + backpack
  const late = v.late ? luggage * rates.latePerBag : 0
  const delivery = v.delivery ? rates.deliveryFlat : 0
  return { days, base, late, delivery, total: base + late + delivery }
}

/**
 * Maps the booking inputs to one of the 7 Airtable `Type of storage` options.
 *
 *   Storage and Check-in       → flightDate is set (dominant — bag is bound
 *                                 for the airport, not picked up by customer)
 *   Hotel Delivery             → delivery flag is on
 *   Long term + late check-out → multi-day AND late pickup
 *   Long term storage          → multi-day, normal pickup window
 *   Put to luggage lockers     → same-day, pickup after BSÍ closing (17:00)
 *   Short term storage         → same-day, pickup before closing
 *
 * (`Cruise day-storage` stays operator-only.)
 */
export const deriveStorageType = (v: StorageInputs): string => {
  if (v.flightDate) return 'Storage and Check-in'
  if (v.delivery) return 'Hotel Delivery'
  const days = daysBetween(v.arrivalDate, v.departureDate)
  if (days > 1 && v.late) return 'Long term + late check-out'
  if (days > 1) return 'Long term storage'
  // Same-day branch
  if (v.late) return 'Put to luggage lockers'
  return 'Short term storage'
}
