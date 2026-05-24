// Server-side price calculator for the partner portal.
//
// Source of truth is the Airtable "Pricelist" table (one row per tier).
// We cache the read in-memory per process for 30 minutes — prices change
// rarely, and Vercel serverless cold-starts already give us cache
// invalidation for free.
//
// Calculation logic:
//   1. Find the row matching {customer, service category, unit}.
//   2. Look up the row whose [Min units, Max units] range contains the
//      input count (pax or bags).
//   3. price = base + per_extra × max(0, count - base_unit_count)
//   4. If the order's pickup time-window starts in an evening/night
//      bracket, multiply by (1 + surcharge_pct).
//
// If anything doesn't match → return { kind: 'out-of-pricelist' } so the
// portal shows "we'll send an offer" instead of guessing a number.

import Airtable from 'airtable'

const BASE_ID = 'appHB2bNYPAhfUcLv'
const PRICELIST_TABLE = 'tblFI1oodkwTvnb8K'

const F = {
  name: 'fldZC7KxdVvqfAbZb',
  customer: 'fldM80Ane9rFxzxf7',
  serviceCategory: 'fldpHys5z5xzDYG6s',
  unit: 'fldzUOVxdNwWq7kx9',
  minUnits: 'fldB4yC6UsNOW4A7j',
  maxUnits: 'fldo0r3WIM7FyYK7o',
  baseUnitCount: 'fldqzoVUUpxJEFmHR',
  basePriceIsk: 'fldTUXkqIhZJhzItc',
  perExtraUnitIsk: 'fldEEKPYNZiEC3wpW',
  active: 'fldNIsFDXNOEjs2G0',
  notes: 'fldAh5Dz7jJvh9WBq',
} as const

export type PricelistCustomer = 'Iceland Travel' | 'Standard'
export type PricelistCategory =
  | 'BSI to Hotel'
  | 'Capital area transfer'
  | 'Airport transfer'
  | 'Wait time'
export type PricelistUnit = 'pax' | 'bags' | 'hour'

export type PricelistRow = {
  id: string
  name: string
  customer: PricelistCustomer
  category: PricelistCategory
  unit: PricelistUnit
  minUnits: number
  maxUnits: number
  baseUnitCount: number
  basePriceIsk: number
  perExtraUnitIsk: number
  notes: string | null
}

// In-memory cache. Vercel keeps the function warm for a few minutes
// after each invocation, so this materially cuts Airtable read load
// without us needing a dedicated cache layer.
const CACHE_TTL_MS = 30 * 60 * 1000
let cachedRows: { rows: PricelistRow[]; fetchedAt: number } | null = null

let cachedBase: ReturnType<typeof Airtable.prototype.base> | null = null
const getBase = () => {
  if (cachedBase) return cachedBase
  const apiKey = process.env.AIRTABLE_ACCESS_TOKEN
  if (!apiKey) throw new Error('AIRTABLE_ACCESS_TOKEN missing — pricing disabled')
  cachedBase = new Airtable({ apiKey }).base(BASE_ID)
  return cachedBase
}

const asString = (v: unknown): string | null =>
  typeof v === 'string' ? v : null
const asNumber = (v: unknown): number =>
  typeof v === 'number' ? v : Number(v) || 0

const fetchPricelist = async (): Promise<PricelistRow[]> => {
  if (cachedRows && Date.now() - cachedRows.fetchedAt < CACHE_TTL_MS) {
    return cachedRows.rows
  }
  const base = getBase()
  const records = await base(PRICELIST_TABLE)
    .select({
      // Pull only Active rows so a "draft" pricelist row doesn't leak
      // into live calculations. Use the field-ID syntax so renaming the
      // column doesn't break this filter.
      filterByFormula: `{${F.active}} = TRUE()`,
      pageSize: 100,
    })
    .all()
  const rows: PricelistRow[] = records.map((r) => {
    const f = r.fields as Record<string, unknown>
    return {
      id: r.id,
      name: asString(f['Name']) || '',
      customer: (asString(f['Customer']) || '') as PricelistCustomer,
      category: (asString(f['Service category']) || '') as PricelistCategory,
      unit: (asString(f['Unit']) || '') as PricelistUnit,
      minUnits: asNumber(f['Min units']),
      maxUnits: asNumber(f['Max units']),
      baseUnitCount: asNumber(f['Base unit count']),
      basePriceIsk: asNumber(f['Base price ISK']),
      perExtraUnitIsk: asNumber(f['Per extra unit ISK']),
      notes: asString(f['Notes']),
    }
  })
  cachedRows = { rows, fetchedAt: Date.now() }
  return rows
}

// -------------------- address-based classification --------------------
//
// The pricelist categories are fundamentally about geography:
//   - BSI to Hotel = one end is the BSÍ bus terminal, other end a hotel
//     in the capital area.
//   - Capital area transfer = both ends inside Höfuðborgarsvæðið, neither
//     of them BSÍ.
//   - Airport transfer = one end is KEF airport (not in IT's pricelist).
//
// Classifying the pickup + delivery addresses lets us pick the right
// tier even when the project manager picked the "wrong" service-type
// dropdown on the form, and lets us catch out-of-area requests (Selfoss,
// Akureyri, etc.) early instead of mis-quoting them.
//
// Detection is best-effort regex matching: postcodes if present (most
// reliable), municipality names, plus specific names for BSI and KEF.
// "unknown" means we couldn't classify — the calculator then falls back
// to the service-type hint so half-typed addresses don't break pricing.

export type LocationKind =
  | 'bsi'
  | 'kef-airport'
  | 'capital-area'
  | 'outside-capital'
  | 'unknown'

const BSI_PATTERNS = [
  /\bbs(i|í)\b/i,
  /reykjav(í|i)k\s+bus\s+terminal/i,
  /umferðarmiðstöð/i,
  /vatnsmýrarvegur\s*\d/i,
]

const KEF_PATTERNS = [
  /\bkef\b/i,
  /keflav(í|i)k\s*(airport|international|flugvöll|flugvelli)/i,
  /leif.{0,5}eir[íi]ks/i,
  /flugstöð\s+leifs/i,
]

const CAPITAL_MUNICIPALITIES = [
  /reykjav(í|i)k/i,
  /kópavog/i,
  /hafnarfj/i,
  /garðab/i,
  /gardabae/i,
  /mosfellsb/i,
  /seltjarnarnes/i,
  /álftanes/i,
]

const OUTSIDE_HINTS = [
  /\bselfoss\b/i,
  /\bakureyri\b/i,
  /\bborgarnes\b/i,
  /\bhveragerði\b/i,
  /\bblá(a)?\s*lónið\b/i, // Blue Lagoon — strictly Grindavík (240), out
  /\bvík\b.*mýrdal/i,
  /\bgrindavík\b/i,
  /\breykjanesbær\b/i,
  /\bnjarðvík\b/i,
  /\bsandgerði\b/i,
]

// Map Icelandic postcodes → location kind. Postcodes are the most
// reliable signal because they're locale-stable and unambiguous.
const classifyByPostcode = (pc: number): LocationKind | null => {
  if (pc === 235) return 'kef-airport' // KEF airport
  // Capital area (Höfuðborgarsvæðið) postcode ranges
  if (
    (pc >= 101 && pc <= 162) ||
    pc === 170 ||
    (pc >= 200 && pc <= 212) ||
    (pc >= 220 && pc <= 225) ||
    (pc >= 270 && pc <= 276)
  ) {
    return 'capital-area'
  }
  // Reykjanes peninsula + everything 230+ is outside the capital area
  if (pc >= 230) return 'outside-capital'
  return null
}

export const classifyAddress = (raw: string | null | undefined): LocationKind => {
  if (!raw || !raw.trim()) return 'unknown'
  const addr = raw.trim()
  // BSI first — its building sits inside Reykjavík postcode 101 so a
  // postcode match would mis-classify it as plain capital-area.
  if (BSI_PATTERNS.some((p) => p.test(addr))) return 'bsi'
  if (KEF_PATTERNS.some((p) => p.test(addr))) return 'kef-airport'
  // 3-digit postcode in the address (Icelandic postcodes are 3 digits).
  // Skip 4+ digit "numbers" so we don't accidentally read flight number
  // FI615 as postcode 615 (which would then classify as outside-capital).
  const pcMatch = /(?:^|[^\d])(\d{3})(?:[^\d]|$)/.exec(addr)
  if (pcMatch) {
    const byPc = classifyByPostcode(Number(pcMatch[1]))
    if (byPc) return byPc
  }
  if (OUTSIDE_HINTS.some((p) => p.test(addr))) return 'outside-capital'
  if (CAPITAL_MUNICIPALITIES.some((p) => p.test(addr))) return 'capital-area'
  return 'unknown'
}

// Service-type fallback for the cases where address classification can't
// decide on its own (typically: delivery address is blank or unrecognised).
// Check-in service now maps to Airport transfer — Iceland Travel's
// pricelist gained bag-based airport tiers (A1/A2) so we can quote
// those directly instead of bouncing them to manual.
const SERVICE_TYPE_HINT: Record<string, PricelistCategory | null> = {
  'BSI to Hotel Delivery': 'BSI to Hotel',
  'Pickup & Delivery': 'Capital area transfer',
  'Check-in service': 'Airport transfer',
}

type CategoryResult =
  | { category: PricelistCategory; reason: null }
  | { category: null; reason: string }

const determineCategory = (
  pickupAddress: string | null,
  deliveryAddress: string | null,
  serviceType: string | null,
): CategoryResult => {
  const p = classifyAddress(pickupAddress)
  const d = classifyAddress(deliveryAddress)

  // Hard reject: anything outside the capital area (Selfoss / Akureyri /
  // Reykjanesbær / ...) isn't in the pricelist.
  if (p === 'outside-capital' || d === 'outside-capital') {
    return {
      category: null,
      reason: "Pickup or delivery is outside the capital area — we'll quote.",
    }
  }

  // KEF on either end → Airport transfer (now in the IT pricelist as the
  // bag-based A1/A2 tiers).
  if (p === 'kef-airport' || d === 'kef-airport') {
    return { category: 'Airport transfer', reason: null }
  }

  // BSI on either end → BSI to Hotel rate (other end should be a hotel
  // in the capital area; we allow "unknown" too so a partly-typed
  // delivery address doesn't break the BSI quote).
  if (p === 'bsi' || d === 'bsi') {
    const other = p === 'bsi' ? d : p
    if (other === 'capital-area' || other === 'bsi' || other === 'unknown') {
      return { category: 'BSI to Hotel', reason: null }
    }
  }

  // Both ends in the capital area → capital area transfer.
  if (p === 'capital-area' && d === 'capital-area') {
    return { category: 'Capital area transfer', reason: null }
  }

  // One side capital-area, other side unknown → trust the address we
  // have and fall back to the service-type hint for the missing side.
  if (p === 'capital-area' || d === 'capital-area') {
    const hint = SERVICE_TYPE_HINT[serviceType || '']
    if (hint) return { category: hint, reason: null }
  }

  // Both addresses unknown → service-type-only fallback (legacy behaviour).
  const hint = SERVICE_TYPE_HINT[serviceType || '']
  if (hint) return { category: hint, reason: null }

  return {
    category: null,
    reason: "Pickup / delivery addresses not recognised — we'll quote.",
  }
}

// -------------------- time-of-day surcharges --------------------
//
// Codified inline because they're stable and apply universally; if they
// ever vary per customer we'll add a separate Airtable table for them.
const SURCHARGES: { label: string; pct: number; matches: (h: number) => boolean }[] =
  [
    {
      label: 'Night surcharge (23:00–08:00)',
      pct: 1.0,
      matches: (h) => h >= 23 || h < 8,
    },
    {
      label: 'Evening surcharge (18:00–23:00)',
      pct: 0.25,
      matches: (h) => h >= 18 && h < 23,
    },
  ]

// Parse the start hour from a free-text time window like "11:30 - 12:00"
// (or "11:30-12:00" without spaces, or "11:30 til 12:00" if someone gets
// creative). Returns null if we can't find a parseable HH:MM at the front.
export const parseStartHour = (timeWindow: string | null): number | null => {
  if (!timeWindow) return null
  const m = /(\d{1,2}):(\d{2})/.exec(timeWindow.trim())
  if (!m) return null
  const h = Number(m[1])
  if (!Number.isFinite(h) || h < 0 || h > 23) return null
  return h
}

// -------------------- main calculator --------------------

export type PriceInput = {
  customer: PricelistCustomer
  serviceType: string | null
  bagsRegular: number
  bagsOdd: number
  timeWindow: string | null
  // Addresses are the primary signal for which pricelist tier applies
  // (see determineCategory). Required for the calculator to pick BSI vs
  // capital-area-transfer correctly; either may be null when the form
  // is still being filled out.
  pickupAddress: string | null
  deliveryAddress: string | null
}

export type PriceLineItem = {
  label: string
  amountIsk: number
}

export type PriceQuote =
  | {
      kind: 'priced'
      // Total in ISK after surcharges, rounded to whole ISK.
      totalIsk: number
      // Subtotal before surcharges.
      subtotalIsk: number
      // Pax that drove the calculation (ceil(bags / 1.5)).
      pax: number
      // The pricelist row that won.
      pricelistRowId: string
      pricelistRowName: string
      lineItems: PriceLineItem[]
    }
  | {
      kind: 'out-of-pricelist'
      // Human-readable reason — surfaced in the UI as "we'll send an offer
      // because <reason>".
      reason: string
    }

// Iceland Travel's 1.5-bags-per-pax estimate (your CEO's rule of thumb).
// Drives the bags→pax conversion for IT auto-quotes.
const BAGS_PER_PAX = 1.5

export const computeOrderPrice = async (
  input: PriceInput,
): Promise<PriceQuote> => {
  if (input.customer !== 'Iceland Travel') {
    // Today the calculator only auto-prices IT. Anything else falls
    // through to manual quote.
    return {
      kind: 'out-of-pricelist',
      reason: 'Customer not in pricelist',
    }
  }
  const decision = determineCategory(
    input.pickupAddress,
    input.deliveryAddress,
    input.serviceType,
  )
  if (decision.category === null) {
    return { kind: 'out-of-pricelist', reason: decision.reason }
  }
  const category = decision.category
  const totalBags = (input.bagsRegular || 0) + (input.bagsOdd || 0)
  if (totalBags <= 0) {
    return {
      kind: 'out-of-pricelist',
      reason: 'Bag count is zero — can\'t calculate yet.',
    }
  }
  const pax = Math.max(1, Math.ceil(totalBags / BAGS_PER_PAX))

  // Pick the pricelist row that fits this request.
  //
  // Iceland Travel has two flavours of tier within most categories:
  //   - pax-based (small groups: 1-70 pax, base + per-extra-pax)
  //   - bags-based (larger groups: 121-300 bags, flat per trip)
  // Airport transfer is bags-only (no pax-based tier exists).
  // BSI to Hotel is pax-only (no bags-based tier).
  //
  // Rule: prefer pax-based when both fit (it's more granular and was the
  // original IT agreement). Fall back to bags-based for larger groups.
  // Return out-of-pricelist when neither covers the request.
  //
  // Intentional gap: Capital area has pax tier 1-70 (≈ up to 105 bags at
  // 1.5 bags/pax) and bags tier 121-300. The 106-120 bag range is
  // deliberately uncovered because the pax tier maxes at one van's
  // capacity — anything above that needs a second vehicle and the
  // operational structure changes. The bags tier 121-300 is a flat
  // 2+ van rate. Requests in the 106-120 gap are typically just-above-
  // one-van and Runar quotes them manually based on actual vehicle plan.
  // **Do not extend either tier to fill the gap** — talk to ops first.
  const rows = await fetchPricelist()
  const itRowsForCategory = rows.filter(
    (r) => r.customer === 'Iceland Travel' && r.category === category,
  )
  const paxRow = itRowsForCategory.find(
    (r) => r.unit === 'pax' && pax >= r.minUnits && pax <= r.maxUnits,
  )
  const bagsRow = itRowsForCategory.find(
    (r) => r.unit === 'bags' && totalBags >= r.minUnits && totalBags <= r.maxUnits,
  )
  const row = paxRow || bagsRow

  if (!row) {
    // Friendly-message logic: figure out WHY there's no match so the PM
    // sees something more useful than "no row matches".
    const hasPaxTier = itRowsForCategory.some((r) => r.unit === 'pax')
    const hasBagsTier = itRowsForCategory.some((r) => r.unit === 'bags')
    const maxPax = Math.max(
      0,
      ...itRowsForCategory.filter((r) => r.unit === 'pax').map((r) => r.maxUnits),
    )
    const minBagsTier = Math.min(
      Infinity,
      ...itRowsForCategory
        .filter((r) => r.unit === 'bags')
        .map((r) => r.minUnits),
    )
    let reason: string
    if (
      hasPaxTier &&
      hasBagsTier &&
      pax > maxPax &&
      totalBags < minBagsTier
    ) {
      // The multi-car gap — most common reason for an in-area, in-category
      // request to fall through.
      reason = `This trip needs more than one vehicle (${pax} pax / ${totalBags} bags) — we'll quote based on vehicle plan.`
    } else {
      reason = `${pax} pax / ${totalBags} bags doesn't fit the ${category} pricelist tiers — we'll quote.`
    }
    return { kind: 'out-of-pricelist', reason }
  }

  // Build the per-tier line items. Pax tiers may have a per-extra charge
  // above the base count; bags tiers are flat per trip.
  const usedCount = row.unit === 'pax' ? pax : totalBags
  const extraUnits = Math.max(0, usedCount - row.baseUnitCount)
  const baseLine: PriceLineItem = {
    label: `${row.name} — base (up to ${row.baseUnitCount} ${row.unit})`,
    amountIsk: row.basePriceIsk,
  }
  const lineItems: PriceLineItem[] = [baseLine]
  let subtotal = row.basePriceIsk
  if (extraUnits > 0 && row.perExtraUnitIsk > 0) {
    const extraAmount = extraUnits * row.perExtraUnitIsk
    lineItems.push({
      label: `+ ${extraUnits} extra ${row.unit} @ ${row.perExtraUnitIsk.toLocaleString('is-IS')} ISK`,
      amountIsk: extraAmount,
    })
    subtotal += extraAmount
  }

  // Surcharge based on the pickup time window's start hour.
  let total = subtotal
  const startHour = parseStartHour(input.timeWindow)
  if (startHour != null) {
    const sur = SURCHARGES.find((s) => s.matches(startHour))
    if (sur) {
      const surAmount = Math.round(subtotal * sur.pct)
      lineItems.push({
        label: `${sur.label} (+${Math.round(sur.pct * 100)}%)`,
        amountIsk: surAmount,
      })
      total += surAmount
    }
  }

  return {
    kind: 'priced',
    totalIsk: Math.round(total),
    subtotalIsk: subtotal,
    pax,
    pricelistRowId: row.id,
    pricelistRowName: row.name,
    lineItems,
  }
}

// Convenience for UI rendering — same logic as Intl.NumberFormat 'is-IS'
// but locale-independent so the dashboard renders identically on every
// device.
export const formatIsk = (amount: number): string => {
  const s = Math.round(amount).toString()
  // Thousands separator = "." (Icelandic convention). Done by hand to
  // avoid bundling Intl polyfills.
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ISK'
}
