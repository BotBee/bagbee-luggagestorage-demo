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
// BagBee Transport locker-mode shift rules + alarm log (added 2026-05-15).
// Read by /api/transport/kef-availability for per-shift capacity counting and
// by /api/cron/kef-locker-monitor for the "locker not emptied" alarm.
export const KEF_LOCKER_RULES_TABLE = 'tblarRtGKibZZGmc0'
export const KEF_LOCKER_ALARMS_TABLE = 'tbltaq6v4bxPoCRZ9'

// Field IDs we read/write from the integration. Keep this in sync with
// memory/kef_lockers_project.md if the schema changes.
export const FLD = {
  // KEF Lockers 2025 (bookings)
  bookings: {
    customerName: 'fldnUO0MmrxEDmeQP',
    checkInDatetime: 'fldmzZr5FeR4JoElC',
    checkOutDatetime: 'fldF20FNj2CSga4ZF',
    // `Locker (in/out) direct` — multipleRecordLinks → Lockers. Read by the
    // PIN-push integration to find the TTLock lockId. The original
    // `Locker-In` / `Locker-Out` fields (still on the table) link to the
    // Availability table for capacity bookkeeping — different concern, not
    // used by sync.ts.
    lockerIn: 'fldpvLELel4CaIP9d',
    lockerOut: 'fldXi8b7kfgYZ8cWT',
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
  // KEF Locker Operations Rules — drives per-shift capacity + alarm timing.
  rules: {
    shiftName: 'fldpbwFNpYbU7TE9n',
    pickupTime: 'fldw8ylAWOBgUsiUM',
    lockersPerShift: 'fld5F1Sdpkk3ZPivV',
    alarmOffsetMinutes: 'fldjHeOQlSUQrXfY4',
    alarmEmail: 'fldJ3u4JP2LhXJ2cK',
    active: 'fld2SfowBrTTznjc4',
    notes: 'fldEH9PzzgipiguKT',
  },
  // Locker Alarms — append-only log; Zap reads new rows and emails.
  alarms: {
    summary: 'fldzkGEOav6FlqJy3',
    firedAt: 'fldAK1NMxPkOs0DEN',
    shiftDate: 'fld9G5OrPbYth0jZs',
    shiftName: 'fld2ILnh9MiPG8tuU',
    bookingsExpected: 'fldF6DAiAz1hcGXQq',
    unlocksObserved: 'fldOO68Z16CxFC3Pn',
    alarmEmail: 'fldGZrZ0EZjAowWHQ',
    detail: 'fldRALnfDUsRorQ68',
    resolved: 'fldaxvsVhqdn93ECV',
    created: 'fldm3pLfrzRZDTpH6',
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
  [FLD.bookings.syncStatus]?: string
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
      // Only bookings using the new datetime schema. Legacy bookings (with
      // empty Check-in datetime) are never touched by the integration —
      // they belong to the pre-integration era and stay as-is.
      filterByFormula: `AND(
        NOT({Check-in datetime} = ''),
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

// ---------------------------------------------------------------------------
// KEF Locker Operations Rules — driver-arrival shifts that govern locker
// capacity for BagBee Transport's KEF pickup flow. Read on every availability
// request and on every cron tick; cached in-process for `RULES_TTL_MS` to
// avoid hammering Airtable.
// ---------------------------------------------------------------------------

export interface LockerShiftRule {
  recordId: string
  shiftName: string // 'Noon' | 'Evening' (per the seeded rows)
  pickupTimeHHmm: string // 'HH:MM' 24h Atlantic/Reykjavik
  lockersPerShift: number
  alarmOffsetMinutes: number
  alarmEmail: string
  notes: string
}

const RULES_TTL_MS = 60 * 1000 // 1 min — enough to avoid stampedes, short
// enough that an operator change shows up in the next form keystroke.
let rulesCache: { at: number; rules: LockerShiftRule[] } | null = null

export async function loadLockerShiftRules(): Promise<LockerShiftRule[]> {
  const now = Date.now()
  if (rulesCache && now - rulesCache.at < RULES_TTL_MS) {
    return rulesCache.rules
  }
  const base = getBase()
  // filterByFormula needs field NAMES (not IDs). Keeping the IDs in `FLD`
  // for the write path and read path that goes through `record.get(...)`.
  const rows = await base(KEF_LOCKER_RULES_TABLE)
    .select({
      filterByFormula: `{Active} = TRUE()`,
      maxRecords: 20,
    })
    .firstPage()
  const rules: LockerShiftRule[] = rows.map((r) => ({
    recordId: r.id,
    shiftName: String(r.get(FLD.rules.shiftName) ?? ''),
    pickupTimeHHmm: String(r.get(FLD.rules.pickupTime) ?? ''),
    lockersPerShift: Number(r.get(FLD.rules.lockersPerShift) ?? 0),
    alarmOffsetMinutes: Number(r.get(FLD.rules.alarmOffsetMinutes) ?? 30),
    alarmEmail: String(r.get(FLD.rules.alarmEmail) ?? ''),
    notes: String(r.get(FLD.rules.notes) ?? ''),
  }))
  rulesCache = { at: now, rules }
  return rules
}

// ---------------------------------------------------------------------------
// Locker Alarms — append-only audit log. The Zap (or Make scenario) the
// operator wires up watches this table for new rows where Resolved is false
// and emails Alarm email. The cron writes once per (Shift date, Shift name)
// to avoid duplicate pages.
// ---------------------------------------------------------------------------

export interface LockerAlarmInput {
  summary: string
  firedAt: string // ISO datetime
  shiftDate: string // YYYY-MM-DD
  shiftName: 'Noon' | 'Evening'
  bookingsExpected: number
  unlocksObserved: number
  alarmEmail: string
  detail: string
}

export async function findExistingAlarm(
  shiftDate: string,
  shiftName: 'Noon' | 'Evening',
): Promise<boolean> {
  const base = getBase()
  const rows = await base(KEF_LOCKER_ALARMS_TABLE)
    .select({
      filterByFormula: `AND({Shift date} = "${shiftDate}", {Shift name} = "${shiftName}")`,
      maxRecords: 1,
    })
    .firstPage()
  return rows.length > 0
}

export async function appendLockerAlarm(input: LockerAlarmInput): Promise<void> {
  const base = getBase()
  const fields: Record<string, any> = {
    [FLD.alarms.summary]: input.summary,
    [FLD.alarms.firedAt]: input.firedAt,
    [FLD.alarms.shiftDate]: input.shiftDate,
    [FLD.alarms.shiftName]: input.shiftName,
    [FLD.alarms.bookingsExpected]: input.bookingsExpected,
    [FLD.alarms.unlocksObserved]: input.unlocksObserved,
    [FLD.alarms.alarmEmail]: input.alarmEmail,
    [FLD.alarms.detail]: input.detail,
    [FLD.alarms.created]: new Date().toISOString(),
  }
  await base(KEF_LOCKER_ALARMS_TABLE).create([{ fields }])
}

// ---------------------------------------------------------------------------
// Access Events — read door_unlocked events in a time window. Used by the
// cron to verify each completed shift's lockers were emptied.
// ---------------------------------------------------------------------------

export async function countDoorUnlocksInWindow(
  startIso: string,
  endIso: string,
): Promise<number> {
  const base = getBase()
  const rows = await base(KEF_ACCESS_EVENTS_TABLE)
    .select({
      filterByFormula:
        `AND({Event type} = "door_unlocked", IS_AFTER({Occurred at}, "${startIso}"), IS_BEFORE({Occurred at}, "${endIso}"))`,
      maxRecords: 50,
    })
    .firstPage()
  return rows.length
}
