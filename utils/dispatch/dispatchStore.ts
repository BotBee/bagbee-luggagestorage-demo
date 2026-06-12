import Airtable, { FieldSet, Records } from 'airtable'
import getAppConfig from '../../modules/config'
import {
  PLAN,
  STOP,
  TBL_DISPATCH_PLANS,
  TBL_DISPATCH_STOPS,
  ShiftName,
} from './fields'

const {
  serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
} = getAppConfig()

function base() {
  Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
  return Airtable.base(airtableBaseId)
}

// Shapes the client/plan-routes hands us (a subset of the enriched plan).
export type PlanStep = {
  type: 'start' | 'job' | 'pickup' | 'delivery' | 'break' | 'end'
  arrival: number // unix seconds
  service: number
  location: [number, number] // [lng, lat]
  order?: {
    recordId: string
    customer: string
    pickupAddress: string
    phone: string
    bags: number
    timeSlot: string
  } | null
}
export type PlanRoute = {
  driver: { recordId: string; name: string } | null
  duration: number
  distance?: number
  steps: PlanStep[]
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function iso(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString()
}


// Persist the dispatcher-approved plan. MERGE semantics: only the drivers and
// orders in THIS batch are replaced — any previously-saved stops for other
// orders/drivers on the same date+shift are left alone. This lets the
// dispatcher plan & send a subset now and plan the rest later without wiping
// the earlier send.
export async function savePlan(
  date: string,
  shift: ShiftName,
  routes: PlanRoute[],
  vehicles?: Record<string, string>,
): Promise<{ plans: number; stops: number }> {
  const batchDrivers = new Set(
    routes.map((r) => r.driver?.recordId).filter(Boolean) as string[],
  )
  const batchOrders = new Set<string>()
  for (const r of routes)
    for (const s of r.steps)
      if (s.order?.recordId) batchOrders.add(s.order.recordId)

  // Delete stops for this date+shift that belong to a driver in this batch OR
  // an order in this batch (so re-planning an order moves it cleanly).
  const stopsT = base()(TBL_DISPATCH_STOPS)
  const allStops = await stopsT.select({ returnFieldsByFieldId: true }).all()
  const stopsToDelete = allStops
    .filter((r) => {
      const f = r.fields as Record<string, unknown>
      if (f[STOP.date] !== date || f[STOP.shift] !== shift) return false
      const drv = String(f[STOP.driverRecordId] ?? '')
      const ord = String(f[STOP.orderRecordId] ?? '')
      return batchDrivers.has(drv) || batchOrders.has(ord)
    })
    .map((r) => r.id)
  for (const ids of chunk(stopsToDelete, 10)) await stopsT.destroy(ids)

  // Delete plan rows for the drivers in this batch.
  const plansT = base()(TBL_DISPATCH_PLANS)
  const allPlans = await plansT.select({ returnFieldsByFieldId: true }).all()
  const plansToDelete = allPlans
    .filter((r) => {
      const f = r.fields as Record<string, unknown>
      return (
        f[PLAN.date] === date &&
        f[PLAN.shift] === shift &&
        batchDrivers.has(String(f[PLAN.driverRecordId] ?? ''))
      )
    })
    .map((r) => r.id)
  for (const ids of chunk(plansToDelete, 10)) await plansT.destroy(ids)

  const finalizedAt = new Date().toISOString()
  const planRows: { fields: Record<string, unknown> }[] = []
  const stopRows: { fields: Record<string, unknown> }[] = []

  for (const r of routes) {
    if (!r.driver) continue
    const stops = r.steps.filter((s) => s.type === 'pickup' || s.type === 'delivery')
    const driveSec = r.duration
    planRows.push({
      fields: {
        [PLAN.planKey]: `${date} · ${shift} · ${r.driver.name}`,
        [PLAN.date]: date,
        [PLAN.shift]: shift,
        [PLAN.driverRecordId]: r.driver.recordId,
        [PLAN.driverName]: r.driver.name,
        [PLAN.finalizedAt]: finalizedAt,
        [PLAN.summary]: `${stops.filter((s) => s.type === 'pickup').length} pickups · ${(
          (r.distance ?? 0) / 1000
        ).toFixed(1)} km · ${Math.round(driveSec / 60)} min`,
        [PLAN.totalDistanceM]: Math.round(r.distance ?? 0),
        [PLAN.totalDurationS]: Math.round(driveSec),
        [PLAN.stopsCount]: stops.length,
        [PLAN.vehicle]: vehicles?.[r.driver.recordId] ?? '',
      },
    })

    let seq = 0
    for (const s of stops) {
      seq += 1
      stopRows.push({
        fields: {
          [STOP.stopKey]: `${date} · ${r.driver.name} · ${seq} · ${s.type}`,
          [STOP.date]: date,
          [STOP.shift]: shift,
          [STOP.driverRecordId]: r.driver.recordId,
          [STOP.driverName]: r.driver.name,
          [STOP.orderRecordId]: s.order?.recordId ?? '',
          [STOP.seq]: seq,
          [STOP.type]: s.type,
          [STOP.customer]: s.order?.customer ?? '',
          [STOP.address]:
            s.type === 'delivery'
              ? 'Keflavík International Airport'
              : s.order?.pickupAddress ?? '',
          [STOP.lat]: s.location[1],
          [STOP.lng]: s.location[0],
          [STOP.phone]: s.order?.phone ?? '',
          [STOP.bags]: s.order?.bags ?? 0,
          [STOP.timeWindow]: s.order?.timeSlot ?? '',
          [STOP.plannedArrival]: iso(s.arrival),
          [STOP.status]: 'pending',
        },
      })
    }
  }

  const plansTable = base()(TBL_DISPATCH_PLANS)
  for (const c of chunk(planRows, 10)) await plansTable.create(c as any)
  const stopsTable = base()(TBL_DISPATCH_STOPS)
  for (const c of chunk(stopRows, 10)) await stopsTable.create(c as any)

  return { plans: planRows.length, stops: stopRows.length }
}

export type DriverStop = {
  stopId: string
  seq: number
  type: string
  orderRecordId: string
  customer: string
  address: string
  lat: number | null
  lng: number | null
  phone: string
  bags: number
  timeWindow: string
  plannedArrival: string
  status: string
  actualArrival: string | null
  note: string | null
}

// Read one driver's saved route for a date, ordered by seq.
export async function getDriverRoute(
  date: string,
  driverRecordId: string,
): Promise<{ plan: Record<string, unknown> | null; stops: DriverStop[] }> {
  const stopsTable = base()(TBL_DISPATCH_STOPS)
  const recs = await stopsTable
    .select({ returnFieldsByFieldId: true })
    .all()
  const mine = recs.filter((r) => {
    const f = r.fields as Record<string, unknown>
    return f[STOP.date] === date && f[STOP.driverRecordId] === driverRecordId
  })
  const stops: DriverStop[] = mine
    .map((r) => {
      const f = r.fields as Record<string, unknown>
      return {
        stopId: r.id,
        seq: Number(f[STOP.seq] ?? 0),
        type: String(f[STOP.type] ?? ''),
        orderRecordId: String(f[STOP.orderRecordId] ?? ''),
        customer: String(f[STOP.customer] ?? ''),
        address: String(f[STOP.address] ?? ''),
        lat: f[STOP.lat] != null ? Number(f[STOP.lat]) : null,
        lng: f[STOP.lng] != null ? Number(f[STOP.lng]) : null,
        phone: String(f[STOP.phone] ?? ''),
        bags: Number(f[STOP.bags] ?? 0),
        timeWindow: String(f[STOP.timeWindow] ?? ''),
        plannedArrival: String(f[STOP.plannedArrival] ?? ''),
        status: String(f[STOP.status] ?? 'pending'),
        actualArrival: f[STOP.actualArrival] ? String(f[STOP.actualArrival]) : null,
        note: f[STOP.note] ? String(f[STOP.note]) : null,
      }
    })
    .sort((a, b) => a.seq - b.seq)

  const plansTable = base()(TBL_DISPATCH_PLANS)
  const planRecs = await plansTable.select({ returnFieldsByFieldId: true }).all()
  const planRec = planRecs.find((r) => {
    const f = r.fields as Record<string, unknown>
    return f[PLAN.date] === date && f[PLAN.driverRecordId] === driverRecordId
  })
  const plan = planRec ? (planRec.fields as Record<string, unknown>) : null
  return { plan, stops }
}

// Returns the driverRecordId that owns a stop, or null if not found.
export async function getStopOwner(stopId: string): Promise<string | null> {
  try {
    const rec = await base()(TBL_DISPATCH_STOPS)
      .select({ returnFieldsByFieldId: true, filterByFormula: `RECORD_ID() = '${stopId}'`, maxRecords: 1 })
      .firstPage()
    if (!rec.length) return null
    return String((rec[0].fields as Record<string, unknown>)[STOP.driverRecordId] ?? '') || null
  } catch {
    return null
  }
}

export async function updateStopStatus(
  stopId: string,
  patch: { status?: string; note?: string; actualArrival?: string },
): Promise<void> {
  const fields: Record<string, unknown> = {}
  if (patch.status) fields[STOP.status] = patch.status
  if (patch.note != null) fields[STOP.note] = patch.note
  if (patch.actualArrival) fields[STOP.actualArrival] = patch.actualArrival
  await base()(TBL_DISPATCH_STOPS).update([{ id: stopId, fields } as any])
}

// Schedule (or cancel) the notification send for a saved plan. Sets the
// Scheduled Send At + Send Status on every Dispatch Plans row for (date,
// shift). Pass sendAtIso=null to cancel back to draft. Returns how many
// driver-plans were affected (0 means nothing saved yet).
export async function scheduleSend(
  date: string,
  shift: ShiftName,
  sendAtIso: string | null,
): Promise<number> {
  const plansTable = base()(TBL_DISPATCH_PLANS)
  const recs = await plansTable.select({ returnFieldsByFieldId: true }).all()
  const mine = recs.filter((r) => {
    const f = r.fields as Record<string, unknown>
    return f[PLAN.date] === date && f[PLAN.shift] === shift
  })
  if (!mine.length) return 0
  await plansTable.update(
    mine.map((r) => ({
      id: r.id,
      fields: {
        [PLAN.scheduledSendAt]: sendAtIso ?? '',
        [PLAN.sendStatus]: sendAtIso ? 'scheduled' : 'draft',
        [PLAN.sentAt]: '',
      },
    })) as any,
  )
  return mine.length
}

// Cron worker: fire any plans whose scheduled send time has passed.
// Returns the plans it published. Notification dispatch (SMS/email) is a
// stub hook for now — the time-trigger + status flip are live.
export async function runDueSends(
  nowIso: string,
): Promise<Array<{ date: string; shift: string; driver: string }>> {
  const plansTable = base()(TBL_DISPATCH_PLANS)
  const recs = await plansTable.select({ returnFieldsByFieldId: true }).all()
  const due = recs.filter((r) => {
    const f = r.fields as Record<string, unknown>
    const status = f[PLAN.sendStatus]
    const at = f[PLAN.scheduledSendAt]
    return status === 'scheduled' && typeof at === 'string' && at && at <= nowIso
  })
  if (!due.length) return []
  await plansTable.update(
    due.map((r) => ({
      id: r.id,
      fields: { [PLAN.sendStatus]: 'sent', [PLAN.sentAt]: nowIso },
    })) as any,
  )
  // TODO(notify): once an SMS/email provider is wired, dispatch
  // driver + customer notifications here for each fired plan.
  return due.map((r) => {
    const f = r.fields as Record<string, unknown>
    return {
      date: String(f[PLAN.date] ?? ''),
      shift: String(f[PLAN.shift] ?? ''),
      driver: String(f[PLAN.driverName] ?? ''),
    }
  })
}

// Update the driver's latest GPS on their Dispatch Plans row(s) for the date.
export async function updateDriverGps(
  date: string,
  driverRecordId: string,
  lat: number,
  lng: number,
  at: string,
): Promise<boolean> {
  const plansTable = base()(TBL_DISPATCH_PLANS)
  const recs = await plansTable.select({ returnFieldsByFieldId: true }).all()
  const mine = recs.filter((r) => {
    const f = r.fields as Record<string, unknown>
    return f[PLAN.date] === date && f[PLAN.driverRecordId] === driverRecordId
  })
  if (!mine.length) return false
  await plansTable.update(
    mine.map((r) => ({
      id: r.id,
      fields: { [PLAN.driverLastLat]: lat, [PLAN.driverLastLng]: lng, [PLAN.driverLastPingAt]: at },
    })) as any,
  )
  return true
}
