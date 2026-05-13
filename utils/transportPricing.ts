import {
  PriceBreakdown,
  PriceLineItem,
  PricingContext,
  TransportBooking,
} from '../common/transportTypes'
import {
  FALLBACK_POSTCODE_SURCHARGES,
  FALLBACK_TRANSPORT_PRICING,
  findLocation,
} from '../common/transportConstants'

// Pure pricing engine. Given a booking + a pricing context, returns a fully
// itemised breakdown. No I/O, no side effects — call it on every keystroke.
//
// Model (verified against the live Fillout form on book.bagbee.is/transport):
//   transport = legs × LEG_BASE_FEE + max(0, bags-1) × EXTRA_BAG_FEE
//   storage   = bags × days × STORAGE_PER_BAG_PER_DAY
//   airport   = 28800 per KEF leg
//   outside-h = AIRPORT_SURCHARGE × 0.6 per KEF leg with the toggle on
//   zip-sup   = postcode surcharge per manual-address leg in the surcharge map
//   discount  = 10% off subtotal when bags > 10
//   total     = subtotal − discount  (VAT-inclusive)
export const calculateTransportPrice = (
  booking: TransportBooking,
  ctx: PricingContext,
): PriceBreakdown => {
  const { pricing, postcodeSurcharges } = ctx
  const lineItems: PriceLineItem[] = []

  const legsCount = countLegs(booking)
  const bags = Math.max(0, booking.bagsCount)

  // Special case: customer drops off AND picks up at the BSÍ Flybus counter
  // themselves. BagBee runs a manned counter at BSÍ in the summer months
  // (Jun–Aug, 06:45–17:00) — when both legs are BSÍ there is no driver
  // involved on either end, so the transport fee is waived. Storage still
  // applies on its own line.
  const isBsiSelfService =
    booking.pickupLocation === 'bsi-flybus' &&
    booking.deliveryLocation === 'bsi-flybus'

  // 1. Transport fee
  if (legsCount > 0 && bags > 0 && !isBsiSelfService) {
    const transportFee =
      legsCount * pricing.legBaseFee + Math.max(0, bags - 1) * pricing.extraBagFee
    lineItems.push({
      key: 'transport',
      label: { en: 'Transport fee', is: 'Flutningsgjald' },
      amount: transportFee,
    })
  }

  // 2. Storage fee
  const days = calculateStorageDays(booking.pickupDate, booking.deliveryDate)
  if (days > 0 && bags > 0) {
    lineItems.push({
      key: 'storage',
      label: { en: 'Storage fee', is: 'Geymslugjald' },
      amount: pricing.storagePerBagPerDay * bags * days,
    })
  }

  // 3. KEF surcharges. Pricing was simplified — pickup at KEF is now a flat
  // LOCKER_FEE (10k) regardless of whether the customer meets a driver at
  // arrivals or drops bags in the Bike Pit lockers. Mode-specific copy lives
  // on the page; pricing doesn't care. Delivery TO KEF still uses the heavier
  // AIRPORT_SURCHARGE because it's a dedicated drive out to the check-in
  // counter that we don't piggyback on a daily route.
  const pickupIsKef = locationTriggersAirport(booking.pickupLocation)
  const deliveryIsKef = locationTriggersAirport(booking.deliveryLocation)

  if (pickupIsKef) {
    lineItems.push({
      key: 'kef-pickup-fee',
      label: { en: 'KEF airport pick-up', is: 'Sókn á KEF flugvöll' },
      amount: pricing.lockerFee,
    })
  }
  if (deliveryIsKef) {
    lineItems.push({
      key: 'airport-surcharge',
      label: { en: 'KEF airport delivery', is: 'Afhending á KEF flugvöll' },
      amount: pricing.airportSurcharge,
    })
  }

  // Aliases — kept so the outside-hours block (now dead, toggle removed
  // from the UI) compiles. Outside-hours surcharge logic remains in case
  // ops re-enables the toggle later, but currently always evaluates to 0.
  const pickupIsKefArrival = pickupIsKef

  // 4. Outside-opening-hours surcharge — only applies when the leg is KEF
  // AND its outside-hours toggle is on AND BagBee is meeting the customer
  // (locker mode has fixed pickup times at noon/22:00, so the customer's
  // arrival time doesn't change driver logistics — no surcharge there).
  const pickupOutside =
    booking.pickupOutsideHours && pickupIsKefArrival
      ? Math.round(pricing.airportSurcharge * pricing.outsideHoursMultiplier)
      : 0
  const deliveryOutside =
    booking.deliveryOutsideHours && deliveryIsKef
      ? Math.round(pricing.airportSurcharge * pricing.outsideHoursMultiplier)
      : 0
  if (pickupOutside + deliveryOutside > 0) {
    lineItems.push({
      key: 'outside-hours',
      label: {
        en: 'Outside opening hours surcharge',
        is: 'Álag utan opnunartíma',
      },
      amount: pickupOutside + deliveryOutside,
    })
  }

  // 5. Postcode surcharge (Reykjanesbær / similar). Per leg with a
  // manual-address location whose zip is in the surcharge map.
  const pickupZip = zipSurchargeForLeg(
    booking.pickupLocation,
    booking.pickupAddress.zip,
    postcodeSurcharges,
  )
  const deliveryZip = zipSurchargeForLeg(
    booking.deliveryLocation,
    booking.deliveryAddress.zip,
    postcodeSurcharges,
  )
  if (pickupZip + deliveryZip > 0) {
    lineItems.push({
      key: 'zip-surcharge',
      label: { en: 'Out-of-area supplement', is: 'Svæðisálag' },
      amount: pickupZip + deliveryZip,
    })
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)

  // 6. Bulk discount
  const discount =
    bags > pricing.bulkDiscountThreshold
      ? Math.round(subtotal * pricing.bulkDiscountRate)
      : 0

  const total = subtotal - discount
  // VAT-inclusive prices — back-compute the VAT portion so the order page
  // and Payday invoice can show net + VAT separately.
  const vatIncluded =
    total > 0 ? Math.round(total - total / (1 + pricing.vatRate)) : 0

  return {
    lineItems,
    subtotal,
    discount,
    total,
    vatIncluded,
    currency: 'ISK',
  }
}

const countLegs = (booking: TransportBooking): number =>
  (booking.pickupLocation ? 1 : 0) + (booking.deliveryLocation ? 1 : 0)

const locationTriggersAirport = (kind: string | null): boolean =>
  findLocation(kind)?.triggersAirportSurcharge ?? false

const zipSurchargeForLeg = (
  loc: string | null,
  zip: string,
  table: Record<string, number>,
): number => {
  if (loc !== 'manual-address') return 0
  const trimmed = zip?.trim?.() ?? ''
  if (!trimmed) return 0
  return table[trimmed] ?? 0
}

// Calendar-day difference between pickup and delivery. Same-day = 0 (direct
// transfer, no storage charge). End-before-start = 0 (defensive — bad state
// shouldn't bill anything).
const calculateStorageDays = (
  start: string | null,
  end: string | null,
): number => {
  if (!start || !end) return 0
  const s = parseYmd(start)
  const e = parseYmd(end)
  if (!s || !e) return 0
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 0
}

const parseYmd = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return Number.isNaN(d.getTime()) ? null : d
}

// v1: synchronous fallback constants. v2 (later) will fetch from the
// `Transport Pricing` table in the BagBee Pricelist & Calculator base
// (appNuoiEB2GzoR4Ak) on the server and pass them down to the client via
// getServerSideProps so pricing can be edited without redeploys.
export const defaultPricingContext = (): PricingContext => ({
  pricing: FALLBACK_TRANSPORT_PRICING,
  postcodeSurcharges: FALLBACK_POSTCODE_SURCHARGES,
})
