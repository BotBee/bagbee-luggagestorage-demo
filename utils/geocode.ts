// Server-side geocoder backed by Google's Geocoding API. Mirrors the
// dispatch dashboard's geocode util (utils/dispatch/geocode.ts in the
// separate dispatch tree) so partner-portal endpoints can resolve a
// pickup address to lat/lng without depending on that codebase.
//
// Two-tier cache:
//   1. In-memory Map for the lifetime of the serverless invocation.
//   2. Optional JSON file at utils/geocode-cache.json — bundled with the
//      deploy, editable in dev. Write-back is best-effort; Vercel's prod
//      filesystem is read-only so persists only in dev.

import { promises as fs } from 'fs'
import path from 'path'

export type LatLng = { lat: number; lng: number }

const memCache = new Map<string, LatLng>()
let fileCacheLoaded = false
let fileCacheDirty = false

const KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  ''

// Cache lives under node_modules/.cache so Next.js's dev filewatcher
// ignores it. Writing to utils/ in dev would trigger a recompile on every
// geocode call and torch the in-memory cache before it could serve a
// single request.
const CACHE_FILE = path.join(
  process.cwd(),
  'node_modules',
  '.cache',
  'bagbee-geocode-cache.json',
)

const loadFileCache = async (): Promise<void> => {
  if (fileCacheLoaded) return
  fileCacheLoaded = true
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, LatLng>
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.lat === 'number' && typeof v.lng === 'number') {
        memCache.set(k, v)
      }
    }
  } catch {
    // Missing or unreadable cache is fine — first run.
  }
}

const persistFileCache = async (): Promise<void> => {
  if (!fileCacheDirty) return
  try {
    // Make sure node_modules/.cache exists before writing.
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true })
    const obj: Record<string, LatLng> = {}
    memCache.forEach((v, k) => {
      obj[k] = v
    })
    await fs.writeFile(CACHE_FILE, JSON.stringify(obj, null, 2) + '\n', 'utf8')
    fileCacheDirty = false
  } catch {
    // Read-only filesystem (Vercel prod) — best-effort.
  }
}

export const geocode = async (address: string): Promise<LatLng | null> => {
  const trimmed = address.trim()
  if (!trimmed) return null
  await loadFileCache()
  const cached = memCache.get(trimmed)
  if (cached) return cached
  if (!KEY) {
    console.warn('geocode: no Google Maps API key configured')
    return null
  }
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', trimmed)
  url.searchParams.set('region', 'is')
  url.searchParams.set('components', 'country:IS')
  url.searchParams.set('key', KEY)
  try {
    const resp = await fetch(url.toString())
    if (!resp.ok) {
      console.warn('geocode: HTTP', resp.status, 'for', trimmed)
      return null
    }
    const data = (await resp.json()) as {
      status: string
      results?: { geometry: { location: LatLng } }[]
    }
    if (data.status !== 'OK' || !data.results?.length) {
      console.warn('geocode:', data.status, 'for', trimmed)
      return null
    }
    const loc = data.results[0].geometry.location
    memCache.set(trimmed, loc)
    fileCacheDirty = true
    void persistFileCache()
    return loc
  } catch (err) {
    console.warn('geocode: fetch failed for', trimmed, err)
    return null
  }
}

// Haversine great-circle distance in metres. Used as the v1 "how far is the
// driver" calculation while the in-house dispatch backend doesn't yet expose
// an OSRM route endpoint we can hit from the partner portal. Swappable later
// for a true road-distance / ETA call.
const EARTH_RADIUS_M = 6_371_000
const toRad = (deg: number) => (deg * Math.PI) / 180

export const haversineMeters = (a: LatLng, b: LatLng): number => {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}
