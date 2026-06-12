/**
 * Closed booking days — staff-managed in the Airtable "Closed Dates" table
 * (base appHB2bNYPAhfUcLv, tblScRU51mn034L9S). Each row is a day that is closed
 * for online bookings; the `Scope` multi-select limits it to specific services
 * (empty or "All" = every service).
 *
 * Used by:
 *   - GET /api/booking/closed-dates  → the booking forms disable these days
 *   - storage / bikerent checkout + edit → reject a booking on a closed day
 *
 * Reads use the app Airtable token (data.records:read).
 */
import Airtable from 'airtable'
import getAppConfig from '../modules/config'

const CLOSED_DATES_TABLE_ID = 'tblScRU51mn034L9S'
const DATE_FIELD = 'Date'
const SCOPE_FIELD = 'Scope'

export type ClosedScope = 'Luggage Lockers' | 'BikeRent' | 'BagBee storage'

/** Map a booking `source`/reference to the Closed Dates scope label. */
export const sourceToScope = (source?: string): ClosedScope | undefined => {
  switch (source) {
    case 'luggage-lockers':
    case 'luggagelockers.is':
      return 'Luggage Lockers'
    case 'bikerent':
    case 'bikerent.is':
      return 'BikeRent'
    case 'bagbee':
    case 'bagbee.is':
    case 'storage':
      return 'BagBee storage'
    default:
      return undefined
  }
}

/** Normalise any Airtable date value to a YYYY-MM-DD string (or null). */
export const toYmd = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v.trim())
  return m ? m[1] : null
}

const todayYmd = (): string => {
  // Iceland is UTC year-round, so UTC components match wall-clock.
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * The future closed dates (YYYY-MM-DD) that apply to a given scope. A row
 * applies when its Scope is empty, contains "All", or contains the scope label.
 * Past dates are dropped (nothing can be booked into the past anyway).
 */
export const fetchClosedDates = async (scope?: ClosedScope): Promise<string[]> => {
  const {
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
  } = getAppConfig()
  Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
  const table = Airtable.base(airtableBaseId)(CLOSED_DATES_TABLE_ID)

  const records = await table.select({ fields: [DATE_FIELD, SCOPE_FIELD] }).all()
  const today = todayYmd()
  const out = new Set<string>()

  for (const r of records) {
    const ymd = toYmd(r.get(DATE_FIELD))
    if (!ymd || ymd < today) continue
    const scopes = (r.get(SCOPE_FIELD) as string[] | undefined) || []
    const applies =
      scopes.length === 0 || scopes.includes('All') || (scope ? scopes.includes(scope) : true)
    if (applies) out.add(ymd)
  }

  return Array.from(out).sort()
}

/**
 * Returns the first closed date among the given dates, or null if none are
 * closed. Fail-open helper for checkout/edit validation.
 */
export const firstClosedDate = (closed: string[], ...dates: (string | undefined)[]): string | null => {
  const set = new Set(closed)
  for (const d of dates) {
    const ymd = toYmd(d)
    if (ymd && set.has(ymd)) return ymd
  }
  return null
}
