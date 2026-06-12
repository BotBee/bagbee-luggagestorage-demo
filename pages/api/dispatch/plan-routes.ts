import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../utils/dispatch/auth'
import {
  getDriversForShift,
  getOrdersForShift,
} from '../../../utils/dispatch/airtable'
import { geocodeMany } from '../../../utils/dispatch/geocode'
import type { ShiftName } from '../../../utils/dispatch/fields'
import {
  DEPOT_LOCATION,
  KEF_LOCATION,
  defaultShiftWindow,
  parseTimeSlot,
  solve,
  VroomShipment,
  VroomVehicle,
} from '../../../utils/dispatch/vroom'

const VALID_SHIFTS: ShiftName[] = ['Evening', 'Morning', 'Day']
// Fallback service times if the Airtable Pickup/Delivery Duration formulas
// aren't populated (legacy orders). The live values come from each order
// row in minutes and scale with bag count, so the planner sees realistic
// stop budgets per customer instead of one constant.
const FALLBACK_PICKUP_SECONDS = 240 // 4 min
const FALLBACK_DELIVERY_SECONDS = 30 // 30s
const DEFAULT_VEHICLE_CAPACITY = 100 // bags
const PRIORITY_BY_STATUS: Record<string, number> = {
  // Higher = solver less willing to drop. 0..100.
  Pending: 50,
  Confirmed: 80,
}

// POST /api/dispatch/plan-routes
// Body: { date: 'YYYY-MM-DD', shift: 'Evening' }
//
// Models each order as a VROOM shipment: pickup at the customer, delivery at
// KEF. The solver guarantees pickup-before-delivery on the same vehicle and
// handles capacity along the way. Vehicles start and end at BSÍ.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  if (!requireAdmin(req, res)) return

  const {
    date,
    shift,
    driverRecordIds,
    orderRecordIds,
    overrides,
    lockedRoutes,
    vehicleCapacities,
  } = (req.body || {}) as {
    date?: string
    shift?: ShiftName
    driverRecordIds?: string[]
    // Subset of order record IDs to plan. When present, only these orders are
    // routed — the rest are left unplanned so the dispatcher can send a partial
    // plan now and plan the others later.
    orderRecordIds?: string[]
    // Per-order session overrides keyed by Airtable record ID. Empty/missing
    // fields fall through to the order's stored values.
    overrides?: Record<
      string,
      {
        timeSlot?: string
        pickupDurationMin?: number
        deliveryDurationMin?: number
      }
    >
    // Driver-record-id → ordered list of order-record-ids that must remain in
    // that exact sequence on that vehicle. Sent by the dashboard for routes
    // the dispatcher has locked.
    lockedRoutes?: Record<string, string[]>
    // Driver-record-id → bag capacity of the assigned van. Overrides the
    // default so VROOM won't overfill a small vehicle.
    vehicleCapacities?: Record<string, number>
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: 'date must be YYYY-MM-DD' })
  }
  const shiftName = (shift || 'Evening') as ShiftName
  if (!VALID_SHIFTS.includes(shiftName)) {
    return res
      .status(400)
      .json({ message: `shift must be one of ${VALID_SHIFTS.join(', ')}` })
  }

  try {
    const [allOrders, allDrivers] = await Promise.all([
      getOrdersForShift(date, shiftName),
      getDriversForShift(date, shiftName),
    ])

    // If the dashboard sent a subset of order IDs, only plan those.
    const orders =
      Array.isArray(orderRecordIds) && orderRecordIds.length > 0
        ? allOrders.filter((o) => orderRecordIds.includes(o.recordId))
        : allOrders

    // If the dashboard sent a subset of driver record IDs, only solve for
    // those vehicles. Otherwise use everyone scheduled.
    const drivers =
      Array.isArray(driverRecordIds) && driverRecordIds.length > 0
        ? allDrivers.filter((d) => driverRecordIds.includes(d.recordId))
        : allDrivers

    if (orders.length === 0) {
      return res.status(200).json({
        date,
        shift: shiftName,
        message: 'No paid orders for this shift',
        orders: [],
        drivers,
        solution: null,
      })
    }
    if (drivers.length === 0) {
      return res.status(400).json({
        message: `No drivers scheduled for ${shiftName} on ${date}. Add a Vaktaskipulag row first.`,
      })
    }

    const uniqueAddresses = Array.from(
      new Set(orders.map((o) => o.pickupAddress).filter(Boolean)),
    )
    const coords = await geocodeMany(uniqueAddresses)

    const ungeocoded = orders.filter((o) => !coords.has(o.pickupAddress))
    const geocodedOrders = orders.filter((o) => coords.has(o.pickupAddress))

    const shiftWindow = defaultShiftWindow(shiftName, date)

    // One shipment per order: pickup at the customer, delivery at KEF.
    // Pickup and delivery share the shipment id so we can map back.
    // Track shipmentId → orderRecordId so we can wire up locked-route steps
    // below by referencing real shipment IDs.
    const shipmentIdByOrderId = new Map<string, number>()
    const shipments: VroomShipment[] = geocodedOrders.map((o, idx) => {
      const id = idx + 1
      shipmentIdByOrderId.set(o.recordId, id)
      const loc = coords.get(o.pickupAddress)!
      const ov = overrides?.[o.recordId]
      const effectiveTimeSlot = ov?.timeSlot || o.timeSlot
      const tw = parseTimeSlot(effectiveTimeSlot, date) ?? shiftWindow
      const clamped: [number, number] = [
        Math.max(tw[0], shiftWindow[0]),
        Math.min(tw[1], shiftWindow[1]),
      ]
      const pickupMin =
        typeof ov?.pickupDurationMin === 'number'
          ? ov.pickupDurationMin
          : o.pickupDurationMin
      const deliveryMin =
        typeof ov?.deliveryDurationMin === 'number'
          ? ov.deliveryDurationMin
          : o.deliveryDurationMin
      const pickupService =
        pickupMin != null
          ? Math.round(pickupMin * 60)
          : FALLBACK_PICKUP_SECONDS
      const deliveryService =
        deliveryMin != null
          ? Math.round(deliveryMin * 60)
          : FALLBACK_DELIVERY_SECONDS
      return {
        pickup: {
          id,
          description: `${o.orderNo || o.orderId} – ${o.customer}`,
          location: [loc.lng, loc.lat],
          service: pickupService,
          time_windows: clamped[0] < clamped[1] ? [clamped] : undefined,
        },
        delivery: {
          id,
          description: `KEF drop – ${o.customer}`,
          location: KEF_LOCATION,
          service: deliveryService,
        },
        amount: [Math.max(1, Number(o.bags) || 1)],
        priority: PRIORITY_BY_STATUS[o.orderStatus] ?? 50,
      }
    })

    const vehicles: VroomVehicle[] = drivers.map((d, idx) => {
      // Capacity (bags) from the assigned van if the dashboard sent one,
      // else a generous default.
      const cap = vehicleCapacities?.[d.recordId]
      const v: VroomVehicle = {
        id: idx + 1,
        description: d.name,
        profile: 'car',
        start: DEPOT_LOCATION,
        end: DEPOT_LOCATION,
        capacity: [
          typeof cap === 'number' && cap > 0 ? cap : DEFAULT_VEHICLE_CAPACITY,
        ],
        time_window: shiftWindow,
      }
      // If this driver's route is locked, emit a fixed step list. VROOM
      // honours the sequence: start → each shipment's pickup, in order →
      // each delivery, in the same order → end. Pickups must come before
      // their deliveries on the same vehicle, which our shipment model
      // guarantees because every delivery is at KEF.
      const lockedOrderIds = lockedRoutes?.[d.recordId]
      if (lockedOrderIds && lockedOrderIds.length > 0) {
        const stepIds: number[] = []
        for (const orderId of lockedOrderIds) {
          const shipId = shipmentIdByOrderId.get(orderId)
          if (shipId != null) stepIds.push(shipId)
        }
        if (stepIds.length > 0) {
          v.steps = [
            { type: 'start' },
            ...stepIds.map((id) => ({ type: 'pickup' as const, id })),
            ...stepIds.map((id) => ({ type: 'delivery' as const, id })),
            { type: 'end' },
          ]
        }
      }
      return v
    })

    const solution = await solve({ shipments, vehicles })

    const orderByShipmentId = new Map<number, (typeof geocodedOrders)[number]>()
    geocodedOrders.forEach((o, i) => orderByShipmentId.set(i + 1, o))

    const driverByVehicleId = new Map<number, (typeof drivers)[number]>()
    drivers.forEach((d, i) => driverByVehicleId.set(i + 1, d))

    const enrichedRoutes = solution.routes.map((r) => ({
      vehicle: r.vehicle,
      driver: driverByVehicleId.get(r.vehicle) ?? null,
      duration: r.duration,
      service: r.service,
      waiting_time: r.waiting_time,
      distance: r.distance,
      cost: r.cost,
      geometry: r.geometry,
      steps: r.steps.map((s) => ({
        type: s.type,
        arrival: s.arrival,
        duration: s.duration,
        service: s.service,
        waiting_time: s.waiting_time,
        location: s.location,
        load: s.load,
        order:
          (s.type === 'pickup' || s.type === 'delivery') && s.id != null
            ? orderByShipmentId.get(s.id) ?? null
            : null,
      })),
    }))

    res.status(200).json({
      date,
      shift: shiftName,
      summary: solution.summary,
      ungeocoded: ungeocoded.map((o) => ({
        orderNo: o.orderNo,
        customer: o.customer,
        address: o.pickupAddress,
      })),
      unassigned: solution.unassigned.map((u) => ({
        shipmentId: u.id,
        order: orderByShipmentId.get(u.id) ?? null,
      })),
      routes: enrichedRoutes,
    })
  } catch (err: any) {
    console.error('dispatch/plan-routes error:', err)
    res
      .status(500)
      .json({ message: 'Failed to plan routes', error: err?.message })
  }
}
