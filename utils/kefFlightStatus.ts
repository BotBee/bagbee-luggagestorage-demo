/**
 * Best-effort KEF flight status via the azinQ / Isavia airport API (the same
 * source the booking flow already uses in pages/api/air-travel/get-flights.ts).
 *
 * Used by the handoff monitor to (a) escalate when an outgoing customer's
 * DEPARTURE flight has already left while their locker is still full, and
 * (b) hold the incoming customer's "your locker may be delayed" email until
 * their ARRIVAL flight has actually landed.
 *
 * It is intentionally NON-fatal: any failure returns null and the monitor falls
 * back to schedule-time logic. Flight status only ever *refines* the decision.
 */
import getAppConfig from '../modules/config'
import { FlightData } from '../common/types'

export type FlightInfo = {
  flightNumber: string
  scheduled?: string
  estimated?: string
  statusDesc?: string
  /** True when an arrival has clearly landed. */
  arrived: boolean
  /** True when a departure has clearly left. */
  departed: boolean
}

const norm = (s?: string) => (s || '').replace(/\s+/g, '').toUpperCase()

/**
 * Look up a flight at KEF by number on a given date.
 * @param type 'A' = arrival (incoming customer), 'D' = departure (outgoing).
 */
export async function lookupKefFlight(
  flightNumber: string,
  dateYmd: string,
  type: 'A' | 'D',
): Promise<FlightInfo | null> {
  if (!flightNumber || !dateYmd) return null
  const {
    serverRuntimeConfig: {
      azinQAirportApiBaseUrl,
      azinQAirportApiUsername,
      azinQAirportApiPassword,
      azinQAirportApiToken,
    },
  } = getAppConfig()
  if (!azinQAirportApiBaseUrl) return null

  try {
    const resp = await fetch(azinQAirportApiBaseUrl, {
      method: 'GET',
      headers: {
        Username: azinQAirportApiUsername,
        Password: azinQAirportApiPassword,
        Token: azinQAirportApiToken,
        DepartureArrivalType: type,
        ScheduledTimeStart: `${dateYmd}T00:00:00`,
        ScheduledTimeEnd: `${dateYmd}T23:59:59`,
      } as any,
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as FlightData[]
    if (!Array.isArray(data)) return null
    const f = data.find((d) => norm(d.FlightNumber) === norm(flightNumber))
    if (!f) return null

    const desc = (f.FlightStatusDesc || '').toLowerCase()
    const est = f.EstimatedDateTime ? Date.parse(f.EstimatedDateTime) : NaN
    const estPast = !isNaN(est) && est < Date.now()
    // Status descriptions vary; match on keywords and fall back to the
    // estimated time being in the past.
    const arrived = type === 'A' && (/land|arriv/.test(desc) || estPast)
    const departed = type === 'D' && (/depart|airborne|gate closed|left/.test(desc) || estPast)

    return {
      flightNumber: f.FlightNumber,
      scheduled: f.ScheduledDateTime,
      estimated: f.EstimatedDateTime,
      statusDesc: f.FlightStatusDesc || undefined,
      arrived: !!arrived,
      departed: !!departed,
    }
  } catch {
    return null
  }
}
