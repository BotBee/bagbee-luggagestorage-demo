/* eslint-disable no-unused-vars */
import Head from 'next/head'
import {
  GoogleMap,
  InfoWindow,
  Marker,
  Polyline,
  useJsApiLoader,
} from '@react-google-maps/api'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CommandPalette,
  PaletteEntry,
} from '../../components/dispatch/CommandPalette'
import { HelpOverlay } from '../../components/dispatch/HelpOverlay'
import { WorkloadBar } from '../../components/dispatch/WorkloadBar'
import { computeSla, SLA_COLORS, SLA_LABELS } from '../../utils/dispatch/sla'

type Order = {
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
  pickupDurationMin: number | null
  deliveryDurationMin: number | null
  // Geocoded pickup coordinates — set by /api/dispatch/orders so the map
  // can render every order, not just those VROOM placed on a route.
  lat: number | null
  lng: number | null
}

type Driver = {
  recordId: string
  name: string
  email: string | null
  homeAddress: string | null
}

type VehicleOpt = {
  recordId: string
  kind: 'own' | 'rental'
  name: string
  make: string
  model: string
  colour: string | null
  suitcases: number | null
  supplier: string | null
  recommended: boolean
  isElectric: boolean
}

type Step = {
  type: 'start' | 'job' | 'pickup' | 'delivery' | 'break' | 'end'
  arrival: number
  duration: number
  service: number
  waiting_time: number
  location: [number, number]
  // Shipment id for pickup/delivery steps; job id for plain job steps.
  // VROOM returns these alongside the step type.
  id?: number
  job?: number
  load?: number[]
  order?: Order | null
}

type Route = {
  vehicle: number
  driver: Driver | null
  duration: number
  service: number
  waiting_time: number
  distance?: number
  cost: number
  // Encoded polyline of the actual road path. Decoded with
  // google.maps.geometry.encoding.decodePath at render time.
  geometry?: string
  steps: Step[]
}

type WeatherStation = {
  id: number
  name: string
  windMs: number | null
  gustMs: number | null
  windAlert: string | null
  windDirection: string | null
  temperature: number | null
  roadTemperature: number | null
  updatedAt: string | null
}

type WeatherResponse = {
  stations: WeatherStation[]
  maxWind: number
  status: 'ok' | 'warn' | 'block'
  thresholds: { warn: number; block: number }
} | null

type PlanResponse = {
  date: string
  shift: string
  summary?: {
    cost: number
    routes: number
    unassigned: number
    duration: number
    distance?: number
  }
  ungeocoded: { orderNo: string; customer: string; address: string }[]
  unassigned: { shipmentId: number; order: Order | null }[]
  routes: Route[]
} | null

const SHIFTS = ['Evening', 'Morning', 'Day'] as const
type Shift = (typeof SHIFTS)[number]

const ROUTE_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#db2777',
  '#65a30d',
]

const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

// useJsApiLoader requires `libraries` to be a stable reference. Defining
// it module-scope avoids the loader re-initialising on every render.
const GOOGLE_MAPS_LIBRARIES: ('geometry')[] = ['geometry']

// Stable initial center — passed by reference so react-google-maps never
// re-applies it and fights the user's panning. The real framing is done
// with fitBounds in code.
const INITIAL_MAP_CENTER = { lat: 64.05, lng: -22.2 }

// The verbose per-driver stop name-list under each route is hidden — the
// timeline + the green marks in the Orders list replace it. Flag (not a bare
// `false`) so the build's eslint doesn't flag a constant condition.
const SHOW_ROUTE_STOP_LIST = false

// Airtable deep link for the side detail panel — clicking "Open in Airtable"
// jumps straight to the order's record.
const AIRTABLE_BASE_ID = 'appHB2bNYPAhfUcLv'
const AIRTABLE_ORDERS_TABLE_ID = 'tblWLlNxZvtkFSFXs'
function airtableRecordUrl(recordId: string): string {
  return `https://airtable.com/${AIRTABLE_BASE_ID}/${AIRTABLE_ORDERS_TABLE_ID}/${recordId}`
}

// Per-stop overrides the dispatcher applies in the panel. Session-only —
// they ride along with the next /api/dispatch/plan-routes call but do NOT
// write back to Airtable. Permanent edits go to Airtable directly.
type StopOverride = {
  timeSlot?: string // 'HH:MM-HH:MM'
  pickupDurationMin?: number
  deliveryDurationMin?: number
}

function todayIso(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtClock(unixSec: number): string {
  const d = new Date(unixSec * 1000)
  const h = String(d.getUTCHours()).padStart(2, '0')
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function fmtDuration(sec: number): string {
  const m = Math.round(sec / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

// Widen a "HH:MM - HH:MM" window by `mins` on each side. Used by the
// unassigned advisor's "relax windows" action. Returns null if unparseable.
function widenSlot(slot: string | undefined | null, mins: number): string | null {
  const m = (slot || '').match(
    /^\s*(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})\s*$/,
  )
  if (!m) return null
  const [, h1, m1, h2, m2] = m
  let start = Number(h1) * 60 + Number(m1) - mins
  let end = Number(h2) * 60 + Number(m2) + mins
  start = Math.max(0, start)
  end = Math.min(24 * 60 - 1, end)
  const fmt = (t: number) =>
    `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  return `${fmt(start)} - ${fmt(end)}`
}

// --- Design system -------------------------------------------------------
// Professional logistics-tool aesthetic: slate neutrals, one accent, a
// consistent spacing/radius/shadow scale, Inter type. Every component pulls
// from this object, so refining it here upgrades the whole surface.
const FONT =
  'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const C = {
  bg: '#f1f5f9', // slate-100 — app canvas
  surface: '#ffffff',
  border: '#e2e8f0', // slate-200
  borderStrong: '#cbd5e1',
  ink: '#0f172a', // slate-900
  body: '#334155', // slate-700
  muted: '#64748b', // slate-500
  faint: '#94a3b8', // slate-400
  accent: '#4f46e5', // indigo-600
  accentSoft: '#eef2ff',
  shadowSm: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)',
  shadowMd: '0 4px 12px rgba(16,24,40,.06), 0 2px 4px rgba(16,24,40,.04)',
}
const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: FONT,
    color: C.ink,
    background: C.bg,
    minHeight: '100vh',
    padding: '0 0 64px',
    WebkitFontSmoothing: 'antialiased',
  },
  // Sticky app bar across the top.
  appBar: {
    position: 'sticky',
    top: 0,
    zIndex: 40,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '12px 28px',
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'saturate(180%) blur(8px)',
    borderBottom: `1px solid ${C.border}`,
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 8,
    background: `linear-gradient(135deg, ${C.ink}, #334155)`,
    color: '#fde047',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 800,
    flexShrink: 0,
  },
  shell: { padding: '20px 28px 0', maxWidth: 1500, margin: '0 auto' },
  h1: { margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.2 },
  sub: { color: C.muted, marginTop: 4, fontSize: 13 },
  controls: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  input: {
    padding: '7px 10px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: 13,
    background: C.surface,
    color: C.ink,
    boxShadow: C.shadowSm,
    outline: 'none',
  },
  primary: {
    padding: '8px 15px',
    borderRadius: 8,
    border: 'none',
    background: C.ink,
    color: 'white',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: C.shadowSm,
  },
  secondary: {
    padding: '7px 13px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.body,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    boxShadow: C.shadowSm,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    marginTop: 12,
  },
  card: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 18,
    boxShadow: C.shadowSm,
  },
  cardTitle: {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: C.muted,
  },
  list: { listStyle: 'none', padding: 0, margin: '12px 0 0 0' },
  li: {
    padding: '9px 0',
    borderBottom: `1px solid ${C.bg}`,
    fontSize: 13,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: 999,
    background: '#f1f5f9',
    color: C.body,
  },
  routeBlock: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 18,
    marginTop: 12,
    boxShadow: C.shadowSm,
  },
  routeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  routeName: { fontSize: 15, fontWeight: 700 },
  routeMeta: { fontSize: 12, color: C.muted },
  step: {
    display: 'grid',
    gridTemplateColumns: '56px 24px 1fr auto',
    gap: 12,
    padding: '9px 0',
    borderBottom: `1px solid ${C.bg}`,
    fontSize: 13,
    alignItems: 'center',
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    background: C.ink,
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
  },
  err: {
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 13,
  },
  warn: {
    background: '#fffbeb',
    color: '#92400e',
    border: '1px solid #fde68a',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 13,
  },
  mapWrap: {
    width: '100%',
    height: 440,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    border: `1px solid ${C.border}`,
    boxShadow: C.shadowSm,
  },
  stats: {
    display: 'flex',
    gap: 28,
    marginBottom: 16,
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: '16px 22px',
    boxShadow: C.shadowSm,
  },
  statBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  statValue: { fontSize: 22, fontWeight: 700, color: C.ink, letterSpacing: -0.4 },
  statLabel: {
    fontSize: 11,
    color: C.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  legend: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 8,
    fontSize: 12,
  },
  legendDot: {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
    verticalAlign: 'middle',
  },
}

// Strip anything that isn't printable ASCII from the admin key. HTTP header
// values must be ISO-8859-1; a zero-width space or smart character pasted
// alongside the key would otherwise make every fetch throw
// "String contains non ISO-8859-1 code point" and break the whole page.
function cleanKey(s: string | null | undefined): string {
  return (s || '').replace(/[^\x20-\x7E]/g, '').trim()
}

function pickupCount(route: Route): number {
  return route.steps.filter((s) => s.type === 'pickup').length
}

// "Updated 23s ago" chip. Re-renders each second via the parent's nowTick.
function FreshnessChip({
  lastUpdated,
  now,
}: {
  lastUpdated: number | null
  now: number
}) {
  if (!lastUpdated) return null
  const ageSec = Math.max(0, Math.floor((now - lastUpdated) / 1000))
  const label =
    ageSec < 60
      ? `${ageSec}s ago`
      : ageSec < 3600
      ? `${Math.floor(ageSec / 60)}m ago`
      : `${Math.floor(ageSec / 3600)}h ago`
  const stale = ageSec > 90
  return (
    <span
      style={{
        fontSize: 11,
        color: stale ? '#92400e' : '#6b7280',
        background: stale ? '#fef3c7' : '#f3f4f6',
        padding: '4px 8px',
        borderRadius: 4,
      }}
      title={`Last refresh ${new Date(lastUpdated).toISOString()}`}
    >
      ● {label}
    </span>
  )
}

// SLA dot — rounded swatch coloured by computed risk band.
function SlaDot({
  arrivalSec,
  timeSlot,
  dateIso,
  size = 8,
}: {
  arrivalSec: number
  timeSlot: string | undefined | null
  dateIso: string
  size?: number
}) {
  const sla = computeSla(arrivalSec, timeSlot, dateIso)
  return (
    <span
      title={`${SLA_LABELS[sla.band]}${
        sla.slackMin != null
          ? sla.band === 'late'
            ? ` · ${Math.abs(sla.slackMin)}m past close`
            : sla.band === 'early'
            ? ` · waits ${Math.abs(sla.slackMin)}m for window`
            : ` · ${sla.slackMin}m before close`
          : ''
      }`}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: size / 2,
        background: SLA_COLORS[sla.band],
        verticalAlign: 'middle',
        boxShadow: '0 0 0 2px white',
      }}
    />
  )
}

function WeatherBanner({
  weather,
}: {
  weather: NonNullable<WeatherResponse>
}) {
  const palette =
    weather.status === 'block'
      ? { bg: '#fee', border: '#f99', fg: '#900', label: 'NO-GO' }
      : weather.status === 'warn'
      ? { bg: '#fff7e6', border: '#f6c062', fg: '#7a4a00', label: 'WATCH' }
      : { bg: '#ecfdf5', border: '#86efac', fg: '#15803d', label: 'OK' }

  const updated = (s: string | null) => {
    if (!s) return ''
    try {
      const d = new Date(s)
      const h = String(d.getUTCHours()).padStart(2, '0')
      const m = String(d.getUTCMinutes()).padStart(2, '0')
      return ` · ${h}:${m}`
    } catch {
      return ''
    }
  }

  return (
    <div
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 16,
        display: 'flex',
        gap: 24,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          background: palette.fg,
          color: 'white',
          fontSize: 11,
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 4,
          letterSpacing: 0.5,
        }}
      >
        {palette.label}
      </div>
      {weather.stations.map((s) => {
        const blocked =
          s.windMs != null && s.windMs >= weather.thresholds.block
        return (
          <div
            key={s.id}
            style={{ fontSize: 13, color: palette.fg, lineHeight: 1.4 }}
          >
            <strong>{s.name}</strong>{' '}
            wind{' '}
            <strong>{s.windMs?.toFixed(1) ?? '—'} m/s</strong>
            {s.gustMs != null && (
              <>
                {' '}· gust <strong>{s.gustMs.toFixed(1)} m/s</strong>
              </>
            )}
            {s.windDirection ? ` · ${s.windDirection}` : ''}
            {s.temperature != null ? ` · ${s.temperature}°C` : ''}
            {updated(s.updatedAt)}
            {blocked && (
              <span style={{ marginLeft: 8 }}>
                · over {weather.thresholds.block} m/s — Plan routes disabled
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function RouteMap({
  routes,
  orders,
  unassignedOrderIds,
  selectedOrderId,
  onSelectOrder,
}: {
  routes: Route[]
  // Every paid order — used to render neutral markers for stops that
  // aren't on any planned route yet.
  orders: Order[]
  // Orders VROOM couldn't fit (capacity / time-window infeasible) on the
  // most recent plan. Drawn pink so the dispatcher notices.
  unassignedOrderIds: Set<string>
  selectedOrderId: string | null
  onSelectOrder: (orderId: string | null) => void
}) {
  // Load the Google Maps JS SDK via the v2 hook. This guarantees `google`
  // is defined before we render any Marker icons that reference it —
  // the old <LoadScript> pattern still rendered children eagerly and
  // crashed on `google.maps.SymbolPath.CIRCLE` during the first paint.
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    // `geometry` exposes encoding.decodePath, which we use to render the
    // road-shaped polyline that VROOM returns from OSRM.
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  // Build the set of order record IDs that are already on a planned route.
  // Anything in `orders` but NOT in this set should be rendered as a
  // neutral grey marker (or pink if VROOM marked it unassigned).
  const plannedOrderIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of routes) {
      for (const s of r.steps) {
        if (s.type === 'pickup' && s.order?.recordId) {
          ids.add(s.order.recordId)
        }
      }
    }
    return ids
  }, [routes])

  const allPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = []
    for (const r of routes) {
      for (const s of r.steps) {
        pts.push({ lat: s.location[1], lng: s.location[0] })
      }
    }
    // Include geocoded orders not on any route so the map auto-zooms to
    // include unscheduled / unassigned pins too.
    for (const o of orders) {
      if (
        o.lat != null &&
        o.lng != null &&
        !plannedOrderIds.has(o.recordId)
      ) {
        pts.push({ lat: o.lat, lng: o.lng })
      }
    }
    return pts
  }, [routes, orders, plannedOrderIds])

  const mapRef = useRef<google.maps.Map | null>(null)
  // Which order's popup is open on the map (with its position).
  const [info, setInfo] = useState<
    { orderId: string; lat: number; lng: number } | null
  >(null)

  // Frame the map so every pickup shows comfortably, with padding. Called on
  // load and whenever the set of points changes; the user can still freely
  // pan/zoom afterwards (center prop is a stable ref, gestureHandling greedy).
  const fitAll = useCallback(
    (map: google.maps.Map) => {
      if (allPoints.length === 0) return
      if (allPoints.length === 1) {
        map.setCenter(allPoints[0])
        map.setZoom(13)
        return
      }
      const bounds = new google.maps.LatLngBounds()
      allPoints.forEach((p) => bounds.extend(p))
      map.fitBounds(bounds, 64)
    },
    [allPoints],
  )

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map
      fitAll(map)
    },
    [fitAll],
  )

  // Re-fit when the points change (new date/shift, plan results, etc.).
  useEffect(() => {
    if (mapRef.current) fitAll(mapRef.current)
  }, [fitAll])

  // Look up display info for the popup: prefer the planned pickup (has ETA +
  // driver), else fall back to the loaded order (time window only).
  const infoContent = useMemo(() => {
    if (!info) return null
    for (let ri = 0; ri < routes.length; ri++) {
      const r = routes[ri]
      const step = r.steps.find(
        (s) => s.type === 'pickup' && s.order?.recordId === info.orderId,
      )
      if (step && step.order) {
        return {
          order: step.order,
          etaSec: step.arrival,
          driver: r.driver?.name ?? null,
          color: ROUTE_COLORS[ri % ROUTE_COLORS.length],
        }
      }
    }
    const o = orders.find((x) => x.recordId === info.orderId)
    if (o)
      return { order: o, etaSec: null, driver: null, color: null }
    return null
  }, [info, routes, orders])

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div style={{ ...styles.warn, marginTop: 12 }}>
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set — map view disabled.
      </div>
    )
  }
  if (loadError) {
    return (
      <div style={{ ...styles.warn, marginTop: 12 }}>
        Google Maps failed to load: {String(loadError)}
      </div>
    )
  }
  if (!isLoaded) {
    return (
      <div style={{ ...styles.mapWrap, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        Loading map…
      </div>
    )
  }

  return (
    <div>
      <div style={styles.mapWrap}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={INITIAL_MAP_CENTER}
          zoom={11}
          onLoad={onLoad}
          onClick={() => setInfo(null)}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            // Free pan + scroll-zoom without holding Ctrl.
            gestureHandling: 'greedy',
            clickableIcons: false,
          }}
        >
            {routes.map((r, ri) => {
              const color = ROUTE_COLORS[ri % ROUTE_COLORS.length]
              // Prefer the road-shaped polyline VROOM returns from OSRM.
              // Fall back to the straight-line waypoint sequence if
              // geometry is missing (e.g. solver ran without g: true).
              const path = r.geometry
                ? google.maps.geometry.encoding
                    .decodePath(r.geometry)
                    .map((ll) => ({ lat: ll.lat(), lng: ll.lng() }))
                : r.steps.map((s) => ({
                    lat: s.location[1],
                    lng: s.location[0],
                  }))
              const pickups = r.steps.filter((s) => s.type === 'pickup')
              return (
                <div key={r.vehicle}>
                  <Polyline
                    path={path}
                    options={{
                      strokeColor: color,
                      strokeOpacity: 0.85,
                      strokeWeight: 3,
                    }}
                  />
                  {pickups.map((s, i) => {
                    const isSel =
                      !!s.order?.recordId &&
                      s.order.recordId === selectedOrderId
                    return (
                      <Marker
                        key={`${r.vehicle}-${i}`}
                        position={{
                          lat: s.location[1],
                          lng: s.location[0],
                        }}
                        label={{
                          text: String(i + 1),
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}
                        icon={{
                          path: google.maps.SymbolPath.CIRCLE,
                          fillColor: color,
                          fillOpacity: 1,
                          // Selected marker gets a thicker gold ring so it
                          // stands out without changing position/size jumps.
                          strokeColor: isSel ? '#facc15' : 'white',
                          strokeWeight: isSel ? 4 : 2,
                          scale: isSel ? 13 : 11,
                        }}
                        zIndex={isSel ? 100 : undefined}
                        onClick={() => {
                          if (!s.order?.recordId) return
                          setInfo({
                            orderId: s.order.recordId,
                            lat: s.location[1],
                            lng: s.location[0],
                          })
                          onSelectOrder(s.order.recordId)
                        }}
                      />
                    )
                  })}
                </div>
              )
            })}
            {/* Markers for orders not currently on any planned route.
                Pink for VROOM-rejected unassigned, grey for not-yet-planned
                (e.g. before "Plan routes" was clicked). */}
            {orders.map((o) => {
              if (
                o.lat == null ||
                o.lng == null ||
                plannedOrderIds.has(o.recordId)
              ) {
                return null
              }
              const isSel = o.recordId === selectedOrderId
              const isUnassigned = unassignedOrderIds.has(o.recordId)
              const fill = isUnassigned ? '#db2777' : '#9ca3af'
              return (
                <Marker
                  key={`extra-${o.recordId}`}
                  position={{ lat: o.lat, lng: o.lng }}
                  label={{
                    text: isUnassigned ? '!' : '·',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: '700',
                  }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: fill,
                    fillOpacity: 0.9,
                    strokeColor: isSel ? '#facc15' : 'white',
                    strokeWeight: isSel ? 4 : 2,
                    scale: isSel ? 12 : 9,
                  }}
                  zIndex={isSel ? 100 : isUnassigned ? 50 : undefined}
                  onClick={() => {
                    setInfo({ orderId: o.recordId, lat: o.lat!, lng: o.lng! })
                    onSelectOrder(o.recordId)
                  }}
                />
              )
            })}
            {/* BSÍ start/end and KEF drop markers */}
            {routes[0] && (
              <>
                <Marker
                  position={{
                    lat: routes[0].steps[0]?.location[1] ?? 64.1395,
                    lng: routes[0].steps[0]?.location[0] ?? -21.9408,
                  }}
                  label={{
                    text: 'BSÍ',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '700',
                  }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#111',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                    scale: 14,
                  }}
                />
                <Marker
                  position={{ lat: 63.9895, lng: -22.6046 }}
                  label={{
                    text: 'KEF',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '700',
                  }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#111',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                    scale: 14,
                  }}
                />
              </>
            )}

            {info && infoContent && (
              <InfoWindow
                position={{ lat: info.lat, lng: info.lng }}
                onCloseClick={() => setInfo(null)}
                options={{ pixelOffset: new google.maps.Size(0, -8) }}
              >
                <div style={{ minWidth: 180, fontFamily: FONT }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                    {infoContent.order.customer || '(no name)'}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                    {infoContent.order.pickupAddress}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                    {infoContent.order.bags} bag
                    {infoContent.order.bags === 1 ? '' : 's'}
                    {infoContent.order.timeSlot
                      ? ` · window ${infoContent.order.timeSlot}`
                      : ''}
                  </div>
                  {infoContent.etaSec != null ? (
                    <div
                      style={{
                        fontSize: 12,
                        marginTop: 6,
                        fontWeight: 600,
                        color: '#15803d',
                      }}
                    >
                      ✓ Scheduled {fmtClock(infoContent.etaSec)}
                      {infoContent.driver ? ` · ${infoContent.driver}` : ''}
                    </div>
                  ) : (
                    <div
                      style={{ fontSize: 12, marginTop: 6, color: '#92400e' }}
                    >
                      Not scheduled yet
                    </div>
                  )}
                  {infoContent.order.phone && (
                    <a
                      href={`tel:${infoContent.order.phone}`}
                      style={{ fontSize: 12, color: '#4f46e5' }}
                    >
                      📞 {infoContent.order.phone}
                    </a>
                  )}
                </div>
              </InfoWindow>
            )}
        </GoogleMap>
      </div>
      <div style={styles.legend}>
        {routes.map((r, ri) => (
          <span key={r.vehicle}>
            <span
              style={{
                ...styles.legendDot,
                background: ROUTE_COLORS[ri % ROUTE_COLORS.length],
              }}
            />
            {r.driver?.name || `Vehicle ${r.vehicle}`} · {pickupCount(r)} stops
          </span>
        ))}
      </div>
    </div>
  )
}

export default function DispatchPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [date, setDate] = useState<string>(todayIso())
  const [shift, setShift] = useState<Shift>('Evening')
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(
    new Set(),
  )
  // Which orders to include in the next plan run. Default: all. Unchecking
  // leaves an order out so you can plan a subset now and the rest later.
  const [plannedOrderIds, setPlannedOrderIds] = useState<Set<string>>(new Set())
  // Fleet + per-driver car assignment (driverRecordId → vehicle recordId).
  const [fleet, setFleet] = useState<{ own: VehicleOpt[]; rentals: VehicleOpt[] }>(
    { own: [], rentals: [] },
  )
  const [driverCar, setDriverCar] = useState<Record<string, string>>({})
  const [plan, setPlan] = useState<PlanResponse>(null)
  const [loading, setLoading] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [weather, setWeather] = useState<WeatherResponse>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [scheduleTime, setScheduleTime] = useState('15:00') // HH:MM, local-UTC
  const [scheduledFor, setScheduledFor] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, StopOverride>>({})
  // Which order row currently has its stop-duration open for inline editing.
  const [durEdit, setDurEdit] = useState<string | null>(null)
  // 2026 UI: command palette, help overlay, order search, freshness chip.
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [orderSearch, setOrderSearch] = useState('')
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  // Locked / manually-arranged routes. Keyed by driver record ID, the value
  // is the ordered list of order record IDs to keep on that vehicle. Both
  // the "Lock route" checkbox AND drag-drop edits write into this map; the
  // distinction between them is purely UI.
  const [lockedRoutes, setLockedRoutes] = useState<Record<string, string[]>>({})
  // Drag state — only set while a stop is mid-drag. Used to render hover
  // indicators on potential drop targets.
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null)

  useEffect(() => {
    const stored = cleanKey(window.localStorage.getItem('dispatch_admin_key'))
    if (stored) {
      // Re-persist the cleaned value so a previously-corrupted key self-heals.
      window.localStorage.setItem('dispatch_admin_key', stored)
      setAdminKey(stored)
    }
  }, [])

  const headers = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    const key = cleanKey(adminKey)
    if (key) h.Authorization = `Bearer ${key}`
    return h
  }, [adminKey])

  const loadAll = useCallback(async () => {
    if (!adminKey) return
    setLoading(true)
    setError(null)
    try {
      const [oRes, dRes, wRes, vRes] = await Promise.all([
        fetch(`/api/dispatch/orders?date=${date}&shift=${shift}`, { headers }),
        fetch(`/api/dispatch/drivers?date=${date}&shift=${shift}`, { headers }),
        fetch('/api/dispatch/weather', { headers }),
        fetch('/api/dispatch/vehicles', { headers }),
      ])
      if (oRes.status === 401 || dRes.status === 401) {
        window.localStorage.removeItem('dispatch_admin_key')
        setAdminKey(null)
        setError('Unauthorized — re-enter admin key')
        return
      }
      const oData = await oRes.json()
      const dData = await dRes.json()
      if (!oRes.ok) throw new Error(oData.message || 'Failed to load orders')
      if (!dRes.ok) throw new Error(dData.message || 'Failed to load drivers')
      // Weather is best-effort — if Vegagerðin's GraphQL is down we still
      // want orders/drivers visible. Just clear the wind card.
      if (wRes.ok) {
        setWeather(await wRes.json())
      } else {
        setWeather(null)
      }
      if (vRes.ok) {
        const vData = await vRes.json()
        setFleet({ own: vData.own || [], rentals: vData.rentals || [] })
      }
      const newOrders: Order[] = oData.orders || []
      setOrders(newOrders)
      // Default every loaded order to "planned" (included in the next run).
      setPlannedOrderIds(new Set(newOrders.map((o) => o.recordId)))
      const newDrivers: Driver[] = dData.drivers || []
      setDrivers(newDrivers)
      setLastUpdated(Date.now())
      // Default: select every driver that has a real linked record (skip
      // schedule rows where the driver column is empty — those are placeholders).
      setSelectedDriverIds(
        new Set(
          newDrivers
            .filter((d) => d.name && d.name !== 'Unassigned')
            .map((d) => d.recordId),
        ),
      )
      setPlan(null)
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [adminKey, date, shift, headers])

  useEffect(() => {
    if (adminKey) loadAll()
  }, [adminKey, date, shift, loadAll])

  // Tick the "Updated 23s ago" stamp once per second.
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Soft auto-refresh every 60s — only when idle, so we don't yank a plan
  // out from under the dispatcher mid-edit.
  useEffect(() => {
    if (!adminKey) return
    const t = setInterval(() => {
      if (!planning && !loading) loadAll()
    }, 60_000)
    return () => clearInterval(t)
  }, [adminKey, planning, loading, loadAll])

  // Geographic anomaly flag — orders whose distance from the centroid is
  // more than 3× the median. Catches address typos before dispatch.
  const anomalyOrderIds = useMemo<Set<string>>(() => {
    const geo = orders.filter((o) => o.lat != null && o.lng != null)
    if (geo.length < 3) return new Set()
    const cx = geo.reduce((s, o) => s + (o.lng as number), 0) / geo.length
    const cy = geo.reduce((s, o) => s + (o.lat as number), 0) / geo.length
    const dist = (o: Order) =>
      Math.hypot((o.lng as number) - cx, (o.lat as number) - cy)
    const dists = geo.map(dist).sort((a, b) => a - b)
    const median = dists[Math.floor(dists.length / 2)] || 0
    const out = new Set<string>()
    if (median === 0) return out
    for (const o of geo) if (dist(o) > median * 3) out.add(o.recordId)
    return out
  }, [orders])

  // Tomorrow shortcut target.
  const tomorrowIso = useMemo(() => {
    const d = new Date(date + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  }, [date])

  // Resolve the per-driver car assignment into {capacities, labels} for the
  // plan + save calls. capacities feed VROOM; labels are stored on the plan.
  function vehicleMaps() {
    const all = [...fleet.own, ...fleet.rentals]
    const capacities: Record<string, number> = {}
    const labels: Record<string, string> = {}
    for (const drvId of Object.keys(driverCar)) {
      const v = all.find((x) => x.recordId === driverCar[drvId])
      if (!v) continue
      if (v.suitcases) capacities[drvId] = v.suitcases
      labels[drvId] = `${v.name}${v.colour ? ` (${v.colour})` : ''}${
        v.kind === 'rental' && v.supplier ? ` — ${v.supplier} rental` : ''
      }`
    }
    return { capacities, labels }
  }

  async function planRoutes() {
    setPlanning(true)
    setError(null)
    try {
      const res = await fetch('/api/dispatch/plan-routes', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          date,
          shift,
          driverRecordIds: Array.from(selectedDriverIds),
          orderRecordIds: Array.from(plannedOrderIds),
          overrides,
          lockedRoutes,
          vehicleCapacities: vehicleMaps().capacities,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Plan failed')
      setPlan(data)
      setSaveState('idle') // a fresh plan is unsaved
      setScheduledFor(null)
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setPlanning(false)
    }
  }

  // Advisor action: widen every unassigned order's time window by ±30 min
  // (session override) and re-plan. Often enough to fit them.
  function relaxUnassignedAndReplan() {
    if (!plan) return
    const widened: Record<string, StopOverride> = { ...overrides }
    for (const u of plan.unassigned) {
      const o = u.order
      if (!o) continue
      const w = widenSlot(o.timeSlot, 30)
      if (w) widened[o.recordId] = { ...(widened[o.recordId] ?? {}), timeSlot: w }
    }
    setOverrides(widened)
    setTimeout(() => planRoutes(), 0)
  }

  // Advisor action: drop the unassigned orders from this run so the rest plan
  // cleanly; you can plan the dropped ones on a later run.
  function unplanUnassignedAndReplan() {
    if (!plan) return
    const drop = new Set(
      plan.unassigned.map((u) => u.order?.recordId).filter(Boolean) as string[],
    )
    setPlannedOrderIds((prev) => {
      const next = new Set(prev)
      drop.forEach((id) => next.delete(id))
      return next
    })
    setTimeout(() => planRoutes(), 0)
  }

  // Persist the on-screen plan (incl. locks/overrides) to Airtable so the
  // driver app can read it. This is the dispatcher's explicit "share" action.
  async function savePlanToAirtable() {
    if (!plan?.routes?.length) return
    setSaveState('saving')
    setError(null)
    try {
      const res = await fetch('/api/dispatch/save-plan', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          date,
          shift,
          routes: plan.routes,
          vehicles: vehicleMaps().labels,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Save failed')
      setSaveState('saved')
    } catch (e: any) {
      setError(e.message || String(e))
      setSaveState('idle')
    }
  }

  // Schedule the saved plan to auto-publish at scheduleTime (interpreted as
  // UTC — Iceland runs on UTC year-round). Pass cancel=true to clear it.
  async function scheduleSend(cancel = false) {
    if (!cancel && saveState !== 'saved') {
      setError('Save & share the plan first, then schedule its send.')
      return
    }
    let sendAt: string | null = null
    if (!cancel) {
      const [h, m] = scheduleTime.split(':').map(Number)
      const [yy, mm, dd] = date.split('-').map(Number)
      sendAt = new Date(Date.UTC(yy, mm - 1, dd, h || 0, m || 0)).toISOString()
    }
    try {
      const res = await fetch('/api/dispatch/schedule-send', {
        method: 'POST',
        headers,
        body: JSON.stringify({ date, shift, sendAt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Schedule failed')
      setScheduledFor(cancel ? null : sendAt)
    } catch (e: any) {
      setError(e.message || String(e))
    }
  }

  // Apply a partial override to one order. Empty values are stripped so the
  // override map only carries fields the dispatcher actually changed.
  function setOverride(orderId: string, patch: StopOverride) {
    setOverrides((prev) => {
      const merged = { ...(prev[orderId] ?? {}), ...patch }
      const cleaned: StopOverride = {}
      if (merged.timeSlot && merged.timeSlot.trim())
        cleaned.timeSlot = merged.timeSlot.trim()
      if (typeof merged.pickupDurationMin === 'number' &&
        !Number.isNaN(merged.pickupDurationMin))
        cleaned.pickupDurationMin = merged.pickupDurationMin
      if (typeof merged.deliveryDurationMin === 'number' &&
        !Number.isNaN(merged.deliveryDurationMin))
        cleaned.deliveryDurationMin = merged.deliveryDurationMin
      const next = { ...prev }
      if (Object.keys(cleaned).length === 0) {
        delete next[orderId]
      } else {
        next[orderId] = cleaned
      }
      return next
    })
  }

  function clearOverride(orderId: string) {
    setOverrides((prev) => {
      if (!prev[orderId]) return prev
      const next = { ...prev }
      delete next[orderId]
      return next
    })
  }

  // Reads the currently-rendered pickup sequence for a driver out of the
  // last plan. Used to seed the lockedRoutes entry when the dispatcher
  // ticks "Lock route" without first dragging anything around.
  function currentSequenceForDriver(driverId: string): string[] {
    if (!plan) return []
    const route = plan.routes.find((r) => r.driver?.recordId === driverId)
    if (!route) return []
    const ids: string[] = []
    for (const s of route.steps) {
      if (s.type === 'pickup' && s.order?.recordId) {
        ids.push(s.order.recordId)
      }
    }
    return ids
  }

  // Command palette entries — rebuilt each render (cheap at our scale).
  const paletteEntries = useMemo<PaletteEntry[]>(() => {
    const out: PaletteEntry[] = []
    out.push({
      id: 'plan',
      group: 'Actions',
      label: 'Plan routes',
      shortcut: 'P',
      onRun: () => planRoutes(),
    })
    out.push({
      id: 'reload',
      group: 'Actions',
      label: 'Reload orders, drivers and weather',
      shortcut: 'R',
      onRun: () => loadAll(),
    })
    if (Object.keys(lockedRoutes).length > 0) {
      out.push({
        id: 'reset-locks',
        group: 'Actions',
        label: `Reset all locks (${Object.keys(lockedRoutes).length})`,
        onRun: () => {
          setLockedRoutes({})
          setTimeout(() => planRoutes(), 0)
        },
      })
    }
    out.push({
      id: 'help',
      group: 'Actions',
      label: 'Show keyboard shortcuts',
      shortcut: '?',
      onRun: () => setHelpOpen(true),
    })
    out.push({
      id: 'today',
      group: 'Date',
      label: `Switch to today (${todayIso()})`,
      keywords: 'today now',
      onRun: () => setDate(todayIso()),
    })
    out.push({
      id: 'tomorrow',
      group: 'Date',
      label: `Switch to tomorrow (${tomorrowIso})`,
      shortcut: 'T',
      onRun: () => setDate(tomorrowIso),
    })
    for (const d of drivers) {
      const selected = selectedDriverIds.has(d.recordId)
      out.push({
        id: `driver-${d.recordId}`,
        group: 'Drivers',
        label: `${selected ? 'Hide' : 'Show'} ${d.name}`,
        hint: d.email || d.homeAddress || undefined,
        onRun: () => {
          setSelectedDriverIds((prev) => {
            const next = new Set(prev)
            if (next.has(d.recordId)) next.delete(d.recordId)
            else next.add(d.recordId)
            return next
          })
        },
      })
    }
    for (const o of orders) {
      out.push({
        id: `order-${o.recordId}`,
        group: 'Orders',
        label: `${o.customer || '(no name)'} — ${o.bags} bag${o.bags === 1 ? '' : 's'}`,
        hint: `${o.pickupAddress}${o.timeSlot ? ` · ${o.timeSlot}` : ''}${o.phone ? ` · ${o.phone}` : ''}`,
        keywords: `${o.phone} ${o.orderNo} ${o.orderId} ${o.municipality} ${o.orderStatus}`,
        onRun: () => setSelectedOrderId(o.recordId),
      })
    }
    return out
  }, [orders, drivers, selectedDriverIds, lockedRoutes, tomorrowIso])

  // Global keyboard shortcuts. Skip when typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const isField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if (e.key === 'Escape') {
        if (paletteOpen) return setPaletteOpen(false)
        if (helpOpen) return setHelpOpen(false)
        if (selectedOrderId) return setSelectedOrderId(null)
      }
      if (isField) return
      if (e.key === '?') {
        e.preventDefault()
        setHelpOpen(true)
      } else if (e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key.toLowerCase() === 'p') {
        if (
          plannedOrderIds.size > 0 &&
          selectedDriverIds.size > 0 &&
          weather?.status !== 'block'
        ) {
          e.preventDefault()
          planRoutes()
        }
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        loadAll()
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault()
        setDate(tomorrowIso)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    paletteOpen,
    helpOpen,
    selectedOrderId,
    plannedOrderIds.size,
    selectedDriverIds.size,
    weather?.status,
    tomorrowIso,
    loadAll,
  ])

  function toggleLockDriver(driverId: string) {
    setLockedRoutes((prev) => {
      const next = { ...prev }
      if (next[driverId]) {
        delete next[driverId]
      } else {
        next[driverId] = currentSequenceForDriver(driverId)
      }
      return next
    })
  }

  // The dispatcher dropped `draggedOrderId` onto `targetDriverId` at index
  // `targetIndex` (0 = before first pickup, 1 = after first, etc.). Update
  // lockedRoutes for both the source and target drivers so the next plan
  // call respects the new arrangement, then trigger a replan.
  function handleDrop(
    draggedId: string,
    targetDriverId: string,
    targetIndex: number,
  ) {
    if (!plan) return
    // Find which driver currently owns the dragged stop.
    let sourceDriverId: string | null = null
    for (const r of plan.routes) {
      if (
        r.driver?.recordId &&
        r.steps.some(
          (s) => s.type === 'pickup' && s.order?.recordId === draggedId,
        )
      ) {
        sourceDriverId = r.driver.recordId
        break
      }
    }
    if (!sourceDriverId) return

    setLockedRoutes((prev) => {
      const next = { ...prev }
      // Effective sequence = lockedRoutes entry if present, else fall back
      // to the displayed pickup order. We mirror that into next so both
      // source and target end up locked.
      const sourceSeq =
        next[sourceDriverId!]?.slice() ??
        currentSequenceForDriver(sourceDriverId!)
      const targetSeq =
        sourceDriverId === targetDriverId
          ? sourceSeq
          : (next[targetDriverId]?.slice() ??
            currentSequenceForDriver(targetDriverId))

      // Remove from source
      const fromIdx = sourceSeq.indexOf(draggedId)
      if (fromIdx >= 0) sourceSeq.splice(fromIdx, 1)

      // Adjust target index if we removed an earlier item from the same list
      let insertAt = targetIndex
      if (
        sourceDriverId === targetDriverId &&
        fromIdx >= 0 &&
        fromIdx < targetIndex
      ) {
        insertAt -= 1
      }
      // Splice into target
      const finalTargetSeq =
        sourceDriverId === targetDriverId ? sourceSeq : targetSeq
      finalTargetSeq.splice(insertAt, 0, draggedId)

      next[sourceDriverId!] = sourceSeq
      next[targetDriverId] = finalTargetSeq
      // If a driver ends up with no stops, drop their entry — VROOM
      // doesn't need a "this driver has nothing" hint, the solver
      // figures that out on its own.
      if (next[sourceDriverId!].length === 0) {
        delete next[sourceDriverId!]
      }
      return next
    })
    setDraggedOrderId(null)
    // Auto-replan so the dispatcher sees the new ETAs immediately —
    // matches OptimoRoute's drag-then-recompute behaviour.
    setTimeout(() => planRoutes(), 0)
  }

  // The currently-selected order, looked up across the loaded order set.
  const selectedOrder = useMemo<Order | null>(() => {
    if (!selectedOrderId) return null
    return orders.find((o) => o.recordId === selectedOrderId) ?? null
  }, [selectedOrderId, orders])

  // Find which route the selected order is on (and its pickup step) so the
  // detail panel can show ETA without scanning every render.
  const selectedRouteContext = useMemo(() => {
    if (!plan || !selectedOrderId) return null
    for (const r of plan.routes) {
      const pickup = r.steps.find(
        (s) => s.type === 'pickup' && s.order?.recordId === selectedOrderId,
      )
      const delivery = r.steps.find(
        (s) => s.type === 'delivery' && s.order?.recordId === selectedOrderId,
      )
      if (pickup) return { route: r, pickup, delivery: delivery ?? null }
    }
    return null
  }, [plan, selectedOrderId])

  function saveKey() {
    const clean = cleanKey(keyInput)
    if (!clean) return
    window.localStorage.setItem('dispatch_admin_key', clean)
    setAdminKey(clean)
  }

  if (!adminKey) {
    return (
      <div
        style={{
          ...styles.page,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Head>
          <title>Dispatch · Admin</title>
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
            rel="stylesheet"
          />
        </Head>
        <div
          style={{
            ...styles.card,
            width: 360,
            maxWidth: '90vw',
            boxShadow: C.shadowMd,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={styles.brandMark}>B</div>
            <h1 style={styles.h1}>BagBee Dispatch</h1>
          </div>
          <p style={styles.sub}>Enter the admin key to continue.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Admin key"
              style={{ ...styles.input, flex: 1 }}
              onKeyDown={(e) => e.key === 'Enter' && saveKey()}
            />
            <button style={styles.primary} onClick={saveKey}>
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  const totalBags = orders.reduce((s, o) => s + (Number(o.bags) || 0), 0)
  const plannedBags = orders.reduce(
    (s, o) => s + (plannedOrderIds.has(o.recordId) ? Number(o.bags) || 0 : 0),
    0,
  )
  // Orders that ended up on a planned route — these get the green "scheduled"
  // treatment in the Orders list (with their ETA + driver). Plain const (not
  // useMemo) because this runs after the early `if (!adminKey) return`.
  const scheduledInfo = (() => {
    const m = new Map<string, { etaSec: number; driver: string | null }>()
    if (plan)
      for (const r of plan.routes)
        for (const s of r.steps)
          if (s.type === 'pickup' && s.order?.recordId)
            m.set(s.order.recordId, {
              etaSec: s.arrival,
              driver: r.driver?.name ?? null,
            })
    return m
  })()

  return (
    <div style={styles.page}>
      <Head>
        <title>Dispatch · {date} {shift}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* Sticky app bar */}
      <header style={styles.appBar}>
        <div style={styles.brandMark}>B</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>
            BagBee Dispatch
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            VROOM route planner
          </div>
        </div>
        <span
          style={{
            ...styles.badge,
            background: C.accentSoft,
            color: C.accent,
            marginLeft: 4,
          }}
        >
          Preview
        </span>
        <div style={{ flex: 1 }} />
        <FreshnessChip lastUpdated={lastUpdated} now={nowTick} />
        <button
          style={{ ...styles.secondary, padding: '6px 10px' }}
          onClick={() => setPaletteOpen(true)}
          title="Command palette (⌘K)"
        >
          ⌘K
        </button>
        <button
          style={{ ...styles.secondary, padding: '6px 10px' }}
          onClick={() => setHelpOpen(true)}
          title="Keyboard shortcuts (?)"
        >
          ?
        </button>
        <button
          style={{ ...styles.secondary, padding: '6px 10px' }}
          onClick={() => {
            window.localStorage.removeItem('dispatch_admin_key')
            setAdminKey(null)
          }}
        >
          Sign out
        </button>
      </header>

      <main
        style={{
          ...styles.shell,
          paddingRight: selectedOrder ? 420 : undefined,
          transition: 'padding-right 0.15s ease',
        }}
      >
        <div style={styles.controls}>
        <label style={{ fontSize: 13, color: '#666' }}>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={styles.input}
        />
        {date !== todayIso() && (
          <button
            style={{ ...styles.secondary, fontSize: 11, padding: '4px 8px' }}
            onClick={() => setDate(todayIso())}
            title="Jump to today"
          >
            Today
          </button>
        )}
        <button
          style={{ ...styles.secondary, fontSize: 11, padding: '4px 8px' }}
          onClick={() => setDate(tomorrowIso)}
          title="Jump to tomorrow (T)"
        >
          Tomorrow →
        </button>
        <label style={{ fontSize: 13, color: '#666' }}>Shift</label>
        <select
          value={shift}
          onChange={(e) => setShift(e.target.value as Shift)}
          style={styles.input}
        >
          {SHIFTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button style={styles.secondary} onClick={loadAll} disabled={loading}>
          {loading ? 'Loading…' : 'Reload'}
        </button>
        <div style={{ flex: 1 }} />
        <button
          style={{
            ...styles.primary,
            opacity:
              planning ||
              plannedOrderIds.size === 0 ||
              selectedDriverIds.size === 0 ||
              weather?.status === 'block'
                ? 0.45
                : 1,
          }}
          onClick={planRoutes}
          disabled={
            planning ||
            plannedOrderIds.size === 0 ||
            selectedDriverIds.size === 0 ||
            weather?.status === 'block'
          }
          title={
            weather?.status === 'block'
              ? `Wind on ${weather.stations[0]?.name ?? 'route'} is ${weather.maxWind} m/s — over the ${weather.thresholds.block} m/s safety limit`
              : undefined
          }
        >
          {planning ? 'Planning…' : '⚡ Plan routes'}
        </button>
      </div>

      {error && <div style={styles.err}>{error}</div>}

      {weather && weather.stations.length > 0 && (
        <WeatherBanner weather={weather} />
      )}

      <div style={styles.stats}>
        <div style={styles.statBlock}>
          <div style={styles.statValue}>{orders.length}</div>
          <div style={styles.statLabel}>Orders</div>
        </div>
        <div style={styles.statBlock}>
          <div style={styles.statValue}>{totalBags}</div>
          <div style={styles.statLabel}>Bags</div>
        </div>
        <div style={styles.statBlock}>
          <div style={styles.statValue}>
            {selectedDriverIds.size}
            <span style={{ fontSize: 14, color: '#666', fontWeight: 400 }}>
              {' '}
              / {drivers.length}
            </span>
          </div>
          <div style={styles.statLabel}>Drivers selected</div>
        </div>
        <div style={styles.statBlock}>
          <div style={styles.statValue}>{plan?.routes?.length ?? 0}</div>
          <div style={styles.statLabel}>Routes planned</div>
        </div>
        {orders.length > 0 && (
          <div style={styles.statBlock}>
            <div style={styles.statValue}>
              {Math.max(1, Math.ceil(orders.length / 8))}
            </div>
            <div style={styles.statLabel}>Suggested drivers</div>
          </div>
        )}
        {plan?.unassigned && plan.unassigned.length > 0 && (
          <div style={styles.statBlock}>
            <div style={{ ...styles.statValue, color: '#b45309' }}>
              {plan.unassigned.length}
            </div>
            <div style={styles.statLabel}>Unassigned</div>
          </div>
        )}
      </div>

      {/* Map renders as soon as orders are loaded — pre-plan it shows
          neutral markers for every paid pickup, post-plan it overlays
          numbered route markers + pink unassigned markers. */}
      {orders.some((o) => o.lat != null && o.lng != null) && (
        <RouteMap
          routes={plan?.routes ?? []}
          orders={orders}
          unassignedOrderIds={
            new Set(
              (plan?.unassigned ?? [])
                .map((u) => u.order?.recordId)
                .filter((id): id is string => !!id),
            )
          }
          selectedOrderId={selectedOrderId}
          onSelectOrder={setSelectedOrderId}
        />
      )}

      <div style={styles.grid}>
        <section style={styles.card}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            <h2 style={styles.cardTitle}>
              Orders · {plannedOrderIds.size}/{orders.length} planned ·{' '}
              {plannedBags} bags
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {orders.length > 0 && (
                <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setPlannedOrderIds(new Set(orders.map((o) => o.recordId)))
                    }}
                  >
                    All
                  </a>
                  <span style={{ color: C.faint }}>·</span>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setPlannedOrderIds(new Set())
                    }}
                  >
                    None
                  </a>
                </div>
              )}
              <input
                ref={searchInputRef}
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search (/)"
                style={{ ...styles.input, fontSize: 12, padding: '4px 8px', width: 120 }}
              />
            </div>
          </div>
          {orders.length === 0 ? (
            <p style={{ ...styles.sub, marginTop: 12 }}>
              No paid orders for this date + shift.
            </p>
          ) : (
            <ul style={styles.list}>
              {orders
                .filter((o) => {
                  const q = orderSearch.trim().toLowerCase()
                  if (!q) return true
                  return (
                    o.customer.toLowerCase().includes(q) ||
                    o.pickupAddress.toLowerCase().includes(q) ||
                    o.phone.toLowerCase().includes(q) ||
                    String(o.orderId).includes(q) ||
                    o.orderNo.toLowerCase().includes(q)
                  )
                })
                .map((o) => {
                const sel = selectedOrderId === o.recordId
                const overridden = !!overrides[o.recordId]
                const anomaly = anomalyOrderIds.has(o.recordId)
                const planned = plannedOrderIds.has(o.recordId)
                const sched = scheduledInfo.get(o.recordId)
                const eff = overrides[o.recordId]
                const pickDur =
                  eff?.pickupDurationMin ?? o.pickupDurationMin
                return (
                  <li
                    key={o.recordId}
                    style={{
                      ...styles.li,
                      cursor: 'pointer',
                      borderLeft: sel
                        ? '3px solid #facc15'
                        : sched
                        ? '3px solid #16a34a'
                        : '3px solid transparent',
                      paddingLeft: 6,
                      background: sel
                        ? '#fffbeb'
                        : sched
                        ? '#f0fdf4'
                        : undefined,
                      opacity: planned ? 1 : 0.45,
                      alignItems: 'center',
                    }}
                    onClick={() => setSelectedOrderId(sel ? null : o.recordId)}
                  >
                    <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={planned}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() =>
                          setPlannedOrderIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(o.recordId)) next.delete(o.recordId)
                            else next.add(o.recordId)
                            return next
                          })
                        }
                        title={planned ? 'Included in plan' : 'Left unplanned'}
                        style={{ cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {o.customer || '(no name)'}{' '}
                          <span style={styles.badge}>
                            {o.bags} bag{o.bags === 1 ? '' : 's'}
                          </span>
                          {sched && (
                            <span
                              style={{
                                ...styles.badge,
                                background: '#dcfce7',
                                color: '#15803d',
                                marginLeft: 4,
                                fontWeight: 700,
                              }}
                              title={`Scheduled ${fmtClock(sched.etaSec)}${
                                sched.driver ? ` · ${sched.driver}` : ''
                              }`}
                            >
                              ✓ {fmtClock(sched.etaSec)}
                              {sched.driver ? ` · ${sched.driver}` : ''}
                            </span>
                          )}
                          {overridden && (
                            <span
                              style={{
                                ...styles.badge,
                                background: '#fef3c7',
                                color: '#92400e',
                                marginLeft: 4,
                              }}
                            >
                              edited
                            </span>
                          )}
                          {anomaly && (
                            <span
                              style={{
                                ...styles.badge,
                                background: '#fef3c7',
                                color: '#92400e',
                                marginLeft: 4,
                              }}
                              title="Geographic outlier — verify the address before dispatch"
                            >
                              ⚠ outlier
                            </span>
                          )}
                        </div>
                        <div style={{ color: C.muted, fontSize: 12 }}>
                          {o.pickupAddress}
                          {o.municipality ? ` · ${o.municipality}` : ''}
                          {o.timeSlot ? ` · ${o.timeSlot}` : ''}
                          {' · '}
                          {durEdit === o.recordId ? (
                            <input
                              type="number"
                              min={1}
                              autoFocus
                              defaultValue={pickDur ?? ''}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Enter') {
                                  ;(e.target as HTMLInputElement).blur()
                                } else if (e.key === 'Escape') {
                                  setDurEdit(null)
                                }
                              }}
                              onBlur={(e) => {
                                const raw = e.target.value.trim()
                                const n =
                                  raw === ''
                                    ? undefined
                                    : Math.max(1, parseInt(raw, 10))
                                setOverrides((prev) => {
                                  const cur = { ...(prev[o.recordId] ?? {}) }
                                  if (n == null || Number.isNaN(n))
                                    delete cur.pickupDurationMin
                                  else cur.pickupDurationMin = n
                                  const next = { ...prev }
                                  if (Object.keys(cur).length === 0)
                                    delete next[o.recordId]
                                  else next[o.recordId] = cur
                                  return next
                                })
                                setDurEdit(null)
                              }}
                              style={{
                                width: 48,
                                fontSize: 12,
                                padding: '0 4px',
                                border: `1px solid ${C.border}`,
                                borderRadius: 4,
                              }}
                            />
                          ) : (
                            <span
                              onClick={(e) => {
                                e.stopPropagation()
                                setDurEdit(o.recordId)
                              }}
                              title="Click to edit stop duration (minutes)"
                              style={{
                                cursor: 'text',
                                textDecoration: 'underline dotted',
                                textUnderlineOffset: 2,
                              }}
                            >
                              ⏱ {pickDur != null ? `${pickDur} min` : 'set min'} ✎
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ color: C.muted, fontSize: 12, textAlign: 'right' }}>
                      {o.orderNo || `#${o.orderId}`}
                      <div>{o.orderStatus}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section style={styles.card}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <h2 style={styles.cardTitle}>
              Drivers · {selectedDriverIds.size} of {drivers.length} selected
            </h2>
            {drivers.length > 1 && (
              <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setSelectedDriverIds(
                      new Set(
                        drivers
                          .filter((d) => d.name !== 'Unassigned')
                          .map((d) => d.recordId),
                      ),
                    )
                  }}
                >
                  Select all
                </a>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setSelectedDriverIds(new Set())
                  }}
                >
                  Select none
                </a>
              </div>
            )}
          </div>
          {drivers.length === 0 ? (
            <p style={{ ...styles.sub, marginTop: 12 }}>
              No driver scheduled. Add a Vaktaskipulag row for this date + shift.
            </p>
          ) : (
            <ul style={styles.list}>
              {drivers.map((d) => {
                const checked = selectedDriverIds.has(d.recordId)
                const unassigned = d.name === 'Unassigned'
                return (
                  <li
                    key={d.recordId}
                    style={{
                      ...styles.li,
                      opacity: unassigned ? 0.5 : 1,
                      cursor: unassigned ? 'not-allowed' : 'pointer',
                    }}
                    onClick={() => {
                      if (unassigned) return
                      setSelectedDriverIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(d.recordId)) next.delete(d.recordId)
                        else next.add(d.recordId)
                        return next
                      })
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={unassigned}
                        readOnly
                        style={{ cursor: 'inherit' }}
                      />
                      <div>
                        <div style={{ fontWeight: 500 }}>{d.name}</div>
                        <div style={{ color: '#666', fontSize: 12 }}>
                          {d.email || '(no email)'}
                          {d.homeAddress ? ` · ${d.homeAddress}` : ''}
                        </div>
                      </div>
                    </div>
                    {!unassigned && (
                      <select
                        value={driverCar[d.recordId] ?? ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation()
                          const v = e.target.value
                          setDriverCar((prev) => {
                            const next = { ...prev }
                            if (v) next[d.recordId] = v
                            else delete next[d.recordId]
                            return next
                          })
                        }}
                        style={{
                          ...styles.input,
                          fontSize: 12,
                          padding: '4px 6px',
                          maxWidth: 180,
                        }}
                        title="Assign a van — its capacity feeds the planner"
                      >
                        <option value="">— assign car —</option>
                        {fleet.own.length > 0 && (
                          <optgroup label="Own fleet">
                            {fleet.own.map((v) => (
                              <option key={v.recordId} value={v.recordId}>
                                {v.name}
                                {v.colour ? ` · ${v.colour}` : ''}
                                {v.suitcases ? ` · ${v.suitcases} bags` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {fleet.rentals.length > 0 && (
                          <optgroup label="Rental">
                            {[...fleet.rentals]
                              .sort(
                                (a, b) =>
                                  Number(b.recommended) - Number(a.recommended),
                              )
                              .map((v) => (
                                <option key={v.recordId} value={v.recordId}>
                                  {v.recommended ? '★ ' : ''}
                                  {v.supplier ? `${v.supplier}: ` : ''}
                                  {v.name}
                                  {v.suitcases ? ` · ${v.suitcases} bags` : ''}
                                </option>
                              ))}
                          </optgroup>
                        )}
                      </select>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {plan && plan.summary && (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 16,
            }}
          >
            <h2 style={{ ...styles.h1, fontSize: 18 }}>Planned routes</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {Object.keys(lockedRoutes).length > 0 && (
                <button
                  style={styles.secondary}
                  onClick={() => {
                    setLockedRoutes({})
                    setTimeout(() => planRoutes(), 0)
                  }}
                  title="Discard all manual edits and let VROOM re-optimise from scratch"
                >
                  Reset locks ({Object.keys(lockedRoutes).length})
                </button>
              )}
              <button
                style={{
                  ...styles.primary,
                  background: saveState === 'saved' ? '#16a34a' : C.ink,
                }}
                onClick={savePlanToAirtable}
                disabled={saveState === 'saving'}
                title="Save this plan to Airtable and make it visible to the driver app"
              >
                {saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'saved'
                  ? '✓ Shared with drivers'
                  : 'Save & share plan'}
              </button>

              {/* Scheduled send */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  paddingLeft: 8,
                  marginLeft: 4,
                  borderLeft: `1px solid ${C.border}`,
                }}
              >
                {scheduledFor ? (
                  <>
                    <span
                      style={{
                        ...styles.badge,
                        background: C.accentSoft,
                        color: C.accent,
                      }}
                      title={`Auto-sends at ${scheduledFor}`}
                    >
                      ⏱ Sends {fmtClock(Math.floor(Date.parse(scheduledFor) / 1000))}
                    </span>
                    <button
                      style={{ ...styles.secondary, padding: '6px 10px' }}
                      onClick={() => scheduleSend(true)}
                      title="Cancel the scheduled send"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      style={{ ...styles.input, padding: '6px 8px' }}
                      title="Time (UTC) to auto-send routes to drivers"
                    />
                    <button
                      style={styles.secondary}
                      onClick={() => scheduleSend(false)}
                      disabled={saveState !== 'saved'}
                      title={
                        saveState !== 'saved'
                          ? 'Save & share first'
                          : 'Auto-send the routes at this time'
                      }
                    >
                      Schedule send
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <p style={styles.sub}>
            {plan.summary.routes} route{plan.summary.routes === 1 ? '' : 's'} ·{' '}
            total drive {fmtDuration(plan.summary.duration)} ·{' '}
            {plan.summary.distance != null
              ? `${(plan.summary.distance / 1000).toFixed(1)} km · `
              : ''}
            {plan.summary.unassigned} unassigned
          </p>
          <p
            style={{
              ...styles.sub,
              fontSize: 12,
              marginTop: -4,
              color: '#666',
            }}
          >
            Drag stops to reorder or reassign drivers — VROOM treats your
            order as a strong hint. To <em>force</em> a sequence, narrow the
            stop's time window in the side panel.
          </p>

          {plan.ungeocoded.length > 0 && (
            <div style={styles.warn}>
              {plan.ungeocoded.length} order
              {plan.ungeocoded.length === 1 ? '' : 's'} could not be geocoded
              and were excluded:{' '}
              {plan.ungeocoded
                .map((u) => `${u.customer} (${u.address})`)
                .join('; ')}
            </div>
          )}

          {plan.unassigned.length > 0 && (
            <div style={{ ...styles.warn, padding: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {plan.unassigned.length} order
                {plan.unassigned.length === 1 ? '' : 's'} couldn’t fit the shift
              </div>
              <div style={{ fontSize: 12, marginBottom: 10 }}>
                {Array.from(
                  new Set(
                    plan.unassigned.map(
                      (u) => u.order?.customer || `shipment ${u.shipmentId}`,
                    ),
                  ),
                ).join(', ')}{' '}
                — likely the time windows are too tight or the route is full.
                Try one of these:
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginBottom: 10,
                }}
              >
                <button
                  style={styles.secondary}
                  onClick={relaxUnassignedAndReplan}
                  title="Widen each unfit order's pickup window by 30 min and re-plan"
                >
                  ↔ Relax windows ±30 min &amp; re-plan
                </button>
                <button
                  style={styles.secondary}
                  onClick={unplanUnassignedAndReplan}
                  title="Drop these from this run so the rest plan cleanly; plan them later"
                >
                  Plan these later (drop for now)
                </button>
                {drivers.filter(
                  (d) =>
                    d.name !== 'Unassigned' &&
                    !selectedDriverIds.has(d.recordId),
                ).length > 0 && (
                  <button
                    style={styles.secondary}
                    onClick={() => {
                      setSelectedDriverIds(
                        new Set(
                          drivers
                            .filter((d) => d.name !== 'Unassigned')
                            .map((d) => d.recordId),
                        ),
                      )
                      setTimeout(() => planRoutes(), 0)
                    }}
                    title="Add every scheduled driver and re-plan"
                  >
                    + Add all drivers &amp; re-plan
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12 }}>
                Or call the customer to move a pickup:{' '}
                {plan.unassigned
                  .filter((u) => u.order?.phone)
                  .map((u, i) => (
                    <a
                      key={i}
                      href={`tel:${u.order!.phone}`}
                      style={{ marginRight: 12, color: C.accent }}
                    >
                      📞 {u.order!.customer} ({u.order!.timeSlot || 'no window'})
                    </a>
                  ))}
              </div>
            </div>
          )}

          {plan.routes.map((r) => {
            const stops = r.steps.filter((s) => s.type === 'pickup')
            const driverBags = stops.reduce(
              (sum, s) => sum + (s.order?.bags ?? 0),
              0,
            )
            const driverId = r.driver?.recordId ?? null
            const locked = driverId ? !!lockedRoutes[driverId] : false
            return (
              <div
                key={r.vehicle}
                style={{
                  ...styles.routeBlock,
                  borderColor: locked ? '#facc15' : styles.routeBlock.border?.toString() || '#e5e5e7',
                  borderLeft: locked ? '4px solid #facc15' : undefined,
                }}
              >
                <div style={styles.routeHeader}>
                  <div>
                    <div style={styles.routeName}>
                      {r.driver?.name || `Vehicle ${r.vehicle}`}
                      {locked && (
                        <span
                          style={{
                            ...styles.badge,
                            marginLeft: 8,
                            background: '#fef3c7',
                            color: '#92400e',
                          }}
                        >
                          locked
                        </span>
                      )}
                    </div>
                    <div style={styles.routeMeta}>
                      {stops.length} pickups · <strong>{driverBags} bags</strong>{' '}
                      · drive{' '}
                      {fmtDuration(r.duration - r.service - r.waiting_time)} ·
                      service {fmtDuration(r.service)} ·{' '}
                      {r.distance != null
                        ? `${(r.distance / 1000).toFixed(1)} km`
                        : '—'}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <label
                      style={{
                        fontSize: 12,
                        color: '#666',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: driverId ? 'pointer' : 'not-allowed',
                      }}
                      title="Lock this driver's route — re-optimisation only touches the others"
                    >
                      <input
                        type="checkbox"
                        checked={locked}
                        disabled={!driverId}
                        onChange={() => driverId && toggleLockDriver(driverId)}
                      />
                      Lock route
                    </label>
                    <div style={styles.routeMeta}>
                      {fmtClock(r.steps[0]?.arrival ?? 0)} →{' '}
                      {fmtClock(r.steps[r.steps.length - 1]?.arrival ?? 0)}
                    </div>
                  </div>
                </div>

                <WorkloadBar
                  driveSec={r.duration - r.service - r.waiting_time}
                  serviceSec={r.service}
                  waitingSec={r.waiting_time}
                  distanceM={r.distance}
                  color={
                    ROUTE_COLORS[plan.routes.indexOf(r) % ROUTE_COLORS.length]
                  }
                />

                {/* Per-stop name-list intentionally hidden — the timeline
                    below + the green marks in the Orders list carry this now.
                    Kept disabled rather than deleted for easy revert. */}
                {SHOW_ROUTE_STOP_LIST && (() => {
                  let pickupIdx = 0
                  return r.steps.map((s, i) => {
                    if (s.type === 'start' || s.type === 'end') {
                      return (
                        <div key={i} style={styles.step}>
                          <div style={{ color: '#666', fontSize: 12 }}>
                            {fmtClock(s.arrival)}
                          </div>
                          <div
                            style={{
                              ...styles.stepNum,
                              background: '#666',
                            }}
                          >
                            {s.type === 'start' ? 'S' : 'E'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>
                              {s.type === 'start'
                                ? 'Depart BSÍ'
                                : 'Return to BSÍ'}
                            </div>
                          </div>
                          <div></div>
                        </div>
                      )
                    }
                    if (s.type === 'pickup') {
                      pickupIdx += 1
                      const pickupOrderId = s.order?.recordId ?? null
                      const sel = pickupOrderId === selectedOrderId
                      const overridden =
                        pickupOrderId != null && !!overrides[pickupOrderId]
                      const dragging =
                        pickupOrderId != null &&
                        pickupOrderId === draggedOrderId
                      const stopPickupIdx = pickupIdx - 1 // 0-based for drop position
                      return (
                        <div
                          key={i}
                          draggable={!!pickupOrderId}
                          onDragStart={(e) => {
                            if (!pickupOrderId) return
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('text/plain', pickupOrderId)
                            setDraggedOrderId(pickupOrderId)
                          }}
                          onDragEnd={() => setDraggedOrderId(null)}
                          // Allow dropping a dragged stop directly onto
                          // another pickup row — the dropped stop slides in
                          // *before* this one. preventDefault unconditionally
                          // because dragover only fires during an active drag.
                          onDragOver={(e) => {
                            if (!driverId) return
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'move'
                          }}
                          onDrop={(e) => {
                            if (!driverId) return
                            const dragged =
                              e.dataTransfer.getData('text/plain') ||
                              draggedOrderId
                            if (!dragged) return
                            e.preventDefault()
                            handleDrop(dragged, driverId, stopPickupIdx)
                          }}
                          style={{
                            ...styles.step,
                            cursor: pickupOrderId
                              ? draggedOrderId
                                ? 'grabbing'
                                : 'grab'
                              : 'default',
                            background: sel ? '#fffbeb' : undefined,
                            borderLeft: sel
                              ? '3px solid #facc15'
                              : '3px solid transparent',
                            paddingLeft: 6,
                            opacity: dragging ? 0.4 : 1,
                          }}
                          onClick={() =>
                            pickupOrderId &&
                            !draggedOrderId &&
                            setSelectedOrderId(sel ? null : pickupOrderId)
                          }
                        >
                          <div style={{ color: '#666', fontSize: 12 }}>
                            {fmtClock(s.arrival)}
                          </div>
                          <div style={styles.stepNum}>{pickupIdx}</div>
                          <div>
                            <div
                              style={{
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                flexWrap: 'wrap',
                              }}
                            >
                              <SlaDot
                                arrivalSec={s.arrival}
                                timeSlot={s.order?.timeSlot}
                                dateIso={date}
                              />
                              {s.order?.customer || `Shipment ${s.id}`}{' '}
                              <span style={styles.badge}>
                                {s.order?.bags ?? '?'} bag
                                {s.order?.bags === 1 ? '' : 's'}
                              </span>
                              {overridden && (
                                <span
                                  style={{
                                    ...styles.badge,
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    marginLeft: 4,
                                  }}
                                >
                                  edited
                                </span>
                              )}
                            </div>
                            <div style={{ color: '#666', fontSize: 12 }}>
                              {s.order?.pickupAddress}
                              {s.order?.timeSlot
                                ? ` · ${s.order.timeSlot}`
                                : ''}
                              {s.order?.phone ? ` · ${s.order.phone}` : ''}
                            </div>
                          </div>
                          <div style={{ color: '#666', fontSize: 12 }}>
                            {s.waiting_time > 0
                              ? `wait ${fmtDuration(s.waiting_time)}`
                              : ''}
                          </div>
                        </div>
                      )
                    }
                    if (s.type === 'delivery') {
                      // Collapse runs of consecutive KEF deliveries into one
                      // visual step to keep the timeline readable.
                      const prev = r.steps[i - 1]
                      if (prev && prev.type === 'delivery') return null
                      let last = i
                      while (
                        last + 1 < r.steps.length &&
                        r.steps[last + 1].type === 'delivery'
                      ) {
                        last += 1
                      }
                      const run = r.steps.slice(i, last + 1)
                      const totalBags = run.reduce(
                        (sum, x) => sum + (x.order?.bags ?? 0),
                        0,
                      )
                      return (
                        <div key={i} style={styles.step}>
                          <div style={{ color: '#666', fontSize: 12 }}>
                            {fmtClock(s.arrival)}
                          </div>
                          <div
                            style={{ ...styles.stepNum, background: '#0a7' }}
                          >
                            ✈
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>
                              KEF drop · {run.length} order
                              {run.length === 1 ? '' : 's'} · {totalBags} bag
                              {totalBags === 1 ? '' : 's'}
                            </div>
                            <div style={{ color: '#666', fontSize: 12 }}>
                              {run
                                .map((x) => x.order?.customer)
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          </div>
                          <div></div>
                        </div>
                      )
                    }
                    return null
                  })
                })()}
              </div>
            )
          })}
        </div>
      )}

      {plan && plan.routes.length > 0 && (
        <TimelineView
          routes={plan.routes}
          dateIso={date}
          selectedOrderId={selectedOrderId}
          onSelectOrder={setSelectedOrderId}
          draggedOrderId={draggedOrderId}
          setDraggedOrderId={setDraggedOrderId}
          onDrop={handleDrop}
        />
      )}

      </main>

      {selectedOrder && (
        <StopDetailPanel
          order={selectedOrder}
          override={overrides[selectedOrder.recordId]}
          onChange={(patch) => setOverride(selectedOrder.recordId, patch)}
          onClear={() => clearOverride(selectedOrder.recordId)}
          onClose={() => setSelectedOrderId(null)}
          context={selectedRouteContext}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        entries={paletteEntries}
      />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />

      {planning && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background:
              'linear-gradient(90deg, transparent, #2563eb 30%, #2563eb 70%, transparent)',
            backgroundSize: '40% 100%',
            backgroundRepeat: 'no-repeat',
            animation: 'bagbee-planning-stripe 1.2s linear infinite',
            zIndex: 300,
          }}
        >
          <style jsx global>{`
            @keyframes bagbee-planning-stripe {
              0% {
                background-position: -40% 0;
              }
              100% {
                background-position: 140% 0;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

function DriveSegment({
  leftPct,
  widthPct,
  seconds,
}: {
  leftPct: number
  widthPct: number
  seconds: number
}) {
  const [hover, setHover] = useState(false)
  const minutes = Math.round(seconds / 60)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        top: 0,
        bottom: 0,
        zIndex: 0,
        pointerEvents: 'auto',
        cursor: 'default',
      }}
    >
      {/* The visible line itself — centred vertically. */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 2,
          marginTop: -1,
          background: hover ? '#94a3b8' : '#cbd5e1',
        }}
      />
      {hover && (
        <div
          style={{
            position: 'absolute',
            top: -28,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#111',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 11,
            whiteSpace: 'nowrap',
            zIndex: 10,
            pointerEvents: 'none',
            boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
          }}
        >
          {minutes} min driving
        </div>
      )}
    </div>
  )
}

function TimelineView({
  routes,
  dateIso,
  selectedOrderId,
  onSelectOrder,
  draggedOrderId,
  setDraggedOrderId,
  onDrop,
}: {
  routes: Route[]
  dateIso: string
  selectedOrderId: string | null
  onSelectOrder: (id: string | null) => void
  draggedOrderId: string | null
  setDraggedOrderId: (id: string | null) => void
  onDrop: (
    draggedId: string,
    targetDriverId: string,
    targetIndex: number,
  ) => void
}) {
  // Time domain: include every step's arrival/departure across all routes,
  // padded to the nearest 30 min, so the strip always has whitespace at
  // both ends regardless of how compact the day is.
  const { startSec, endSec } = useMemo(() => {
    let min = Infinity
    let max = -Infinity
    for (const r of routes) {
      for (const s of r.steps) {
        if (s.arrival < min) min = s.arrival
        const stepEnd = s.arrival + (s.service ?? 0)
        if (stepEnd > max) max = stepEnd
      }
    }
    if (!isFinite(min) || !isFinite(max)) {
      return { startSec: 0, endSec: 3600 }
    }
    // Pad 15 min each side and snap to nearest half-hour.
    const padStart = Math.floor((min - 15 * 60) / 1800) * 1800
    const padEnd = Math.ceil((max + 15 * 60) / 1800) * 1800
    return { startSec: padStart, endSec: padEnd }
  }, [routes])

  const totalSec = endSec - startSec || 1
  const xPct = (sec: number) => ((sec - startSec) / totalSec) * 100

  // Hourly tick marks across the strip.
  const ticks = useMemo(() => {
    const out: { pct: number; label: string }[] = []
    const firstHour = Math.ceil(startSec / 3600) * 3600
    for (let t = firstHour; t <= endSec; t += 3600) {
      out.push({ pct: xPct(t), label: fmtClock(t) })
    }
    return out
  }, [startSec, endSec])

  const ROW_H = 56
  const LABEL_W = 120

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #e5e5e7',
        borderRadius: 8,
        padding: 16,
        marginTop: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>Timeline</div>
        <div style={{ fontSize: 12, color: '#666' }}>
          drag boxes between rows to reassign · within a row to reorder ·
          click to edit
        </div>
      </div>

      {/* Time-axis ticks */}
      <div style={{ display: 'flex', alignItems: 'flex-end', height: 24 }}>
        <div style={{ width: LABEL_W }} />
        <div style={{ position: 'relative', flex: 1, height: '100%' }}>
          {ticks.map((t) => (
            <div
              key={t.pct}
              style={{
                position: 'absolute',
                left: `${t.pct}%`,
                bottom: 0,
                fontSize: 11,
                color: '#666',
                transform: 'translateX(-50%)',
              }}
            >
              {t.label}
            </div>
          ))}
        </div>
      </div>

      {/* Driver rows */}
      {routes.map((r, ri) => {
        const driverId = r.driver?.recordId ?? null
        const color = ROUTE_COLORS[ri % ROUTE_COLORS.length]
        const pickups = r.steps.filter((s) => s.type === 'pickup')
        return (
          <div
            key={r.vehicle}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              borderTop: '1px solid #f0f0f0',
              minHeight: ROW_H,
            }}
          >
            <div
              style={{
                width: LABEL_W,
                fontSize: 13,
                fontWeight: 500,
                padding: '12px 8px 12px 0',
                borderRight: '1px solid #f0f0f0',
              }}
            >
              {r.driver?.name || `Vehicle ${r.vehicle}`}
              <div style={{ fontSize: 11, color: '#666', fontWeight: 400 }}>
                {pickups.length} stops
              </div>
            </div>
            <div
              style={{
                position: 'relative',
                flex: 1,
                background:
                  // Vertical hour grid lines
                  `repeating-linear-gradient(to right,
                    transparent 0,
                    transparent calc(${100 / ((endSec - startSec) / 3600)}% - 1px),
                    #f5f5f5 calc(${100 / ((endSec - startSec) / 3600)}% - 1px),
                    #f5f5f5 ${100 / ((endSec - startSec) / 3600)}%)`,
              }}
              onDragOver={(e) => {
                // Always allow drop while a drag is in progress — the
                // browser only fires dragover when something is being
                // dragged, so calling preventDefault unconditionally is
                // safe. (Gating on React state misses the first events
                // after dragstart because the closure is stale.)
                if (!driverId) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(e) => {
                if (!driverId) return
                const dragged =
                  e.dataTransfer.getData('text/plain') || draggedOrderId
                if (!dragged) return
                e.preventDefault()
                // Compute target index based on cursor X relative to the
                // existing pickups' arrival times: how many of this row's
                // pickups (excluding the dragged one) start before cursor.
                const rect = (
                  e.currentTarget as HTMLDivElement
                ).getBoundingClientRect()
                const cursorPct = ((e.clientX - rect.left) / rect.width) * 100
                let targetIdx = 0
                for (const p of pickups) {
                  if (p.order?.recordId === dragged) continue
                  if (xPct(p.arrival) < cursorPct) targetIdx++
                }
                onDrop(dragged, driverId, targetIdx)
              }}
            >
              {/* Driving connectors — thin line between the END of one
                  stop's service and the START of the next stop's arrival.
                  Hover shows the driving minutes, like OptimoRoute's
                  timeline tooltips. */}
              {pickups.map((s, i) => {
                if (i === 0) return null
                const prev = pickups[i - 1]
                const driveStart = prev.arrival + (prev.service ?? 0)
                const driveEnd = s.arrival
                const driveSec = driveEnd - driveStart
                if (driveSec <= 0) return null
                return (
                  <DriveSegment
                    key={`drive-${i}`}
                    leftPct={xPct(driveStart)}
                    widthPct={(driveSec / totalSec) * 100}
                    seconds={driveSec}
                  />
                )
              })}
              {pickups.map((s, i) => {
                const orderId = s.order?.recordId ?? null
                const isSel = !!orderId && orderId === selectedOrderId
                const isDragging =
                  !!orderId && orderId === draggedOrderId
                const left = xPct(s.arrival)
                // Width = service time on this scale, but never narrower
                // than a min so the box stays clickable for short stops.
                const widthPct = (s.service / totalSec) * 100
                const customer = s.order?.customer ?? `S${s.id ?? i}`
                const short = customer
                  .split(' ')[0]
                  .replace(/[^A-Za-zÁÉÍÓÚÝÞÆÖáéíóúýþæö]/g, '')
                  .slice(0, 4)
                const sla = computeSla(s.arrival, s.order?.timeSlot, dateIso)
                const slaColor = SLA_COLORS[sla.band]
                // Out of the customer's booked window: arriving after it
                // closes (late) or before it opens (early/waits). Flag hard.
                const outOfWindow =
                  sla.band === 'late' || sla.band === 'early'
                return (
                  <div
                    key={i}
                    draggable={!!orderId}
                    onDragStart={(e) => {
                      if (!orderId) return
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', orderId)
                      setDraggedOrderId(orderId)
                    }}
                    onDragEnd={() => setDraggedOrderId(null)}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!orderId || draggedOrderId) return
                      onSelectOrder(isSel ? null : orderId)
                    }}
                    title={`${i + 1}. ${customer} @ ${fmtClock(
                      s.arrival,
                    )} (${(s.service / 60).toFixed(0)} min) — ${
                      SLA_LABELS[sla.band]
                    }${
                      sla.slackMin != null
                        ? sla.band === 'late'
                          ? ` (${Math.abs(sla.slackMin)}m past close)`
                          : sla.band === 'early'
                          ? ` (waits ${Math.abs(sla.slackMin)}m)`
                          : ` (${sla.slackMin}m before close)`
                        : ''
                    }`}
                    style={{
                      position: 'absolute',
                      top: 6,
                      bottom: 6,
                      left: `${left}%`,
                      width: `max(${widthPct}%, ${outOfWindow ? 64 : 44}px)`,
                      background: color,
                      color: 'white',
                      borderRadius: 4,
                      padding: '4px 6px 4px 8px',
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: draggedOrderId ? 'grabbing' : 'grab',
                      // `border` first so the SLA `borderLeft` below wins —
                      // the left stripe encodes SLA risk (scan for tight/late).
                      border: isSel
                        ? '2px solid #facc15'
                        : outOfWindow
                        ? `2px solid ${slaColor}`
                        : 'none',
                      borderLeft: isSel
                        ? '2px solid #facc15'
                        : `4px solid ${slaColor}`,
                      boxShadow: isSel
                        ? '0 0 0 2px white inset, 0 4px 8px rgba(0,0,0,0.12)'
                        : outOfWindow
                        ? `0 0 0 2px ${slaColor}, 0 2px 6px rgba(0,0,0,0.18)`
                        : '0 1px 2px rgba(0,0,0,0.08)',
                      opacity: isDragging ? 0.4 : 1,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      lineHeight: 1.2,
                      userSelect: 'none',
                    }}
                  >
                    {outOfWindow && (
                      <span style={{ fontWeight: 800 }}>⚠ </span>
                    )}
                    {i + 1}.&nbsp;{short}
                    {outOfWindow && sla.slackMin != null && (
                      <span style={{ marginLeft: 3, fontWeight: 800 }}>
                        {sla.band === 'late'
                          ? `+${Math.abs(sla.slackMin)}m`
                          : `wait ${Math.abs(sla.slackMin)}m`}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StopDetailPanel({
  order,
  override,
  onChange,
  onClear,
  onClose,
  context,
}: {
  order: Order
  override: StopOverride | undefined
  onChange: (patch: StopOverride) => void
  onClear: () => void
  onClose: () => void
  context: { route: Route; pickup: Step; delivery: Step | null } | null
}) {
  const [tw, setTw] = useState(override?.timeSlot ?? order.timeSlot ?? '')
  const [pickDur, setPickDur] = useState<string>(
    override?.pickupDurationMin != null
      ? String(override.pickupDurationMin)
      : order.pickupDurationMin != null
      ? String(order.pickupDurationMin)
      : '',
  )
  const [delDur, setDelDur] = useState<string>(
    override?.deliveryDurationMin != null
      ? String(override.deliveryDurationMin)
      : order.deliveryDurationMin != null
      ? String(order.deliveryDurationMin)
      : '',
  )

  // Re-sync local form fields when the dispatcher selects a different order.
  useEffect(() => {
    setTw(override?.timeSlot ?? order.timeSlot ?? '')
    setPickDur(
      override?.pickupDurationMin != null
        ? String(override.pickupDurationMin)
        : order.pickupDurationMin != null
        ? String(order.pickupDurationMin)
        : '',
    )
    setDelDur(
      override?.deliveryDurationMin != null
        ? String(override.deliveryDurationMin)
        : order.deliveryDurationMin != null
        ? String(order.deliveryDurationMin)
        : '',
    )
  }, [order.recordId, override])

  const dirty =
    (tw || '') !== (order.timeSlot || '') ||
    pickDur !==
      (order.pickupDurationMin != null
        ? String(order.pickupDurationMin)
        : '') ||
    delDur !==
      (order.deliveryDurationMin != null
        ? String(order.deliveryDurationMin)
        : '')

  function commit() {
    const patch: StopOverride = {}
    if ((tw || '').trim() && tw.trim() !== order.timeSlot) {
      patch.timeSlot = tw.trim()
    }
    const p = parseFloat(pickDur)
    if (!Number.isNaN(p) && p !== order.pickupDurationMin) {
      patch.pickupDurationMin = p
    }
    const d = parseFloat(delDur)
    if (!Number.isNaN(d) && d !== order.deliveryDurationMin) {
      patch.deliveryDurationMin = d
    }
    onChange(patch)
  }

  return (
    <div
      style={{
        // Fixed right rail — does NOT push the map/timeline around when
        // it opens. Mirrors the OptimoRoute UX where editing a stop
        // never reflows the planning surface.
        position: 'fixed',
        top: 16,
        right: 16,
        bottom: 16,
        width: 380,
        background: 'white',
        border: '1px solid #e5e5e7',
        borderLeft: '4px solid #facc15',
        borderRadius: 8,
        padding: 16,
        boxShadow: '0 12px 32px rgba(0,0,0,0.08)',
        overflowY: 'auto',
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {order.customer || '(no name)'}
          </div>
          <div style={{ color: '#666', fontSize: 13 }}>
            {order.orderNo || `#${order.orderId}`}{' '}
            {order.orderStatus ? `· ${order.orderStatus}` : ''}
            {context && (
              <>
                {' '}· assigned to{' '}
                <strong>
                  {context.route.driver?.name || `Vehicle ${context.route.vehicle}`}
                </strong>
                {' '}· pickup{' '}
                <strong>{fmtClock(context.pickup.arrival)}</strong>
                {context.delivery && (
                  <>
                    {' '}· KEF drop{' '}
                    <strong>{fmtClock(context.delivery.arrival)}</strong>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            color: '#666',
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          marginTop: 12,
        }}
      >
        <div>
          <div style={{ ...styles.statLabel, marginBottom: 4 }}>Address</div>
          <div style={{ fontSize: 13 }}>
            {order.pickupAddress}
            {order.municipality ? ` · ${order.municipality}` : ''}
          </div>
        </div>
        <div>
          <div style={{ ...styles.statLabel, marginBottom: 4 }}>Phone</div>
          <div style={{ fontSize: 13 }}>{order.phone || '—'}</div>
        </div>
        <div>
          <div style={{ ...styles.statLabel, marginBottom: 4 }}>Bags</div>
          <div style={{ fontSize: 13 }}>{order.bags}</div>
        </div>
        <div>
          <div style={{ ...styles.statLabel, marginBottom: 4 }}>
            Open in Airtable
          </div>
          <a
            href={airtableRecordUrl(order.recordId)}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, color: '#2563eb' }}
          >
            {order.recordId} →
          </a>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid #f0f0f0',
        }}
      >
        <div
          style={{
            ...styles.statLabel,
            marginBottom: 8,
          }}
        >
          Override for next plan
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr) auto',
            gap: 12,
            alignItems: 'end',
          }}
        >
          <label style={{ fontSize: 12, color: '#444' }}>
            Time window
            <input
              type="text"
              value={tw}
              onChange={(e) => setTw(e.target.value)}
              placeholder="HH:MM-HH:MM"
              style={{ ...styles.input, marginTop: 4, width: '100%' }}
            />
          </label>
          <label style={{ fontSize: 12, color: '#444' }}>
            Pickup duration (min)
            <input
              type="number"
              step="0.5"
              value={pickDur}
              onChange={(e) => setPickDur(e.target.value)}
              style={{ ...styles.input, marginTop: 4, width: '100%' }}
            />
          </label>
          <label style={{ fontSize: 12, color: '#444' }}>
            Delivery duration (min)
            <input
              type="number"
              step="0.5"
              value={delDur}
              onChange={(e) => setDelDur(e.target.value)}
              style={{ ...styles.input, marginTop: 4, width: '100%' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={commit}
              disabled={!dirty}
              style={{
                ...styles.primary,
                padding: '8px 14px',
                opacity: dirty ? 1 : 0.4,
                cursor: dirty ? 'pointer' : 'not-allowed',
              }}
            >
              Apply
            </button>
            {override && (
              <button
                onClick={onClear}
                style={{ ...styles.secondary, padding: '8px 14px' }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#666', marginTop: 8 }}>
          Edits are session-only — the next "Plan routes" run uses these values
          but Airtable is not modified. Reset clears the override for this
          order.
        </div>
      </div>
    </div>
  )
}
