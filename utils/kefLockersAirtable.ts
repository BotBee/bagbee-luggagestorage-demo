/**
 * Airtable client for the KEF Operation base.
 *
 * Distinct from utils/airtable.ts which points at the Útkeyrslan base
 * (`appHB2bNYPAhfUcLv`). KEF lockers live in their own base
 * (`applEhUp3t8XHzp6r`) with a different schema.
 *
 * Reuses AIRTABLE_ACCESS_TOKEN — the PAT must include both bases under its
 * "Bases" scope in the Airtable dashboard. See ../../memory/kef_lockers_project.md
 * for field IDs.
 */
import Airtable, { FieldSet, Record as AirtableRecord, Records } from 'airtable'

// Base + table IDs
export const KEF_BASE_ID = 'applEhUp3t8XHzp6r'
export const KEF_BOOKINGS_TABLE = 'tbljIbSFLwBEbXfxh' // "KEF Lockers 2025"
export const KEF_LOCKERS_TABLE = 'tblaE6Exar0NKckO8' // "Lockers"
export const KEF_ACCESS_EVENTS_TABLE = 'tblMT3VVBbUzU4Rc2' // "Access Events"

// Field IDs we read/write from the integration. Keep this in sync with
// memory/kef_lockers_project.md if the schema changes.
export const FLD = {
  // KEF Lockers 2025 (bookings)
  bookings: {
    customerName: 'fldnUO0MmrxEDmeQP',
    checkInDatetime: 'fldmzZr5FeR4JoElC',
    checkOutDatetime: 'fldF20FNj2CSga4ZF',
    lockerIn: 'fld1oD4Cr34vXnyTL', // multipleRecordLinks → Lockers (drop-off locker)
    lockerOut: 'fldwnRH6pXoI5nEXR', // multipleRecordLinks → Lockers (pickup locker)
    pinIn: 'fldJSen4HBHkLA25K',
    pinOut: 'fldfwNR64s49BgBbG',
    keyboardPwdIdIn: 'fldnLAtjLbYo5AO8m', // labelled "RemoteLock guest ID (in)" — repurposed
    keyboardPwdIdOut: 'fldSb2UrvzQhaj87Y',
    dropoffOpenedAt: 'fld7cOlXQSW6faxlk',
    pickupOpenedAt: 'fldjuNKL5IWMXvg4Y',
    syncStatus: 'fldcgeQXZaotda5gf',
    lastError: 'fld0DJRGK7uKXx4ea',
    cancelled: 'fldq31HpnHY20JDQR',
    bookingNumber: 'fldjig0dsGLR5Lu4a',
  },
  // Lockers
  lockers: {
    name: 'fldbHLPBsqJ2rEuOx',
    lockerCode: 'fldPV1mM8smChmr8I',
    ttlockLockId: 'fldljMTRjggIqe4fy',
    ttlockGatewayId: 'fld8VGxYfNlX4YvLD',
    lastHeartbeat: 'fldEmH17KQNkdRkH7',
    batteryPct: 'fldnZRtIlW0Fxy9q0',
  },
  // Access Events
  events: {
    event: 'fld5TZ4Gb8uIshnbF',
    occurredAt: 'fldQvFn0z0ccybkEq',
    eventType: 'fldFP3EUy6OWvjYKz',
    locker: 'fldRty592jv71JshZ',
    booking: 'fldMTaY8KQBF4cVRq',
    remoteLockEventId: 'fldelXVUSexIk7jfB',
    deviceId: 'fldmplftaow77MECr',
    codeUsed: 'fldhZIhffVf7cGS0L',
    rawPayload: 'fld0JVJZWvLZOJ1O9',
    created: 'fldnoqftKlo3TCenB',
  },
} as const

let configured = false

function getBase(): Airtable.Base {
  if (!configured) {
    const token = process.env.AIRTABLE_ACCESS_TOKEN
    if (!token) throw new Error('AIRTABLE_ACCESS_TOKEN missing')
    Airtable.configure({
      apiKey: token,
      endpointUrl: process.env.AIRTABLE_ENDPOINT_URL || 'https://api.airtable.com',
    })
    configured = true
  }
  return Airtable.base(KEF_BASE_ID)
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export interface BookingFields extends FieldSet {
  [FLD.bookings.customerName]?: string
  [FLD.bookings.checkInDatetime]?: string
  [FLD.bookings.checkOutDatetime]?: string
  [FLD.bookings.lockerIn]?: string[]
  [FLD.bookings.lockerOut]?: string[]
  [FLD.bookings.pinIn]?: string
  [FLD.bookings.pinOut]?: string
  [FLD.bookings.keyboardPwdIdIn]?: string
  [FLD.bookings.keyboardPwdIdOut]?: string
  [FLD.bookings.dropoffOpenedAt]?: string
  [FLD.bookings.pickupOpenedAt]?: string
  [FLD.bookings.syncStatus]?: string | { name: string }
  [FLD.bookings.cancelled]?: boolean
  [FLD.bookings.bookingNumber]?: string
}

export type BookingRecord = AirtableRecord<BookingFields>

/**
 * Load bookings the sync route needs to consider — anything not yet
 * Completed/Revoked with either a check-in or check-out in the recent past
 * or near future. We're intentionally generous on the window so that
 * cancellations/late changes get picked up.
 */
export async function loadActiveBookings(): Promise<BookingRecord[]> {
  const base = getBase()
  const records: BookingRecord[] = []
  await base<BookingFields>(KEF_BOOKINGS_TABLE)
    .select({
      // We can't easily filter on fldIds in formulas via the airtable lib,
      // so just pull everything not-completed and filter client-side. With
      // ~hundreds of records this is fine.
      filterByFormula: `AND(
        NOT({RemoteLock sync status} = 'Completed'),
        NOT({RemoteLock sync status} = 'Revoked')
      )`,
      pageSize: 100,
    })
    .eachPage((page, fetchNextPage) => {
      records.push(...page)
      fetchNextPage()
    })
  return records
}

export async function updateBooking(
  recordId: string,
  fields: Partial<BookingFields>
): Promise<void> {
  const base = getBase()
  await base(KEF_BOOKINGS_TABLE).update([{ id: recordId, fields: fields as FieldSet }])
}

// ---------------------------------------------------------------------------
// Lockers
// ---------------------------------------------------------------------------

export interface LockerFields extends FieldSet {
  [FLD.lockers.name]?: string
  [FLD.lockers.lockerCode]?: string
  [FLD.lockers.ttlockLockId]?: string
  [FLD.lockers.ttlockGatewayId]?: string
  [FLD.lockers.lastHeartbeat]?: string
  [FLD.lockers.batteryPct]?: number
}

export type LockerRecord = AirtableRecord<LockerFields>

export async function loadLockers(): Promise<LockerRecord[]> {
  const base = getBase()
  const records: LockerRecord[] = []
  await base<LockerFields>(KEF_LOCKERS_TABLE)
    .select({ pageSize: 100 })
    .eachPage((page, fetchNextPage) => {
      records.push(...page)
      fetchNextPage()
    })
  return records
}

// ---------------------------------------------------------------------------
// Access Events
// ---------------------------------------------------------------------------

export interface AccessEventInput {
  eventLabel: string
  occurredAt: string // ISO datetime
  eventType: string // singleSelect choice name
  lockerRecordId?: string
  bookingRecordId?: string
  remoteLockEventId?: string
  deviceId?: string
  codeUsed?: string
  rawPayload?: string
}

export async function appendAccessEvent(input: AccessEventInput): Promise<void> {
  const base = getBase()
  const fields: Record<string, any> = {
    [FLD.events.event]: input.eventLabel,
    [FLD.events.occurredAt]: input.occurredAt,
    [FLD.events.eventType]: input.eventType,
    [FLD.events.created]: new Date().toISOString(),
  }
  if (input.lockerRecordId) fields[FLD.events.locker] = [input.lockerRecordId]
  if (input.bookingRecordId) fields[FLD.events.booking] = [input.bookingRecordId]
  if (input.remoteLockEventId) fields[FLD.events.remoteLockEventId] = input.remoteLockEventId
  if (input.deviceId) fields[FLD.events.deviceId] = input.deviceId
  if (input.codeUsed) fields[FLD.events.codeUsed] = input.codeUsed
  if (input.rawPayload) fields[FLD.events.rawPayload] = input.rawPayload
  await base(KEF_ACCESS_EVENTS_TABLE).create([{ fields }])
}
