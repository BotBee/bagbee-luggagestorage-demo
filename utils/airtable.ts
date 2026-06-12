import Airtable, { FieldSet, Records, Record as AirtableRecord, Table } from 'airtable'
import getAppConfig from '../modules/config'

const {
  serverRuntimeConfig: {
    airtableAccessToken,
    airtableTableId,
    airtableBaseId,
    airtableEndpointUrl,
    airtableFastTrackTableId,
  },
} = getAppConfig()

// Returns a record array
const minifyItems = (records: Records<FieldSet>) => records.map((record) => getMinifiedItem(record))

// Returns fields and id separately
const getMinifiedItem = (record: AirtableRecord<FieldSet>) => {
  if (!record.fields.brought) {
    record.fields.brought = false
  }
  return {
    id: record.id,
    fields: record.fields,
  }
}

Airtable.configure({
  apiKey: airtableAccessToken,
  endpointUrl: airtableEndpointUrl,
})

const getBase = (): Airtable.Base => {
  return Airtable.base(airtableBaseId)
}

const getTable = (): Table<FieldSet> => {
  const base = getBase()

  return base(airtableTableId)
}

const getFastTrackTable = (): Table<FieldSet> => {
  const base = getBase()

  return base(airtableFastTrackTableId)
}

/**
 * Get the default timeslot max
 * @returns The default timeslot max
 */
const getPickupConfig = async () => {
  const base = getBase()

  const records = await base('Config').select({}).all()

  const timeslotMax = records.find((record) => record.fields.Name === 'Timeslot Max')

  try {
    const value = timeslotMax?.fields.Value
    if (typeof value === 'number') return value
    if (typeof value === 'string') return parseInt(value, 10)
    return 2
  } catch (error) {
    return 2
  }
}

/**
 * Get the pickup config matrix
 * The matrix is used to override the default timeslot max for specific dates and timeslots
 * @param defaultTimeslotMax The default timeslot max
 * @returns The pickup config matrix
 */
const getPickupConfigMatrix = async (defaultTimeslotMax: number) => {
  const base = getBase()

  const records = await base('Matrix Pickup')
    .select({
      fields: ['Date', 'Timeslot', 'Difference Value'],
    })
    .all()

  const timeslotMaxOverrides = records.reduce((acc, curr) => {
    if (typeof curr.fields.Timeslot !== 'string' || typeof curr.fields.Date !== 'string') return acc

    const key = `${curr.fields.Date}/${curr.fields.Timeslot}`
    const differenceValue = curr.fields['Difference Value']
    if (typeof differenceValue !== 'number') return acc
    acc[key] = defaultTimeslotMax + differenceValue
    return acc
  }, {} as Record<string, number>)

  return timeslotMaxOverrides
}

/**
 * Postal-code cutoffs for evening pickup slots.
 *
 * Source of truth: Airtable table `Postal Code Cutoffs` in the same base.
 * Schema: Postal code (primary), Region, Service (checkbox),
 * Earliest pickup slot (singleSelect), Latest pickup slot (singleSelect:
 * '17:00 - 18:00' | '18:00 - 19:00' | '19:00 - 20:00' | '20:00 - 21:00' |
 * '21:00 - 22:00' | 'Any'), Notes.
 *
 * The driver runs an evening route BSÍ → 170 → 102 → 105 → 200 → 210 → 220 →
 * 230 → KEF; some postcodes can't be reached early (driver hasn't arrived
 * yet) and some can't be reached late (driver has already passed). Ops edit
 * the table to change cutoffs without redeploys.
 *
 * Cache: in-memory, module-scoped, 5-minute TTL. Each Next.js serverless
 * cold-start re-fetches; this is fine for ops workflow (changes are visible
 * within 5 minutes of being saved).
 */
export type PostalCodeRule = {
  postalCode: string
  service: boolean
  // EVENING route (17:00-22:00 hourly slots + the 19:00-22:00 any-time slot).
  // Start hour of the earliest allowed evening slot, e.g. '19:00 - 20:00' → 19.
  // The driver can't reach this postcode before this hour — slots starting
  // earlier are filtered out. null means no earliest restriction.
  earliestSlotStartHour: number | null
  // Start hour of the latest allowed evening slot, e.g. '20:00 - 21:00' → 20.
  // null means no time-based restriction (Service is on, all evening slots
  // allowed by this rule — capacity check still applies separately).
  latestSlotStartHour: number | null
  // MORNING route (08:00-12:00 hourly slots + the 09:00-12:00 any-time slot).
  // Same semantics as the evening pair above, but for the morning route.
  // Airtable columns: 'Earliest morning pickup slot' / 'Latest morning
  // pickup slot' — singleSelect with values like '08:00 - 09:00'. If the
  // columns are absent or empty, morning slots are gated only by the
  // Service flag (no time-based restriction), matching the pre-rule
  // behaviour.
  earliestMorningSlotStartHour: number | null
  latestMorningSlotStartHour: number | null
}

const POSTAL_CODE_CUTOFFS_TTL_MS = 5 * 60 * 1000
let cachedPostalCodeRules: { rules: Record<string, PostalCodeRule>; fetchedAt: number } | null = null

const parseSlotStartHour = (slotLabel: string | undefined | null): number | null => {
  if (!slotLabel || slotLabel === 'Any') return null
  // Slot labels look like '20:00 - 21:00' / '19:00 - 22:00'. Extract the
  // first hour (the start). Anything that doesn't match returns null so a
  // misconfigured row in Airtable degrades to "no restriction" instead of
  // silently blocking everything.
  const match = /^(\d{1,2}):/.exec(slotLabel.trim())
  if (!match) return null
  const hour = parseInt(match[1], 10)
  return Number.isFinite(hour) ? hour : null
}

const getPostalCodeCutoffs = async (): Promise<Record<string, PostalCodeRule>> => {
  const now = Date.now()
  if (cachedPostalCodeRules && now - cachedPostalCodeRules.fetchedAt < POSTAL_CODE_CUTOFFS_TTL_MS) {
    return cachedPostalCodeRules.rules
  }

  try {
    const base = getBase()
    // We don't enumerate fields anymore — Airtable returns whatever's on
    // the row, and we read the morning columns optionally. Lets ops add
    // 'Earliest morning pickup slot' / 'Latest morning pickup slot' on
    // their own schedule without requiring a code change to start
    // honoring them.
    const records = await base('Postal Code Cutoffs').select().all()

    const rules: Record<string, PostalCodeRule> = {}
    for (const record of records) {
      const postalCode = record.fields['Postal code']
      if (typeof postalCode !== 'string' || postalCode.trim() === '') continue
      const rawLatest = record.fields['Latest pickup slot']
      const latestSlot = typeof rawLatest === 'string' ? rawLatest : null
      const rawEarliest = record.fields['Earliest pickup slot']
      const earliestSlot = typeof rawEarliest === 'string' ? rawEarliest : null
      const rawMorningLatest = record.fields['Latest morning pickup slot']
      const morningLatestSlot =
        typeof rawMorningLatest === 'string' ? rawMorningLatest : null
      const rawMorningEarliest = record.fields['Earliest morning pickup slot']
      const morningEarliestSlot =
        typeof rawMorningEarliest === 'string' ? rawMorningEarliest : null
      rules[postalCode.trim()] = {
        postalCode: postalCode.trim(),
        // Airtable checkboxes return true/undefined; treat anything other
        // than the explicit `false` value as serviced. The doc default is
        // checkbox = ON, so unrolled rows imply serviced.
        service: record.fields['Service'] !== false,
        earliestSlotStartHour: parseSlotStartHour(earliestSlot),
        latestSlotStartHour: parseSlotStartHour(latestSlot),
        earliestMorningSlotStartHour: parseSlotStartHour(morningEarliestSlot),
        latestMorningSlotStartHour: parseSlotStartHour(morningLatestSlot),
      }
    }

    cachedPostalCodeRules = { rules, fetchedAt: now }
    return rules
  } catch (error) {
    // If Airtable is unreachable or the table was renamed, fall back to "no
    // rules" — every postal code is treated as fully serviced. Capacity-only
    // check still applies, server validates on submit.
    console.error('[getPostalCodeCutoffs] failed to load, falling back to no rules', error)
    return {}
  }
}

/**
 * Get pickup times for paid orders only (capacity excludes unpaid bookings).
 * Also returns the pickup address fields so the availability endpoint can
 * exclude cruise-harbour pickups from the per-slot capacity count (they're all
 * collected at one spot, so they don't consume regular route capacity).
 */
const getPickupTimes = async () => {
  const base = getBase()
  const records = await base
    .table('Nýtt/óflokkað')
    .select({
      view: 'Timeslot Timeline',
      fields: ['Dagsetning pick-up', 'Tímasetning', 'Heimilisfang', 'Short Address'],
      filterByFormula: `AND(NOT({Tímasetning} = BLANK()), {Greiðslustaða} = 'Greitt')`,
    })
    .all()

  return minifyItems(records)
}

// Hardcoded table IDs for the order tracking feature.
// These are the production table IDs in the same Airtable base.
const ORDERS_LOOKUP_TABLE_ID = 'tblWLlNxZvtkFSFXs' // Nýtt/óflokkað
const TAG_NUMBERS_TABLE_ID = 'tblVyZakUmK0CY0YJ' // Tag numbers
const OPTIMO_STOPS_TABLE_ID = 'tblE3fYDSuk7dKPdF' // Optimo stops

/**
 * Always reads from the production Nýtt/óflokkað table.
 * Used by the public order tracking page.
 */
const getOrdersLookupTable = (): Table<FieldSet> => {
  Airtable.configure({
    apiKey: airtableAccessToken,
    endpointUrl: airtableEndpointUrl,
  })
  const base = Airtable.base(airtableBaseId)
  return base(ORDERS_LOOKUP_TABLE_ID)
}

/**
 * Tag numbers table — stores bag photos linked to orders.
 */
const getTagNumbersTable = (): Table<FieldSet> => {
  Airtable.configure({
    apiKey: airtableAccessToken,
    endpointUrl: airtableEndpointUrl,
  })
  const base = Airtable.base(airtableBaseId)
  return base(TAG_NUMBERS_TABLE_ID)
}

/**
 * Optimo stops table — stores scheduled pickup/delivery times from OptimoRoute.
 */
const getOptimoStopsTable = (): Table<FieldSet> => {
  Airtable.configure({
    apiKey: airtableAccessToken,
    endpointUrl: airtableEndpointUrl,
  })
  const base = Airtable.base(airtableBaseId)
  return base(OPTIMO_STOPS_TABLE_ID)
}

/**
 * Leiguflug (charter flight) table — stores per-passenger names for orders
 * whose flight number matches the charter pattern (FI1\d{3}, e.g. FI1080).
 * BagBee needs every passenger's full name to perform check-in via Amadeus
 * for the whole party. Customers used to fill this in via an external Fillout
 * form linked from an email; we now collect it inline on /orders/{code}.
 */
const getLeiguflugTable = (): Table<FieldSet> => {
  Airtable.configure({
    apiKey: airtableAccessToken,
    endpointUrl: airtableEndpointUrl,
  })
  const base = Airtable.base(airtableBaseId)
  return base('Leiguflug')
}

export {
  getTable,
  getPickupConfig,
  getPickupConfigMatrix,
  minifyItems,
  getMinifiedItem,
  getBase,
  getPickupTimes,
  getPostalCodeCutoffs,
  parseSlotStartHour,
  getFastTrackTable,
  getOrdersLookupTable,
  getTagNumbersTable,
  getOptimoStopsTable,
  getLeiguflugTable,
}
