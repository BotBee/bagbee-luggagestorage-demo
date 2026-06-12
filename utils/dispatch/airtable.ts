import Airtable, { FieldSet, Records } from 'airtable'
import getAppConfig from '../../modules/config'
import { FLD, SCHED, ShiftName, TBL_ORDERS, TBL_SCHEDULE } from './fields'

const {
  serverRuntimeConfig: {
    airtableAccessToken,
    airtableBaseId,
    airtableEndpointUrl,
  },
} = getAppConfig()

function getBase() {
  Airtable.configure({
    apiKey: airtableAccessToken,
    endpointUrl: airtableEndpointUrl,
  })
  return Airtable.base(airtableBaseId)
}

export type DispatchOrder = {
  recordId: string
  orderId: number | string
  orderNo: string
  customer: string
  pickupAddress: string
  deliveryAddress: string
  municipality: string
  timeSlot: string
  shift: string
  bags: number
  phone: string
  paid: boolean
  orderStatus: string
  // Airtable-computed service times in minutes (scale with bag count).
  // Used as VROOM service durations; null means "use default".
  pickupDurationMin: number | null
  deliveryDurationMin: number | null
}

export type DispatchDriver = {
  recordId: string
  name: string
  email: string | null
  homeAddress: string | null
}

function pickFirst<T>(v: T | T[] | undefined | null): T | undefined {
  if (Array.isArray(v)) return v[0]
  return v ?? undefined
}

function asString(v: unknown): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.map(String).join(', ')
  if (typeof v === 'object') {
    const name = (v as { name?: string }).name
    if (typeof name === 'string') return name
  }
  return String(v)
}

async function selectAll(
  tableId: string,
  filterByFormula: string,
  fieldIds: string[],
): Promise<Records<FieldSet>> {
  const table = getBase()(tableId)
  return await table
    .select({
      filterByFormula,
      returnFieldsByFieldId: true,
      fields: fieldIds,
    })
    .all()
}

// Tonight's pickups: pickup_date == date AND shift == shiftName AND paid == true.
export async function getOrdersForShift(
  date: string,
  shift: ShiftName,
): Promise<DispatchOrder[]> {
  const formula = `AND(DATETIME_FORMAT({Dagsetning pick-up}, 'YYYY-MM-DD') = '${date}', {shift (formula)} = '${shift}')`

  const records = await selectAll(TBL_ORDERS, formula, [
    FLD.orderId,
    FLD.orderNumber,
    FLD.pickupAddress,
    FLD.municipality,
    FLD.timeSlot,
    FLD.shift,
    FLD.pickupDate,
    FLD.customerName,
    FLD.bagCount,
    FLD.phone,
    FLD.deliveryAddress,
    FLD.optimoPickupId,
    FLD.optimoDeliveryId,
    FLD.orderStatus,
    FLD.paid,
    FLD.pickupDurationMin,
    FLD.deliveryDurationMin,
  ])

  const orders: DispatchOrder[] = []
  for (const rec of records) {
    const f = rec.fields as Record<string, unknown>
    const paid = Boolean(f[FLD.paid])
    if (!paid) continue

    const pickupDur = f[FLD.pickupDurationMin]
    const deliveryDur = f[FLD.deliveryDurationMin]
    orders.push({
      recordId: rec.id,
      orderId: (f[FLD.orderId] as number | string) ?? '',
      orderNo: asString(f[FLD.orderNumber]),
      customer: asString(f[FLD.customerName]),
      pickupAddress: asString(f[FLD.pickupAddress]),
      deliveryAddress: asString(f[FLD.deliveryAddress]),
      municipality: asString(f[FLD.municipality]),
      timeSlot: asString(f[FLD.timeSlot]),
      shift: asString(f[FLD.shift]),
      bags: Number(f[FLD.bagCount] ?? 0),
      phone: asString(f[FLD.phone]),
      paid,
      orderStatus: asString(f[FLD.orderStatus]),
      pickupDurationMin: typeof pickupDur === 'number' ? pickupDur : null,
      deliveryDurationMin:
        typeof deliveryDur === 'number' ? deliveryDur : null,
    })
  }
  return orders
}

// Vaktaskipulag drivers for date+shift. May be more than one if multiple
// drivers are linked to the same schedule row.
export async function getDriversForShift(
  date: string,
  shift: ShiftName,
): Promise<DispatchDriver[]> {
  const formula = `AND(DATETIME_FORMAT({date}, 'YYYY-MM-DD') = '${date}', {Shift} = '${shift}')`

  const records = await selectAll(TBL_SCHEDULE, formula, [
    SCHED.date,
    SCHED.shift,
    SCHED.driver,
    SCHED.driverEmail,
    SCHED.driverName,
    SCHED.driverAddress,
  ])

  const drivers: DispatchDriver[] = []
  for (const rec of records) {
    const f = rec.fields as Record<string, unknown>
    const ids = (f[SCHED.driver] as string[] | undefined) ?? []
    const emails = (f[SCHED.driverEmail] as string[] | undefined) ?? []
    const names = (f[SCHED.driverName] as string[] | undefined) ?? []
    const addresses = (f[SCHED.driverAddress] as string[] | undefined) ?? []

    // Lookup arrays line up index-for-index with the linked driver records.
    for (let i = 0; i < ids.length; i++) {
      drivers.push({
        recordId: ids[i],
        name: names[i] ?? 'Unknown',
        email: emails[i] ?? null,
        homeAddress: addresses[i] ?? null,
      })
    }

    // Fallback: if no linked drivers but the row exists, surface the row id
    // so dispatch knows the schedule slot is empty.
    if (ids.length === 0) {
      drivers.push({
        recordId: rec.id,
        name: 'Unassigned',
        email: pickFirst(emails) ?? null,
        homeAddress: pickFirst(addresses) ?? null,
      })
    }
  }
  return drivers
}
