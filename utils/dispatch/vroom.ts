// VROOM client. VROOM is the open-source VRP solver we run alongside OSRM
// (see route-planner/dispatch-stack/docker-compose.yml). We POST a JSON
// problem and receive an assignment + per-stop ETAs.
//
// Docs: https://github.com/VROOM-Project/vroom/blob/master/docs/API.md

import { BSI_DEPOT, KEF_DROP } from './fields'

export type LngLat = [number, number] // VROOM uses [lng, lat]

export type VroomJob = {
  id: number
  description?: string
  location: LngLat
  service?: number // seconds at the stop
  delivery?: number[] // multi-dimensional demand consumed at this stop
  pickup?: number[]
  time_windows?: [number, number][] // unix seconds
  priority?: number // 0..100
}

export type VroomVehicleStep =
  | { type: 'start' }
  | { type: 'end' }
  | { type: 'job'; id: number }
  | { type: 'pickup'; id: number }
  | { type: 'delivery'; id: number }
  | { type: 'break'; id: number }

export type VroomVehicle = {
  id: number
  description?: string
  profile?: 'car' | 'bike' | 'foot'
  start: LngLat
  end: LngLat
  capacity?: number[]
  time_window?: [number, number]
  // Optional fixed step plan. Provided when the dispatcher locks this
  // driver's route — VROOM honours the order and only optimises the
  // remaining vehicles.
  steps?: VroomVehicleStep[]
}

export type VroomShipmentStep = {
  id: number
  description?: string
  location: LngLat
  service?: number
  time_windows?: [number, number][]
}

export type VroomShipment = {
  pickup: VroomShipmentStep
  delivery: VroomShipmentStep
  amount?: number[]
  priority?: number
}

export type VroomProblem = {
  jobs?: VroomJob[]
  shipments?: VroomShipment[]
  vehicles: VroomVehicle[]
  options?: { g?: boolean } // include geometry in the response
}

export type VroomStep = {
  type: 'start' | 'job' | 'pickup' | 'delivery' | 'break' | 'end'
  arrival: number // unix seconds
  duration: number
  service: number
  waiting_time: number
  location: LngLat
  job?: number // job id when type === 'job'
  id?: number // shipment step id when type is 'pickup' / 'delivery'
  description?: string
  load?: number[]
}

export type VroomRoute = {
  vehicle: number
  cost: number
  duration: number
  service: number
  waiting_time: number
  distance?: number
  steps: VroomStep[]
  // Encoded polyline of the actual road path (Google polyline-encoding 5).
  // Present when the request was solved with options.g === true.
  geometry?: string
}

export type VroomSolution = {
  code: number // 0 == ok
  summary: {
    cost: number
    routes: number
    unassigned: number
    duration: number
    distance?: number
  }
  unassigned: { id: number; location: LngLat; description?: string }[]
  routes: VroomRoute[]
}

const VROOM_URL = process.env.VROOM_URL || 'http://localhost:3030'

export async function solve(problem: VroomProblem): Promise<VroomSolution> {
  // Always request road geometry. VROOM proxies OSRM and returns one encoded
  // polyline per route; the dashboard decodes it to draw real-road shapes
  // instead of straight crow-flight lines.
  const withGeometry: VroomProblem = {
    ...problem,
    options: { ...(problem.options ?? {}), g: true },
  }
  const resp = await fetch(VROOM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withGeometry),
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`VROOM ${resp.status}: ${body}`)
  }
  const data = (await resp.json()) as VroomSolution
  if (data.code !== 0) {
    throw new Error(`VROOM solver error code ${data.code}`)
  }
  return data
}

// Helpers -----------------------------------------------------------------

// Parse a time slot like "16:00-18:00" or "16-18" into a UTC unix range
// anchored to a calendar date (YYYY-MM-DD). Iceland is UTC year-round, so
// we treat all times as UTC. Returns null if it can't parse.
export function parseTimeSlot(
  slot: string,
  dateIso: string,
): [number, number] | null {
  const m = slot.match(
    /^\s*(\d{1,2})(?::(\d{2}))?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*$/,
  )
  if (!m) return null
  const [, h1, m1 = '00', h2, m2 = '00'] = m
  const start = Date.UTC(
    Number(dateIso.slice(0, 4)),
    Number(dateIso.slice(5, 7)) - 1,
    Number(dateIso.slice(8, 10)),
    Number(h1),
    Number(m1),
  )
  const end = Date.UTC(
    Number(dateIso.slice(0, 4)),
    Number(dateIso.slice(5, 7)) - 1,
    Number(dateIso.slice(8, 10)),
    Number(h2),
    Number(m2),
  )
  return [Math.floor(start / 1000), Math.floor(end / 1000)]
}

// Default shift windows in UTC (Iceland is UTC year-round).
export function defaultShiftWindow(
  shift: string,
  dateIso: string,
): [number, number] {
  const [yyyy, mm, dd] = dateIso.split('-').map(Number)
  if (shift === 'Morning') {
    return [
      Math.floor(Date.UTC(yyyy, mm - 1, dd, 5, 0) / 1000),
      Math.floor(Date.UTC(yyyy, mm - 1, dd, 12, 0) / 1000),
    ]
  }
  // Evening (default) — covers afternoon airport pickups for KEF deliveries.
  return [
    Math.floor(Date.UTC(yyyy, mm - 1, dd, 14, 0) / 1000),
    Math.floor(Date.UTC(yyyy, mm - 1, dd, 23, 0) / 1000),
  ]
}

export const DEPOT_LOCATION: LngLat = [BSI_DEPOT.lng, BSI_DEPOT.lat]
export const KEF_LOCATION: LngLat = [KEF_DROP.lng, KEF_DROP.lat]
