// Driver tracking abstraction. The partner portal reads driver position +
// route data through this interface; the implementation is swappable so the
// dispatcher can improve the underlying source over time without the portal
// needing changes.
//
// === Today's data source ===
// `airtable-positions` provider (default when `DRIVER_POSITIONS_TABLE_ID`
// is set): reads from a small Airtable table you can populate from any
// upstream — a driver-app webhook, a cron polling a fleet API, OptimoRoute,
// or your in-house dispatch backend when you build it.
//
// Expected schema (column names are configurable via env, with sensible
// defaults):
//   Driver            (linked record → Starfsmenn, primary)
//   Latitude          (number)
//   Longitude         (number)
//   Timestamp         (date/time, last-modified)
//   Active Order      (linked record → Nýtt/óflokkað, optional)
//
// === Tomorrow's data source ===
// When you wire up the in-house dispatch backend (VROOM/OSRM at :3030)
// with a positions feed, add a new `InhouseDispatchProvider` here and
// switch the env var. The portal pages don't change.

import { getBase } from './airtable'
import { geocode, LatLng } from './geocode'

export type DriverPosition = {
  lat: number
  lng: number
  // Unix milliseconds — when the position was last reported.
  reportedAt: number
}

export type OrderRouteHint = {
  pickup: LatLng | null
  delivery: LatLng | null
  // Polyline (Google polyline-encoding 5) for the planned road path, if the
  // dispatch backend has solved this order's route already.
  polyline: string | null
}

export type DriverTrackingProvider = {
  name: string
  // Returns the latest known position for the driver, or null if we don't
  // have one yet (no GPS source, or no recent ping).
  getDriverPosition: (
    driverRecordId: string,
    orderRecordId: string,
  ) => Promise<DriverPosition | null>
  // Optional: planned route geometry for this order. v1 returns null — the
  // dispatcher dashboard's VROOM/OSRM solver will populate this later.
  getRouteHint: (orderRecordId: string) => Promise<OrderRouteHint>
}

const noopProvider: DriverTrackingProvider = {
  name: 'noop',
  getDriverPosition: async () => null,
  getRouteHint: async () => ({ pickup: null, delivery: null, polyline: null }),
}

// --- Airtable-table backed provider ------------------------------------

const TABLE_ID = process.env.DRIVER_POSITIONS_TABLE_ID || ''
const POS_DRIVER_FIELD = process.env.DRIVER_POSITIONS_DRIVER_FIELD || 'Driver'
const POS_LAT_FIELD = process.env.DRIVER_POSITIONS_LAT_FIELD || 'Latitude'
const POS_LNG_FIELD = process.env.DRIVER_POSITIONS_LNG_FIELD || 'Longitude'
const POS_TS_FIELD = process.env.DRIVER_POSITIONS_TS_FIELD || 'Timestamp'

type CachedPosition = { value: DriverPosition | null; fetchedAt: number }
const POSITION_TTL_MS = 15 * 1000 // 15s — driver positions move; don't over-cache
const positionCache = new Map<string, CachedPosition>()

const airtableProvider: DriverTrackingProvider = {
  name: 'airtable-positions',
  getDriverPosition: async (driverRecordId) => {
    if (!TABLE_ID) return null
    const cached = positionCache.get(driverRecordId)
    if (cached && Date.now() - cached.fetchedAt < POSITION_TTL_MS) {
      return cached.value
    }
    try {
      const base = getBase()
      // Find the most recently-updated position row that links this driver.
      // FIND(driverId, ARRAYJOIN({Driver})) handles the linked-record case.
      const safeId = driverRecordId.replace(/'/g, "\\'")
      const records = await base(TABLE_ID)
        .select({
          filterByFormula: `FIND('${safeId}', ARRAYJOIN({${POS_DRIVER_FIELD}}))`,
          sort: [{ field: POS_TS_FIELD, direction: 'desc' }],
          maxRecords: 1,
        })
        .firstPage()
      let pos: DriverPosition | null = null
      if (records.length > 0) {
        const f = records[0].fields as Record<string, unknown>
        const lat = f[POS_LAT_FIELD]
        const lng = f[POS_LNG_FIELD]
        const ts = f[POS_TS_FIELD]
        if (typeof lat === 'number' && typeof lng === 'number') {
          const tsMs = typeof ts === 'string' ? Date.parse(ts) : NaN
          pos = {
            lat,
            lng,
            reportedAt: Number.isFinite(tsMs) ? tsMs : Date.now(),
          }
        }
      }
      positionCache.set(driverRecordId, { value: pos, fetchedAt: Date.now() })
      return pos
    } catch (err) {
      console.warn('[driverTracking] airtable position lookup failed', err)
      positionCache.set(driverRecordId, { value: null, fetchedAt: Date.now() })
      return null
    }
  },
  getRouteHint: async () => {
    // Hook to the dispatch backend's planned-route store goes here once it
    // exposes a per-order endpoint. For now: pickup/delivery come from the
    // order's address fields (geocoded by /api/.../tracking), polyline null.
    return { pickup: null, delivery: null, polyline: null }
  },
}

// Provider selection. Defaults to noop. Set DRIVER_POSITIONS_TABLE_ID in
// .env.local to enable the Airtable-backed provider.
const provider: DriverTrackingProvider = TABLE_ID ? airtableProvider : noopProvider

export const getDriverPosition = (
  driverRecordId: string,
  orderRecordId: string,
): Promise<DriverPosition | null> =>
  provider.getDriverPosition(driverRecordId, orderRecordId)

export const getRouteHint = (orderRecordId: string): Promise<OrderRouteHint> =>
  provider.getRouteHint(orderRecordId)

export const trackingProviderName = (): string => provider.name

// --- High-level helper used by the API endpoint ------------------------

export type OrderTracking = {
  provider: string
  pickup: LatLng | null
  delivery: LatLng | null
  driver: DriverPosition | null
  // Crow-flight distance from driver → pickup (v1). Swap for true road
  // distance via OSRM when the dispatch backend exposes a /route endpoint
  // we can call from this process.
  distanceToPickupMeters: number | null
  // Polyline of the planned route (when the dispatcher has solved it).
  polyline: string | null
}

import { haversineMeters } from './geocode'

export const computeOrderTracking = async (params: {
  orderRecordId: string
  driverRecordId: string | null
  pickupAddress: string | null
  deliveryAddress: string | null
  // Manual pickup-pin placement from the dashboard map. When set, skip
  // geocoding entirely for the pickup point.
  pickupOverride?: LatLng | null
  // Same for the delivery pin — when the partner drags it on the map,
  // we trust the manual placement over the geocoder.
  deliveryOverride?: LatLng | null
}): Promise<OrderTracking> => {
  const [pickup, delivery] = await Promise.all([
    params.pickupOverride
      ? Promise.resolve(params.pickupOverride)
      : params.pickupAddress
      ? geocode(params.pickupAddress)
      : Promise.resolve(null),
    params.deliveryOverride
      ? Promise.resolve(params.deliveryOverride)
      : params.deliveryAddress
      ? geocode(params.deliveryAddress)
      : Promise.resolve(null),
  ])
  const hint = await provider.getRouteHint(params.orderRecordId)
  // Manual override takes top priority, then provider hint, then geocode.
  const finalPickup = params.pickupOverride ?? hint.pickup ?? pickup
  const finalDelivery = params.deliveryOverride ?? hint.delivery ?? delivery
  const driver = params.driverRecordId
    ? await provider.getDriverPosition(params.driverRecordId, params.orderRecordId)
    : null
  const distance =
    driver && finalPickup
      ? Math.round(haversineMeters(driver, finalPickup))
      : null
  return {
    provider: provider.name,
    pickup: finalPickup,
    delivery: finalDelivery,
    driver,
    distanceToPickupMeters: distance,
    polyline: hint.polyline,
  }
}
