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

export type PricelistCustomer = 'Iceland Travel' | 'Atlantik' | 'Standard'
export type PricelistCategory =
  // Iceland Travel & Standard categories
  | 'BSI to Hotel'
  | 'Capital area transfer'
  | 'Airport transfer'
  // Shared across all customers
  | 'Wait time'
  // Atlantik named-route categories (per-truck flat rates with bag-capacity
  // tiers). Atlantik's contract is structured around specific tour routes
  // rather than the generic "transfer" categories that IT uses — see
  // determineCategory for how the address classifier picks between them.
  | 'KEF to Reykjavík truck'
  | 'Hotel to Pier truck'
  | 'Reykjavík to Geysir'
  | 'Reykjavík to Retreat'
  | 'Reykjavík to Húsafell'
  | 'Reykjavík to Rangá'
  | 'Reykjavík to UMI'
  | 'KEF to Retreat'
  // Tauck-only sub-tier of Hotel↔Pier. Never auto-picked by the
  // classifier — only ops manually re-categorises a booking to this
  // row when the operator confirms it's a Tauck operation. See routing
  // notes in determineCategory.
  | 'Tauck Grand/Hilton to Pier'
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
  // Specific Atlantik-route endpoints. They're geographically inside
  // 'capital-area' (pier) or 'outside-capital' (geysir/husafell/ranga/
  // umi/retreat) but we surface them as their own kinds so the
  // Atlantik routing in determineCategory can pick the correct
  // named-route pricelist row.
  | 'pier'
  | 'geysir'
  | 'husafell'
  | 'ranga'
  | 'umi'
  | 'retreat'
  | 'outside-capital'
  | 'unknown'

const BSI_PATTERNS = [
  /\bbs(i|í)\b/i,
  /reykjav(í|i)k\s+bus\s+terminal/i,
  /umferðarmiðstöð/i,
  /vatnsmýrarvegur\s*\d/i,
  // Downtown tour-pickup bus stops. Partners book this variant the
  // same way as a BSÍ-terminal trip — the guest is being picked up at
  // a tour-bus signpost in central Reykjavík and delivered to a hotel
  // — so it belongs in the "BSI to Hotel" tier, not the more-expensive
  // capital-area transfer. The pattern matches everything that real
  // bookings have produced so far:
  //   - bare "Bus stop"          (partner types it without picking
  //                               a Google suggestion)
  //   - "Bus Stop 5"             (numbered, our original convention)
  //   - "Bus Stop #12 Höfðatorg" (Google Places' canonical format
  //                               — the # separator was breaking the
  //                               old `\s*\d+` pattern)
  // Loose `\bbus\s*stop\b` covers all three plus any future variant
  // without needing per-format tweaks. Google's autocomplete only
  // surfaces real numbered bus stops in central Reykjavík so the
  // false-positive surface is tiny in practice — a partner address
  // saying "bus stop" almost always IS a tour-pickup signpost.
  /\bbus\s*stop\b/i,
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

// -------- Atlantik named-route endpoints --------
// These get checked BEFORE the postcode/outside-hint fallbacks so the
// specific kind wins. Each pattern is anchored on a uniquely identifiable
// name component — partners book by typing the place name into Google
// Places autocomplete, so the saved address always contains either the
// hotel/landmark name (since the Hotel-name-preservation fix) or the
// recognisable street + postcode the geocoder returns.

const PIER_PATTERNS = [
  /skarfabakki/i,
  /sundah(ö|o)fn/i,
  // Generic "cruise pier" / "cruise terminal" — ops sometimes type just this
  // when the partner is vague about the dock.
  /cruise\s*(pier|terminal)/i,
]

const GEYSIR_PATTERNS = [
  /\bgeysir\b/i,
  /haukadal/i, // Haukadalur valley, where the Geysir hot springs are
]

const HUSAFELL_PATTERNS = [
  /h(ú|u)safell/i,
]

const RANGA_PATTERNS = [
  // Catches "Hótel Rangá", "Hotel Ranga", "Rangárflöt" road, etc.
  /\brang(á|a)\b/i,
]

const UMI_PATTERNS = [
  // "Hotel UMI" / "Umi Hotel" / "UMI" — be strict about the standalone
  // 3-letter token so it doesn't match in random words.
  /\bumi\b/i,
  // The hotel's actual street, in case the partner pastes the address
  // without the name.
  /leirnaveg/i,
]

const RETREAT_PATTERNS = [
  // "Blue Lagoon Retreat" / "The Retreat at Blue Lagoon" / just "Retreat".
  /\bretreat\b/i,
  // Norðurljósavegur (Northern Lights Road), the Retreat's actual street.
  /nor(ð|d)urlj(ó|o)saveg/i,
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
  // Atlantik named-route endpoints. Checked BEFORE the postcode block
  // because most of these fall under postcodes that would otherwise
  // classify them as outside-capital (e.g. 240 Grindavík for the
  // Retreat, 861 Hvolsvöllur for UMI). The pier sits in postcode 104
  // (which IS capital-area) so checking it here is what gives Atlantik
  // the distinct 'pier' kind needed to route to the Hotel↔Pier tier.
  if (RETREAT_PATTERNS.some((p) => p.test(addr))) return 'retreat'
  if (GEYSIR_PATTERNS.some((p) => p.test(addr))) return 'geysir'
  if (HUSAFELL_PATTERNS.some((p) => p.test(addr))) return 'husafell'
  if (RANGA_PATTERNS.some((p) => p.test(addr))) return 'ranga'
  if (UMI_PATTERNS.some((p) => p.test(addr))) return 'umi'
  if (PIER_PATTERNS.some((p) => p.test(addr))) return 'pier'
  // 3-digit postcode in the address (Icelandic postcodes are 3 digits).
  // Must be followed by whitespace + a letter (city name) so we don't
  // misread:
  //   - Plus Codes like "544P+F35" (Google Places autocomplete returns
  //     these for some establishments). The "544" is part of the Plus
  //     Code, not a postcode, and the "P" immediately follows with no
  //     space.
  //   - Flight numbers like "FI615" (no space after).
  //   - Street numbers like "Hringbraut 100" followed by a comma (no
  //     letter immediately after).
  // Real Icelandic addresses have the postcode in the format
  //   "XXX CityName" — e.g. "Pósthússtræti 11, 101 Reykjavík".
  const pcMatch = /(?:^|[\s,])(\d{3})\s+[A-Za-zÁÉÍÓÚÝÞÆÖÐáéíóúýþæöð]/.exec(addr)
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
  customer: PricelistCustomer,
): CategoryResult => {
  const p = classifyAddress(pickupAddress)
  const d = classifyAddress(deliveryAddress)

  // ---------- Atlantik named-route routing ----------
  //
  // Atlantik's pricelist is structured around specific tour routes
  // (Reykjavík↔Geysir, Reykjavík↔Húsafell, Hotel↔cruise-pier, KEF↔Retreat,
  // …) rather than the generic "transfer" categories IT uses. We pick
  // the right named-route based on the pickup/delivery endpoint pair.
  //
  // BSI counts as "capital-area" for Atlantik routing — there's no
  // dedicated BSI tier in Atlantik's pricelist, but a BSÍ-terminal pickup
  // to the pier is operationally the same trip as a downtown-hotel pickup
  // to the pier, so we route it to the Hotel↔Pier truck rate.
  //
  // No match here → fall through to the legacy block below, which will
  // pick a category like 'Capital area transfer' or 'Airport transfer'.
  // Atlantik has no rows for those categories (the calculator returns
  // out-of-pricelist with a clean "we'll quote" reason), so unmatched
  // trips end up at a manual quote rather than a wrong auto-quote.
  if (customer === 'Atlantik') {
    const pNorm = p === 'bsi' ? 'capital-area' : p
    const dNorm = d === 'bsi' ? 'capital-area' : d
    const pair = (a: LocationKind, b: LocationKind) =>
      (pNorm === a && dNorm === b) || (pNorm === b && dNorm === a)

    // KEF↔Retreat has its own row (cheaper than KEF↔Reykjavík + extra
    // detour). Check this BEFORE the generic KEF↔Reykjavík match.
    if (pair('kef-airport', 'retreat')) {
      return { category: 'KEF to Retreat', reason: null }
    }
    if (pair('kef-airport', 'capital-area')) {
      return { category: 'KEF to Reykjavík truck', reason: null }
    }
    if (pair('capital-area', 'retreat')) {
      return { category: 'Reykjavík to Retreat', reason: null }
    }
    if (pair('capital-area', 'geysir')) {
      return { category: 'Reykjavík to Geysir', reason: null }
    }
    if (pair('capital-area', 'husafell')) {
      return { category: 'Reykjavík to Húsafell', reason: null }
    }
    if (pair('capital-area', 'ranga')) {
      return { category: 'Reykjavík to Rangá', reason: null }
    }
    if (pair('capital-area', 'umi')) {
      return { category: 'Reykjavík to UMI', reason: null }
    }
    if (pair('capital-area', 'pier')) {
      // Note: the Tauck-discounted Hotel↔Pier rate (~3k ISK cheaper)
      // intentionally isn't auto-picked. We don't have a "this booking
      // is for Tauck" signal on the form, so ops manually re-categorises
      // the order to 'Tauck Grand/Hilton to Pier' in Airtable when the
      // operator confirms. The default Hotel↔Pier rate is the safe
      // quote — Tauck bookings get re-priced after-the-fact.
      return { category: 'Hotel to Pier truck', reason: null }
    }
    // No Atlantik named route matches → fall through to the legacy
    // routing below. The categories it picks (BSI to Hotel / Capital
    // area transfer / Airport transfer) have no active Atlantik rows,
    // so the calculator will bounce to out-of-pricelist.
  }

  // ---------- legacy IT / Standard routing ----------
  //
  // The new Atlantik-route LocationKinds get collapsed back to their
  // geographic generic kinds here so IT and Standard customers keep
  // their original behaviour:
  //   - pier ≈ capital-area (Skarfabakki is 104 Reykjavík)
  //   - geysir/husafell/ranga/umi/retreat ≈ outside-capital
  const collapse = (k: LocationKind): LocationKind => {
    if (k === 'pier') return 'capital-area'
    if (
      k === 'geysir' ||
      k === 'husafell' ||
      k === 'ranga' ||
      k === 'umi' ||
      k === 'retreat'
    ) {
      return 'outside-capital'
    }
    return k
  }
  const pL = collapse(p)
  const dL = collapse(d)

  // Hard reject: anything outside the capital area (Selfoss / Akureyri /
  // Reykjanesbær / …) isn't in the IT pricelist.
  if (pL === 'outside-capital' || dL === 'outside-capital') {
    return {
      category: null,
      reason: "Pickup or delivery is outside the capital area — we'll quote.",
    }
  }

  // KEF on either end → Airport transfer (now in the IT pricelist as the
  // bag-based A1/A2 tiers).
  if (pL === 'kef-airport' || dL === 'kef-airport') {
    return { category: 'Airport transfer', reason: null }
  }

  // BSI on either end → BSI to Hotel rate (other end should be a hotel
  // in the capital area; we allow "unknown" too so a partly-typed
  // delivery address doesn't break the BSI quote).
  if (pL === 'bsi' || dL === 'bsi') {
    const other = pL === 'bsi' ? dL : pL
    if (other === 'capital-area' || other === 'bsi' || other === 'unknown') {
      return { category: 'BSI to Hotel', reason: null }
    }
  }

  // Both ends in the capital area → capital area transfer.
  if (pL === 'capital-area' && dL === 'capital-area') {
    return { category: 'Capital area transfer', reason: null }
  }

  // One side capital-area, other side unknown → trust the address we
  // have and fall back to the service-type hint for the missing side.
  if (pL === 'capital-area' || dL === 'capital-area') {
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
// Surcharges live in the Airtable Surcharges table (tblKRIqJmko7imrpk).
// Each row: Name, Customer (singleSelect — "All" or specific), Percent
// (integer %, e.g. 100 = +100%), Start hour, End hour (both 0-23, half-
// open window; Start > End wraps midnight), Active checkbox. The
// calculator filters to active rows whose Customer matches the booking
// (or "All"), and for each time window applies the HIGHEST matching
// surcharge. Moving this out of code means ops can edit Night / Evening
// rates without a deploy — just untick Active or change Percent.
const SURCHARGES_TABLE = 'tblKRIqJmko7imrpk'

type Surcharge = {
  label: string
  pct: number // 0.0–1.0 (Airtable stores integer percent; we divide by 100)
  matches: (h: number) => boolean // true if this surcharge covers the hour
  customer: string // 'All' or a specific PricelistCustomer
}

// In-memory cache, same 30-min TTL as the pricelist cache below.
let cachedSurcharges: { rows: Surcharge[]; fetchedAt: number } | null = null

const buildHourMatcher = (
  startHour: number,
  endHour: number,
): ((h: number) => boolean) => {
  // Window is half-open: h in [start, end). When start > end the window
  // wraps midnight (e.g. start=23, end=8 covers 23:00 through 07:59).
  if (startHour <= endHour) {
    return (h) => h >= startHour && h < endHour
  }
  return (h) => h >= startHour || h < endHour
}

const fetchSurcharges = async (): Promise<Surcharge[]> => {
  if (cachedSurcharges && Date.now() - cachedSurcharges.fetchedAt < CACHE_TTL_MS) {
    return cachedSurcharges.rows
  }
  const base = getBase()
  // Active filter mirrors the pricelist read; uses field-ID syntax so
  // a column rename in Airtable doesn't break the lookup.
  const records = await base(SURCHARGES_TABLE)
    .select({
      filterByFormula: `{fldRMRJQQPJv6shFK} = TRUE()`,
      pageSize: 100,
    })
    .all()
  const rows: Surcharge[] = records
    .map((r) => {
      const f = r.fields as Record<string, unknown>
      const name = asString(f['Name']) || 'Surcharge'
      const customer = asString(f['Customer']) || 'All'
      const pctInt = asNumber(f['Percent'])
      const startHour = asNumber(f['Start hour'])
      const endHour = asNumber(f['End hour'])
      if (!pctInt || startHour === endHour) return null
      return {
        label: name,
        pct: pctInt / 100,
        matches: buildHourMatcher(startHour, endHour),
        customer,
      }
    })
    .filter((s): s is Surcharge => s != null)
  cachedSurcharges = { rows, fetchedAt: Date.now() }
  return rows
}

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

// -------------------- forward-year pricing disclaimer --------------------
//
// When the Date of Service lands in a future calendar year, the pricelist
// rates we quote today may not still apply by the time we actually deliver
// the bags — prices roll over annually with the partner contracts. Surface
// a "prices may change" banner alongside the quote so the partner staffer
// and Runar both know the number is provisional.
//
// Threshold is naturally future-proof: anything in a year > current UTC
// year qualifies. Today (2026) → 2027+ is tentative. Once we roll over
// into 2027 → only 2028+ qualifies, no maintenance needed.
export const hasTentativePricing = (
  pickupDateYmd: string | null | undefined,
): boolean => {
  if (!pickupDateYmd) return false
  const m = /^(\d{4})-/.exec(pickupDateYmd)
  if (!m) return false
  const year = Number(m[1])
  if (!Number.isFinite(year)) return false
  return year > new Date().getUTCFullYear()
}

// -------------------- main calculator --------------------

export type PriceInput = {
  customer: PricelistCustomer
  serviceType: string | null
  bagsRegular: number
  bagsOdd: number
  // Explicit passenger count (null = "not entered, fall back to
  // ceil(totalBags / 1.5) estimate"). When provided, this takes
  // precedence on pax-based tiers — BSI to Hotel, Capital area transfer
  // — because partners are actually billed by pax count, and the
  // 1.5-bags-per-pax CEO heuristic is only accurate for leisure groups.
  // Tour-bus groups carry different bag/pax ratios.
  pax: number | null
  timeWindow: string | null
  // Delivery time window — checked alongside the pickup window for
  // time-of-day surcharges. A trip where the bag pickup is at 16:00
  // but the delivery is at 06:00 the next morning still operates
  // partly in night hours and the contract surcharge applies. The
  // calculator picks the HIGHEST applicable surcharge from either
  // end (night > evening > none), so a single nightly leg fires
  // the night rate even if the other leg sits in daytime.
  deliveryTimeWindow?: string | null
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
  // No customer-specific gate here — we let the table drive it. If there
  // are no rows for the customer the row-filter step below comes up empty
  // and we return out-of-pricelist with a clear reason.
  const decision = determineCategory(
    input.pickupAddress,
    input.deliveryAddress,
    input.serviceType,
    input.customer,
  )
  if (decision.category === null) {
    return { kind: 'out-of-pricelist', reason: decision.reason }
  }
  const category = decision.category
  // Bags and pax are interchangeable inputs at the partner-portal level
  // — partners often know one but not the other when they're filling in
  // a quote request, especially for cruise turnarounds (pax known up
  // front, bag count comes later). The calculator accepts whichever
  // they typed and derives the missing dimension via the 1.5-bags-per-
  // pax leisure heuristic.
  //
  //   entered bags + entered pax  → use both verbatim
  //   entered bags only           → pax = ceil(bags / 1.5)
  //   entered pax only            → bags = ceil(pax * 1.5)
  //   neither                     → out-of-pricelist (need one or other)
  //
  // The derived bags value also gets written to Airtable's Töskufjöldi
  // column on order create (see createPartnerOrder) so the dispatcher
  // sees a real bag count on the row from the moment it lands, even
  // when the partner only filled in pax.
  const enteredBags = (input.bagsRegular || 0) + (input.bagsOdd || 0)
  const enteredPax =
    typeof input.pax === 'number' && input.pax > 0 ? Math.floor(input.pax) : null
  if (enteredBags <= 0 && enteredPax == null) {
    return {
      kind: 'out-of-pricelist',
      reason: "Add a bag count or passenger count to get a quote.",
    }
  }
  const pax =
    enteredPax ?? Math.max(1, Math.ceil(enteredBags / BAGS_PER_PAX))
  const totalBags =
    enteredBags > 0 ? enteredBags : Math.ceil(pax * BAGS_PER_PAX)

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
  const customerRowsForCategory = rows.filter(
    (r) => r.customer === input.customer && r.category === category,
  )

  // No rows at all for this customer + category → almost always means
  // we haven't loaded a pricelist for this partner yet (e.g. Atlantik
  // before they send their rates). Bounce to manual quote cleanly.
  if (customerRowsForCategory.length === 0) {
    return {
      kind: 'out-of-pricelist',
      reason: `No ${category} rates set for ${input.customer} yet — we'll quote.`,
    }
  }

  const paxRow = customerRowsForCategory.find(
    (r) => r.unit === 'pax' && pax >= r.minUnits && pax <= r.maxUnits,
  )
  const bagsRow = customerRowsForCategory.find(
    (r) => r.unit === 'bags' && totalBags >= r.minUnits && totalBags <= r.maxUnits,
  )
  const row = paxRow || bagsRow

  if (!row) {
    // Friendly-message logic: figure out WHY there's no match so the PM
    // sees something more useful than "no row matches".
    const hasPaxTier = customerRowsForCategory.some((r) => r.unit === 'pax')
    const hasBagsTier = customerRowsForCategory.some((r) => r.unit === 'bags')
    const maxPax = Math.max(
      0,
      ...customerRowsForCategory.filter((r) => r.unit === 'pax').map((r) => r.maxUnits),
    )
    const minBagsTier = Math.min(
      Infinity,
      ...customerRowsForCategory
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

  // Time-of-day surcharge. We pick the HIGHEST surcharge that any of
  // the booking's time windows hits — pickup window OR delivery window
  // — so a trip with a daytime pickup but an early-morning delivery
  // still fires the night rate. Surcharge rates and time brackets are
  // configured in Airtable's Surcharges table (see fetchSurcharges
  // above); we filter to ones matching this customer (or "All").
  const allSurcharges = await fetchSurcharges()
  const applicable = allSurcharges.filter(
    (s) => s.customer === 'All' || s.customer === input.customer,
  )
  const surchargeCandidates = [
    parseStartHour(input.timeWindow),
    parseStartHour(input.deliveryTimeWindow ?? null),
  ]
    .filter((h): h is number => h != null)
    .map((h) => applicable.find((s) => s.matches(h)) ?? null)
    .filter((s): s is Surcharge => s != null)
  let total = subtotal
  if (surchargeCandidates.length > 0) {
    // Pick the surcharge with the highest pct. Night > Evening > none.
    const sur = surchargeCandidates.reduce((a, b) => (b.pct > a.pct ? b : a))
    const surAmount = Math.round(subtotal * sur.pct)
    lineItems.push({
      label: `${sur.label} (+${Math.round(sur.pct * 100)}%)`,
      amountIsk: surAmount,
    })
    total += surAmount
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
