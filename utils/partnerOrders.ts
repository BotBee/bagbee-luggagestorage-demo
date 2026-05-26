import { FieldSet, Record as AirtableRecord, Records } from 'airtable'
import { getBase, getOrdersLookupTable } from './airtable'
import { PARTNERS, PartnerId } from './partnerAuth'

// Drivers / staff (Starfsmenn) — record-id → {name, phone} lookup with a
// 5-minute cache. Iceland Travel project managers want to call the assigned
// driver to coordinate the meet-up; the order record exposes the driver as
// a multipleLookupValues field that returns the Starfsmenn record ID, so we
// resolve both name AND phone from the staff table here.
const STAFF_TABLE_ID = 'tbllRYtP3sQGD8CIz'
const STAFF_NAME_FIELD = 'Name'
const STAFF_PHONE_FIELD = 'Phone'
const STAFF_CACHE_TTL_MS = 5 * 60 * 1000

type StaffInfo = { name: string; phone: string | null }
let cachedStaff: {
  byId: Map<string, StaffInfo>
  byName: Map<string, StaffInfo>
  fetchedAt: number
} | null = null

const normalizeName = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')

const loadStaff = async (): Promise<{
  byId: Map<string, StaffInfo>
  byName: Map<string, StaffInfo>
}> => {
  if (cachedStaff && Date.now() - cachedStaff.fetchedAt < STAFF_CACHE_TTL_MS) {
    return { byId: cachedStaff.byId, byName: cachedStaff.byName }
  }
  const byId = new Map<string, StaffInfo>()
  const byName = new Map<string, StaffInfo>()
  try {
    const base = getBase()
    const records = await base(STAFF_TABLE_ID).select({ pageSize: 100 }).all()
    for (const r of records) {
      const rawName = r.fields[STAFF_NAME_FIELD]
      const rawPhone = r.fields[STAFF_PHONE_FIELD]
      const name = typeof rawName === 'string' ? rawName.trim() : ''
      const phone = typeof rawPhone === 'string' && rawPhone.trim() ? rawPhone.trim() : null
      if (!name) continue
      const info: StaffInfo = { name, phone }
      byId.set(r.id, info)
      byName.set(normalizeName(name), info)
    }
  } catch (err) {
    // Non-fatal: if Starfsmenn is unreachable, we just don't enrich.
    console.error('[loadStaff] failed, continuing without phones', err)
  }
  cachedStaff = { byId, byName, fetchedAt: Date.now() }
  return { byId, byName }
}

const RECORD_ID_RE = /^rec[A-Za-z0-9]{14}$/

// Driver field comes back as an array of either Starfsmenn record IDs
// (multipleLookupValues with a primary-field lookup → string IDs) or
// `{id, name}` objects. We resolve whichever shape we got to a real name+phone.
type ResolvedDriver = { recordId: string | null; name: string; phone: string | null }

const resolveDriver = (
  raw: unknown,
  staff: { byId: Map<string, StaffInfo>; byName: Map<string, StaffInfo> }
): ResolvedDriver | null => {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const first = raw[0]
  if (typeof first === 'string') {
    if (RECORD_ID_RE.test(first)) {
      const info = staff.byId.get(first)
      // Record-ID-only — only useful if we can resolve it. If not in the
      // staff cache, return null so the UI shows "Awaiting" rather than
      // an unhelpful raw ID like "reckSlV8TCqkU19oG".
      return info ? { recordId: first, name: info.name, phone: info.phone } : null
    }
    const byName = staff.byName.get(normalizeName(first))
    return byName
      ? { recordId: null, name: byName.name, phone: byName.phone }
      : { recordId: null, name: first.trim(), phone: null }
  }
  if (first && typeof first === 'object' && 'name' in first) {
    const obj = first as { id?: unknown; name?: unknown }
    const name = typeof obj.name === 'string' ? obj.name.trim() : ''
    const id = typeof obj.id === 'string' ? obj.id : ''
    if (id && staff.byId.has(id)) {
      const info = staff.byId.get(id)!
      return { recordId: id, name: info.name, phone: info.phone }
    }
    if (name) {
      const byName = staff.byName.get(normalizeName(name))
      return byName
        ? { recordId: null, name: byName.name, phone: byName.phone }
        : { recordId: null, name, phone: null }
    }
  }
  return null
}

const attachDriverInfo = async (
  orders: OrderSummary[],
  rawByOrderId: Map<string, unknown>
): Promise<void> => {
  const staff = await loadStaff()
  for (const o of orders) {
    const raw = rawByOrderId.get(o.id)
    if (raw == null) continue
    const info = resolveDriver(raw, staff)
    if (info) {
      o.driverRecordId = info.recordId
      o.driverName = info.name
      o.driverPhone = info.phone
    }
  }
}

// Field IDs in the production Nýtt/óflokkað table (tblWLlNxZvtkFSFXs).
// Listed by ID (not friendly name) because writes via the JS SDK accept
// either form, and IDs survive renames in Airtable's UI. Friendly-name
// comments reflect Airtable's current display name (some are Icelandic).
export const FIELDS = {
  // Identity
  agency: 'fldAqtOvVsGju0Vhy', // "Reference" (singleLineText) — agency name slot
  tilvisun: 'fldLwB0Z4BaKOjUqi', // "Tilvísun" (singleLineText) — the partner's
  // own booking number (e.g. "187373"). Surfaced as "Reference" in the
  // partner-facing UI but stored separately from the agency-name slot.
  customerName: 'flds4W4WLarQ5MBEg', // "Nafn viðskiptavinar"
  email: 'fldF21dHpp3CiTPum', // "Tölvupóstfang" (writeable)
  emailFormula: 'fldCwXKCDPqwayaXl', // "Pickup e-mail address" (formula, read-only)
  phone: 'fldLNjUKpMHtre188', // "Símanúmer"

  // Display-only formula identifiers
  firstNameFormula: 'fldELJLvtlRHKQtzN',
  lastNameFormula: 'fldn1Hn7niMvUcWL9',
  orderNoInt: 'fldFh4cU2KiZant8Q', // "Order ID" (autoNumber)
  orderNoShort: 'fldo3soPBdIjoOv7H', // "Pöntunarnúmer (fx)" — last-5-char short ID

  // Service & status
  serviceType: 'fld1X7tjNHegjEE6W', // "Requested service" (singleSelect)
  status: 'fldsqQ8zCVZSE80Nu', // "Order Status" (formula singleSelect)
  paymentMethod: 'fldZyj8GhpDdkx1Ee', // "Payment" (singleSelect)
  paymentStatus: 'fldHDsr5Lux10ioPt', // "Greiðslustaða"
  confirmed: 'fldQEgArrB69AHTqy', // "Greitt" (checkbox)

  // Dates & timing
  flightDate: 'fld5Hv7d5CGlqx8e1', // "Dagsetning flugs" (date — writeable)
  flightDateFormula: 'fld470RhTj8GYUiN2', // "Datepicker Fillout" (formula)
  pickupDate: 'fldYDA8Fuk8bU9tZA', // "Dagsetning pick-up" (date)
  timeWindow: 'fldXyzfLIhi4G25p4', // "Tímasetning"
  dayPart: 'fldkdoNmHwjvu6JU9', // "shift (formula)"

  // Locations
  pickupAddressFull: 'fldA2biuvoFnabjur', // "Heimilisfang"
  // Optional manual lat/lng overrides — populated when the partner drags
  // the pickup marker on the dashboard map to fix an inaccurate geocode.
  // Empty == use whatever Google's geocoder returns for the address.
  pickupLatOverride: 'fldqms85fagdrer2t',
  pickupLngOverride: 'fld2NQ3JgAAFU6T73',
  // Same idea for the delivery pin. Populated when the partner drags the
  // delivery marker on the dashboard map; empty == use whatever Google
  // returns for the delivery address.
  deliveryLatOverride: 'fldgzIFTpA12SNjJS',
  deliveryLngOverride: 'fldnTZhmbKjjJqIcv',
  pickupAddressFormula: 'fldlvO53oCJR4Etpg', // "Götuheiti (fx)"
  hotelNameFormula: 'fldTcb9WXSlJKWOdX', // "Address Formula"
  shortAddress: 'fldugdYI5G0TwNpI9', // "Short Address" (also doubles as delivery destination label)
  destinationAirport: 'fldpvSCayvHWY98Si', // "Áfangastaður"

  // Flight
  airline: 'fld93PMVnt0dEdnuP', // "Delivery Airline"
  flightNumberFull: 'fldB6b5AsdnjIbIyr', // "Delivery Flight Number"
  destinationCodeFormula: 'fldcrb3uXJB8i4c3y', // "Airport code" (formula)
  airlineCodeFormula: 'fldSgfTb8DoV8zREV', // "Airline code" (formula)
  flightNumberOnlyFormula: 'flduTRkQmmKFQqvwz', // "Airline flight number" (formula)

  // Bags & amount — writeable inputs are *NOT* the totals (those are formulas)
  bagsRegular: 'fld8lJcgl5CTa0TCF', // "Töskufjöldi_no" (writeable)
  bagsOdd: 'fldFDH3m0DHmGQxjm', // "Töskufjöldi_no_yfirstærð" (writeable)
  bagsRegularTotal: 'fldbtsyijmAzkbPAM', // formula: "Töskufjöldi_no delivery"
  bagsOddTotal: 'fldqryDFmuPoFcHnw', // formula: "Total amount of bags"
  amount: 'fldAbFH9Yn01L9LVK', // "Upphæð"
  currency: 'flduYM8nuUtB6BrD1', // "Gengi"

  // Delivery (for Pickup & Delivery service type)
  deliveryAddress: 'fldSXm2qLZgpDtDgO', // "Delivery Address"
  deliveryDate: 'fldA12bUv96dZEAqV', // "Delivery date"
  deliveryTimeWindow: 'fldXEUbBKM6lRm6Tf', // "Delivery Time-window"

  // Dispatch / driver / tracking
  driver: 'fldVkewYMPODC3uIG', // "Bílstjóri" (multipleLookupValues from Vaktaskipulag)
  shiftInfoLink: 'fldCoRXUrWNxG1L7J', // "Shift info link" (multipleRecordLinks)
  shiftInfo: 'fldXJFv2a6XDs7meO', // "Shift info" (formula text)
  optimoTrackingLink: 'fldRZRy3kluA8jS00', // "Optimo Tracking Link"
  pickupCompleted: 'fldvJU8JD0E9MX1du', // rollup: "Pickup completed (from Optimo Stops)"
  deliveryCompleted: 'fldpb8lraWVuyep09', // rollup: "Delivery completed (from Optimo Stops)"

  // Notes & automation
  comment: 'fldZVLwEZogFl3169', // "Annað (comment)"
  contactName: 'fldkkf4lZbj8rC38Q', // "Partner contact name" — staffer name
  updateTrigger: 'fldmbC1Y3W3ZNP7Ad', // "Update Order …" — set ['Update OC'] to fire BagBee notification
  language: 'fldyaP9MeOhPd3IvA', // "Málstaðall"
  createdAt: 'fldlXK34JHYYShB5o', // "Tímasetning pöntunar" (createdTime)
} as const

export type FieldId = (typeof FIELDS)[keyof typeof FIELDS]

export type OrderFields = Partial<Record<FieldId, unknown>>

// Friendly Airtable display names — keyed the same as FIELDS. Used for READS
// because the Airtable JS SDK 0.11.6 returns record.fields keyed by display
// name (no `returnFieldsByFieldId` flag on `select`). Writes still go via
// FIELDS (IDs) which the REST API accepts either way.
const F_NAMES = {
  agency: 'Reference',
  tilvisun: 'Tilvísun',
  customerName: 'Nafn viðskiptavinar',
  email: 'Tölvupóstfang',
  emailFormula: 'Pickup e-mail address',
  phone: 'Símanúmer',
  firstNameFormula: 'First Name (fx)',
  lastNameFormula: 'Last name (clean)',
  orderNoInt: 'Order ID',
  orderNoShort: 'Pöntunarnúmer (fx)',
  serviceType: 'Requested service',
  status: 'Order Status',
  paymentMethod: 'Payment',
  paymentStatus: 'Greiðslustaða',
  confirmed: 'Greitt',
  flightDate: 'Dagsetning flugs',
  flightDateFormula: 'Datepicker Fillout',
  pickupDate: 'Dagsetning pick-up',
  timeWindow: 'Tímasetning',
  dayPart: 'shift (formula)',
  pickupAddressFull: 'Heimilisfang',
  pickupLatOverride: 'Pickup latitude override',
  pickupLngOverride: 'Pickup longitude override',
  deliveryLatOverride: 'Delivery latitude override',
  deliveryLngOverride: 'Delivery longitude override',
  pickupAddressFormula: 'Götuheiti (fx)',
  hotelNameFormula: 'Address Formula',
  shortAddress: 'Short Address',
  destinationAirport: 'Áfangastaður',
  airline: 'Delivery Airline',
  flightNumberFull: 'Delivery Flight Number',
  destinationCodeFormula: 'Aiport code', // sic — Airtable column name has a typo
  airlineCodeFormula: 'Airline code',
  flightNumberOnlyFormula: 'Airline flight number',
  bagsRegular: 'Töskufjöldi_no',
  bagsOdd: 'Töskufjöldi_no_yfirstærð',
  bagsRegularTotal: 'Töskufjöldi_no delivery',
  bagsOddTotal: 'Total amount of bags',
  amount: 'Upphæð',
  currency: 'Gengi',
  comment: 'Annað (comment)',
  contactName: 'Partner contact name',
  updateTrigger: 'Update Order (add bags, send order confirmation etc)',
  language: 'Málstaðall',
  createdAt: 'Tímasetning pöntunar',
  // Delivery
  deliveryAddress: 'Delivery Address',
  deliveryDate: 'Delivery date',
  deliveryTimeWindow: 'Delivery Time-window',
  // Dispatch / driver / tracking
  driver: 'Bílstjóri',
  shiftInfoLink: 'Shift info link',
  shiftInfo: 'Shift info',
  optimoTrackingLink: 'Optimo Tracking Link',
  pickupCompleted: 'Pickup completed (from Optimo Stops)',
  deliveryCompleted: 'Delivery completed (from Optimo Stops)',
} as const

export type OrderSummary = {
  id: string
  orderNoShort: string
  orderNoInt: number | null
  agency: string | null
  // Partner-controlled reference number (Iceland Travel's internal booking ID
  // like "JKT-37012"). Lives in the Airtable `Reference` column. The list
  // view + search prioritise this since it's the identifier the partner
  // staff already use day-to-day.
  reference: string | null
  customerName: string | null
  email: string | null
  phone: string | null
  serviceType: string | null
  status: string | null
  statusColor: string | null
  paymentMethod: string | null
  paymentStatus: string | null
  flightDate: string | null
  pickupDate: string | null
  timeWindow: string | null
  dayPart: string | null
  pickupAddress: string | null
  // Manual lat/lng for the pickup pin — set when the partner drags the
  // marker on the map. null means "use the geocoded address".
  pickupLatOverride: number | null
  pickupLngOverride: number | null
  hotelName: string | null
  // Delivery (mainly populated on Pickup & Delivery)
  deliveryAddress: string | null
  deliveryDate: string | null
  deliveryTimeWindow: string | null
  // Same idea as the pickup overrides — set when the partner drags the
  // delivery marker on the dashboard map.
  deliveryLatOverride: number | null
  deliveryLngOverride: number | null
  airline: string | null
  flightNumber: string | null
  destinationCode: string | null
  bagsRegular: number
  bagsOdd: number
  amount: number
  currency: string | null
  comment: string | null
  // Free-text staffer name on the partner side (the project manager who
  // submitted or last edited this booking). Written to the dedicated
  // "Partner contact name" column.
  contactName: string | null
  confirmed: boolean
  createdAt: string | null
  // Dispatch / driver / tracking
  driverRecordId: string | null
  driverName: string | null
  driverPhone: string | null
  shiftInfo: string | null
  optimoTrackingLink: string | null
  pickupCompleted: boolean
  deliveryCompleted: boolean
}

const asString = (v: unknown): string | null => {
  if (typeof v === 'string') return v
  if (v == null) return null
  if (typeof v === 'number') return String(v)
  return null
}

const asNumber = (v: unknown): number => {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

const asSelect = (v: unknown): { name: string; color: string | null } | null => {
  if (typeof v === 'string') return { name: v, color: null }
  if (v && typeof v === 'object' && 'name' in v) {
    const obj = v as { name: unknown; color?: unknown }
    if (typeof obj.name === 'string') {
      return { name: obj.name, color: typeof obj.color === 'string' ? obj.color : null }
    }
  }
  return null
}

// Lookup/multipleRecordLinks fields come back as an array of either strings
// or `{id, name}` objects depending on the field type. Flatten to plain strings.
const asLookupNames = (v: unknown): string[] => {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const item of v) {
    if (typeof item === 'string') {
      if (item.trim()) out.push(item.trim())
    } else if (item && typeof item === 'object' && 'name' in item) {
      const name = (item as { name?: unknown }).name
      if (typeof name === 'string' && name.trim()) out.push(name.trim())
    }
  }
  return out
}

// Airtable colour names → CSS hex. Trimmed to the values we actually see
// on the status/service/payment singleSelects in this table.
const COLOR_MAP: Record<string, string> = {
  redLight1: '#fcb3a4',
  redLight2: '#fdc8b9',
  orangeBright: '#ff6f2c',
  orangeLight2: '#ffd1a3',
  yellowBright: '#fcb400',
  yellowLight1: '#f9d77d',
  yellowLight2: '#fde3a2',
  greenBright: '#20c933',
  greenLight1: '#a6f3a1',
  greenLight2: '#cbf3c2',
  tealLight2: '#a3e7d6',
  cyanLight2: '#b0e4f3',
  blueBright: '#2d7ff9',
  blueLight2: '#cfdfff',
  purpleLight2: '#d4c4f3',
}

export const statusColor = (name: string | null, raw: string | null): string => {
  if (raw && COLOR_MAP[raw]) return COLOR_MAP[raw]
  switch (name) {
    case 'Pending':
      return '#A3A4A7'
    case 'Confirmed':
      return '#F3AD3C'
    case 'Planned':
      return '#3D7165'
    case 'In Progress':
      return '#E37F2F'
    case 'Delivered':
      return '#20c933'
    case 'Cancelled':
      return '#E5573F'
    default:
      return '#6b7280'
  }
}

const mapRecord = (record: AirtableRecord<FieldSet>): OrderSummary => {
  const f = record.fields as Record<string, unknown>
  const get = (name: string) => f[name]
  const status = asSelect(get(F_NAMES.status))
  const service = asSelect(get(F_NAMES.serviceType))
  const paymentMethod = asSelect(get(F_NAMES.paymentMethod))
  const dayPart = asSelect(get(F_NAMES.dayPart))
  return {
    id: record.id,
    orderNoShort: asString(get(F_NAMES.orderNoShort)) || record.id.slice(-5),
    orderNoInt:
      typeof get(F_NAMES.orderNoInt) === 'number'
        ? (get(F_NAMES.orderNoInt) as number)
        : null,
    agency: asString(get(F_NAMES.agency)),
    // Partner-facing "reference" reads from the Tilvísun column (Icelandic
    // for "reference"). This used to live in the Reference column but ops
    // moved the data so the Reference column can keep the agency-name
    // role and Tilvísun holds the per-booking ID.
    reference: asString(get(F_NAMES.tilvisun)),
    customerName: asString(get(F_NAMES.customerName)),
    email: asString(get(F_NAMES.email)) || asString(get(F_NAMES.emailFormula)),
    phone: asString(get(F_NAMES.phone)),
    serviceType: service ? service.name : null,
    status: status ? status.name : null,
    statusColor: statusColor(status?.name ?? null, status?.color ?? null),
    paymentMethod: paymentMethod ? paymentMethod.name : null,
    paymentStatus: asString(get(F_NAMES.paymentStatus)),
    flightDate:
      asString(get(F_NAMES.flightDate)) || asString(get(F_NAMES.flightDateFormula)),
    pickupDate: asString(get(F_NAMES.pickupDate)),
    timeWindow: asString(get(F_NAMES.timeWindow)),
    dayPart: dayPart ? dayPart.name : null,
    pickupAddress:
      asString(get(F_NAMES.pickupAddressFull)) ||
      asString(get(F_NAMES.pickupAddressFormula)),
    pickupLatOverride: (() => {
      const v = get(F_NAMES.pickupLatOverride)
      return typeof v === 'number' && Number.isFinite(v) ? v : null
    })(),
    pickupLngOverride: (() => {
      const v = get(F_NAMES.pickupLngOverride)
      return typeof v === 'number' && Number.isFinite(v) ? v : null
    })(),
    deliveryLatOverride: (() => {
      const v = get(F_NAMES.deliveryLatOverride)
      return typeof v === 'number' && Number.isFinite(v) ? v : null
    })(),
    deliveryLngOverride: (() => {
      const v = get(F_NAMES.deliveryLngOverride)
      return typeof v === 'number' && Number.isFinite(v) ? v : null
    })(),
    hotelName: asString(get(F_NAMES.hotelNameFormula)),
    airline: asString(get(F_NAMES.airline)),
    flightNumber: asString(get(F_NAMES.flightNumberFull)),
    destinationCode: asString(get(F_NAMES.destinationCodeFormula)),
    // Read the writeable bag fields directly. The Airtable JS SDK 0.11.6
    // omits `0`-valued cells from record.fields, so an `== null` check
    // can't distinguish "field missing" from "field is 0" — and the
    // formula totals aren't split by odd-size, so falling back to them
    // double-counts. Treat missing as 0.
    bagsRegular: asNumber(get(F_NAMES.bagsRegular)),
    bagsOdd: asNumber(get(F_NAMES.bagsOdd)),
    amount: asNumber(get(F_NAMES.amount)),
    currency: asString(get(F_NAMES.currency)) || 'ISK',
    comment: asString(get(F_NAMES.comment)),
    contactName: asString(get(F_NAMES.contactName)),
    confirmed: Boolean(get(F_NAMES.confirmed)),
    createdAt: asString(get(F_NAMES.createdAt)),
    // Delivery fields are populated on Pickup & Delivery orders; otherwise
    // the table's "Short Address" / formulas describe the airport drop-off.
    deliveryAddress:
      asString(get(F_NAMES.deliveryAddress)) || asString(get(F_NAMES.shortAddress)),
    deliveryDate: asString(get(F_NAMES.deliveryDate)),
    deliveryTimeWindow: asString(get(F_NAMES.deliveryTimeWindow)),
    // Driver: lookup field from the Shift; resolved later via
    // attachDriverInfo() using the Starfsmenn table (because the
    // lookup-on-linked-record returns record IDs, not names).
    driverRecordId: null,
    driverName: null,
    driverPhone: null,
    shiftInfo: asLookupNames(get(F_NAMES.shiftInfo))[0] ?? asString(get(F_NAMES.shiftInfo)),
    optimoTrackingLink: asString(get(F_NAMES.optimoTrackingLink)),
    // Optimo Stops rollups: presence indicates the stop has been completed.
    // We coerce "any non-empty/zero value" to true.
    pickupCompleted: Boolean(get(F_NAMES.pickupCompleted)),
    deliveryCompleted: Boolean(get(F_NAMES.deliveryCompleted)),
  }
}

const escapeFormula = (s: string): string => s.replace(/'/g, "\\'")

const partnerFilter = (partnerId: PartnerId): string => {
  const agency = PARTNERS[partnerId].agencyName
  // Ops tags partner orders by writing the agency name into the customer
  // name field (Nafn viðskiptavinar = flds4W4WLarQ5MBEg). The Reference
  // field is only set on a handful of newer orders, so filtering on it
  // missed ~99% of Iceland Travel's bookings. We use the field ID rather
  // than the friendly name so non-ASCII chars in the name (ð, æ, …) can't
  // trip up Airtable's URL encoding.
  return `{${FIELDS.customerName}} = '${escapeFormula(agency)}'`
}

export const listPartnerOrders = async (partnerId: PartnerId): Promise<OrderSummary[]> => {
  const table = getOrdersLookupTable()
  const records: Records<FieldSet> = await table
    .select({
      filterByFormula: partnerFilter(partnerId),
      pageSize: 100,
    })
    .all()
  const summaries = records.map(mapRecord)
  const rawDrivers = new Map<string, unknown>()
  for (const r of records) {
    rawDrivers.set(r.id, (r.fields as Record<string, unknown>)[F_NAMES.driver])
  }
  await attachDriverInfo(summaries, rawDrivers)
  return summaries
}

export const getPartnerOrder = async (
  partnerId: PartnerId,
  recordId: string
): Promise<OrderSummary | null> => {
  const table = getOrdersLookupTable()
  let record: AirtableRecord<FieldSet>
  try {
    record = await table.find(recordId)
  } catch (err) {
    return null
  }
  // Scope guard: never let one partner read another's order even if they
  // guess a record ID. We scope on Nafn viðskiptavinar — that's where ops
  // stamp the agency name; the Reference field is unreliable.
  const f = record.fields as Record<string, unknown>
  if (asString(f[F_NAMES.customerName]) !== PARTNERS[partnerId].agencyName) {
    return null
  }
  const summary = mapRecord(record)
  const raw = new Map<string, unknown>([
    [record.id, (record.fields as Record<string, unknown>)[F_NAMES.driver]],
  ])
  await attachDriverInfo([summary], raw)
  return summary
}

// Append a structured changelog line to the order's comment field so the
// edit is human-visible in Airtable. The Update OC trigger separately
// fires the BagBee notification automation.
const buildChangelog = (
  partnerId: PartnerId,
  changes: Record<string, { from: unknown; to: unknown }>,
  actor: string | undefined
): string => {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
  const lines = Object.entries(changes).map(([k, v]) => {
    const from = v.from == null || v.from === '' ? '∅' : String(v.from)
    const to = v.to == null || v.to === '' ? '∅' : String(v.to)
    return `  • ${k}: ${from} → ${to}`
  })
  const who = actor ? `${PARTNERS[partnerId].displayName} (${actor})` : PARTNERS[partnerId].displayName
  return `\n— Partner edit by ${who} @ ${ts}:\n${lines.join('\n')}`
}

export type EditableField =
  | 'reference'
  | 'bagsRegular'
  | 'bagsOdd'
  | 'pickupDate'
  | 'flightDate'
  | 'timeWindow'
  | 'pickupAddress'
  | 'pickupLatOverride'
  | 'pickupLngOverride'
  | 'deliveryLatOverride'
  | 'deliveryLngOverride'
  | 'deliveryAddress'
  | 'deliveryDate'
  | 'deliveryTimeWindow'
  | 'flightNumber'
  | 'airline'
  | 'comment'
  | 'contactName'
  | 'email'
  | 'phone'
  | 'serviceType'

const EDIT_FIELD_MAP: Record<EditableField, FieldId> = {
  reference: FIELDS.tilvisun, // partner's booking ref → Tilvísun column
  bagsRegular: FIELDS.bagsRegular,
  bagsOdd: FIELDS.bagsOdd,
  pickupDate: FIELDS.pickupDate,
  flightDate: FIELDS.flightDate,
  timeWindow: FIELDS.timeWindow,
  pickupAddress: FIELDS.pickupAddressFull,
  pickupLatOverride: FIELDS.pickupLatOverride,
  pickupLngOverride: FIELDS.pickupLngOverride,
  deliveryLatOverride: FIELDS.deliveryLatOverride,
  deliveryLngOverride: FIELDS.deliveryLngOverride,
  deliveryAddress: FIELDS.deliveryAddress,
  deliveryDate: FIELDS.deliveryDate,
  deliveryTimeWindow: FIELDS.deliveryTimeWindow,
  flightNumber: FIELDS.flightNumberFull,
  airline: FIELDS.airline,
  comment: FIELDS.comment,
  contactName: FIELDS.contactName,
  email: FIELDS.email,
  phone: FIELDS.phone,
  serviceType: FIELDS.serviceType,
}

export const updatePartnerOrder = async (
  partnerId: PartnerId,
  recordId: string,
  changes: Partial<Record<EditableField, string | number | null>>,
  actor: string | undefined
): Promise<OrderSummary | null> => {
  const before = await getPartnerOrder(partnerId, recordId)
  if (!before) return null

  const table = getOrdersLookupTable()
  const fields: Record<string, unknown> = {}
  const changelog: Record<string, { from: unknown; to: unknown }> = {}

  const beforeRecord = before as unknown as Record<string, unknown>

  for (const [key, value] of Object.entries(changes)) {
    if (!(key in EDIT_FIELD_MAP)) continue
    const fieldId = EDIT_FIELD_MAP[key as EditableField]
    const prev = beforeRecord[key]
    if (prev === value) continue
    fields[fieldId] = value
    changelog[key] = { from: prev, to: value }
  }

  if (Object.keys(fields).length === 0) {
    return before
  }

  // Append changelog to the comment field so ops can read the edit history
  // straight from the record in Airtable.
  const changelogText = buildChangelog(partnerId, changelog, actor)
  fields[FIELDS.comment] = (before.comment || '') + changelogText

  // Two-step update: clear the trigger so re-saves still fire, then set it.
  // Same pattern used by the public order-tracking edit flow (api/order/update.ts).
  await table.update(recordId, { [FIELDS.updateTrigger]: [] })
  await table.update(recordId, {
    ...fields,
    [FIELDS.updateTrigger]: ['Update OC'],
  })

  return getPartnerOrder(partnerId, recordId)
}

// Cancel an order by setting the Update Order multipleSelects field to
// ['Cancel & Refund']. The Order Status formula reads that value and
// resolves to "Cancelled". Same field/value the dispatcher uses from the
// Airtable UI — keeps the cancellation indistinguishable from ops-side
// cancellations downstream.
//
// We also append a changelog line to the comment so ops can see who
// cancelled and when. Returns the refreshed order summary.
export const cancelPartnerOrder = async (
  partnerId: PartnerId,
  recordId: string,
  actor: string | undefined,
): Promise<OrderSummary | null> => {
  const table = getOrdersLookupTable()
  // Scope guard: never let one partner cancel another's order.
  const before = await getPartnerOrder(partnerId, recordId)
  if (!before) return null

  const ts = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
  const who = actor
    ? `${PARTNERS[partnerId].displayName} (${actor})`
    : PARTNERS[partnerId].displayName
  const cancelNote = `\n— Cancelled by ${who} @ ${ts} via partner portal.`
  const newComment = (before.comment || '') + cancelNote

  // Two-step pattern (same as updatePartnerOrder): clear the trigger
  // first so a downstream automation re-fires even if the field already
  // had a value, then set the cancel flag + the comment in one update.
  await table.update(recordId, { [FIELDS.updateTrigger]: [] })
  await table.update(recordId, {
    [FIELDS.updateTrigger]: ['Cancel & Refund'],
    [FIELDS.comment]: newComment,
  })

  return getPartnerOrder(partnerId, recordId)
}

export type NewOrderInput = {
  customerName: string
  contactName?: string
  // Iceland Travel's own booking ref (e.g. "JKT-37012"). Written to the
  // Airtable Reference column so the dashboard list / search can find it.
  reference?: string
  email: string
  phone: string
  serviceType:
    | 'Check-in service'
    | 'Arrival service'
    | 'Pickup & Delivery'
    | 'Pickup'
    | 'Delivery'
    | 'Pickup from KEF'
    | 'Delivery from storage'
    | 'BSI to Hotel Delivery'
    | 'Task'
  flightDate: string // YYYY-MM-DD
  pickupDate: string
  timeWindow: string
  pickupAddress: string
  deliveryAddress?: string
  // Delivery date defaults to the pickup date when omitted (same-day
  // Pickup & Delivery is the common case). Time window similarly.
  deliveryDate?: string // YYYY-MM-DD
  deliveryTimeWindow?: string
  hotelName?: string
  airline?: string
  flightNumber?: string
  airlineCode?: string
  destinationCode?: string
  bagsRegular: number
  bagsOdd: number
  estimatedAmount?: number
  comment?: string
  language?: 'is' | 'en'
}

export const createPartnerOrder = async (
  partnerId: PartnerId,
  input: NewOrderInput
): Promise<OrderSummary> => {
  const table = getOrdersLookupTable()
  const agency = PARTNERS[partnerId].agencyName

  const headerLine = `Booking submitted via ${agency} partner portal${
    input.contactName ? ` by ${input.contactName}` : ''
  } @ ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC.\n`
  const groupLine =
    input.customerName && input.customerName.trim() !== agency
      ? `Group / passenger reference: ${input.customerName.trim()}\n`
      : ''
  const commentBody = input.comment ? input.comment.trim() : ''
  const fullComment = `${headerLine}${groupLine}${commentBody}`.trim()

  const fields: Record<string, unknown> = {
    // Scope ALL partner-created orders to the agency via the customer-name
    // field — that's what dashboard reads filter on. The tour/passenger
    // name the partner staffer typed lives in the comment instead.
    [FIELDS.customerName]: agency,
    [FIELDS.agency]: agency, // keep Reference column as the agency-name slot
    // The partner's own booking ID lands in the Tilvísun column. Optional —
    // empty refs are stored blank; orders still scope by customer name.
    ...(input.reference && input.reference.trim()
      ? { [FIELDS.tilvisun]: input.reference.trim() }
      : {}),
    // Dedicated column for the partner-side staffer name so it's
    // searchable / surfaceable separately from the auto-comment.
    ...(input.contactName && input.contactName.trim()
      ? { [FIELDS.contactName]: input.contactName.trim() }
      : {}),
    [FIELDS.email]: input.email,
    [FIELDS.phone]: input.phone,
    [FIELDS.serviceType]: input.serviceType,
    [FIELDS.flightDate]: input.flightDate,
    [FIELDS.pickupDate]: input.pickupDate,
    [FIELDS.timeWindow]: input.timeWindow,
    [FIELDS.pickupAddressFull]: input.hotelName || input.pickupAddress,
    [FIELDS.shortAddress]: (input.hotelName || input.pickupAddress).split(',')[0]?.trim() ||
      input.pickupAddress,
    [FIELDS.bagsRegular]: input.bagsRegular,
    [FIELDS.bagsOdd]: input.bagsOdd,
    [FIELDS.comment]: fullComment,
    [FIELDS.paymentMethod]: 'Reikningsviðskipti',
    // We do NOT write Greiðslustaða or Greitt — Airtable formulas/automations
    // own those for invoice-business orders.
    [FIELDS.language]: input.language || 'en',
    [FIELDS.currency]: 'ISK',
    // DO NOT set the Update OC trigger on creation — that flag is for
    // EDITS only. Setting it on a brand-new order makes the customer
    // receive both a booking confirmation AND a spurious "your order
    // was updated" email at the same time. The new-order side has its
    // own confirmation flow (Zap 262806875 on Greitt flip).
  }

  // Delivery address writes to the canonical Delivery Address column —
  // shortAddress is a separate display field that doubles as the airport
  // drop-off label, not the delivery address itself. Writing to
  // shortAddress made the actual Delivery Address column stay empty and
  // the customer confirmation email had no delivery address in it.
  if (input.deliveryAddress) {
    fields[FIELDS.deliveryAddress] = input.deliveryAddress
  }
  // Delivery date defaults to pickup date (same-day P&D is most common).
  // Partner can override via the form.
  fields[FIELDS.deliveryDate] = input.deliveryDate || input.pickupDate
  if (input.deliveryTimeWindow && input.deliveryTimeWindow.trim()) {
    fields[FIELDS.deliveryTimeWindow] = input.deliveryTimeWindow.trim()
  }
  if (input.airline) fields[FIELDS.airline] = input.airline
  if (input.flightNumber) fields[FIELDS.flightNumberFull] = input.flightNumber
  if (input.destinationCode) fields[FIELDS.destinationAirport] = input.destinationCode
  if (typeof input.estimatedAmount === 'number')
    fields[FIELDS.amount] = input.estimatedAmount

  // The airtable SDK types are strict about FieldSet shape; cast through
  // `as unknown` since we use field IDs as keys which it accepts at runtime
  // even though the type signature expects friendly names.
  const created = await table.create([{ fields } as unknown as { fields: FieldSet }])
  const record = created[0]
  return mapRecord(record)
}

// Pickup-date keyed KPIs tailored for project managers organizing driving.
// "next 7 days" is the headline; the bigger context goes in the subtitle.
export const computeKpis = (orders: OrderSummary[]) => {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
  const in7d = new Date(startOfToday)
  in7d.setDate(in7d.getDate() + 7)

  const isLiveStatus = (s: string | null): boolean =>
    s !== 'Cancelled' && s !== 'Delivered'

  // Pickup date is the canonical scheduling key for the dispatcher view.
  const withPickup = orders.map((o) => ({
    ...o,
    pickupTs: o.pickupDate ? Date.parse(o.pickupDate) : Number.NaN,
  }))

  const upcoming = withPickup.filter(
    (o) => Number.isFinite(o.pickupTs) && o.pickupTs >= startOfToday.getTime() && isLiveStatus(o.status)
  )
  const next7d = upcoming.filter((o) => o.pickupTs < in7d.getTime())
  const today = upcoming.filter((o) => o.pickupTs < startOfTomorrow.getTime())
  const next7dBags = next7d.reduce((s, o) => s + o.bagsRegular + o.bagsOdd, 0)
  const todayBags = today.reduce((s, o) => s + o.bagsRegular + o.bagsOdd, 0)

  const inProgress = orders.filter((o) => o.status === 'In Progress').length
  // "Awaiting driver" = live order in the future with no driver assigned.
  // Surfaces orders the dispatcher needs to staff before they go.
  const awaitingDriver = upcoming.filter((o) => !o.driverName).length
  const assigned = upcoming.filter((o) => Boolean(o.driverName)).length

  return {
    todayCount: today.length,
    todayBags,
    next7dCount: next7d.length,
    next7dBags,
    upcomingTotal: upcoming.length, // all future live orders (subtitle)
    awaitingDriver,
    assigned,
    inProgress,
  }
}

export type Kpis = ReturnType<typeof computeKpis>
