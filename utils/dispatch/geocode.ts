// Server-side geocoder backed by Google's Geocoding API.
//
// Two-tier cache:
//   1. In-memory Map for the lifetime of the Node process / serverless invocation.
//   2. JSON file at utils/dispatch/geocode-cache.json — bundled with the deploy
//      so we get a warm cache on cold starts, and editable in dev.
//
// In dev, new lookups are written back to the JSON file so subsequent runs
// don't re-pay Google. In production (Vercel) the project filesystem is
// read-only at runtime, so the write is best-effort and silently ignored.

import { promises as fs } from 'fs'
import path from 'path'

type LatLng = { lat: number; lng: number }

const memCache = new Map<string, LatLng>()
let fileCacheLoaded = false
let fileCacheDirty = false

const KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  ''

const CACHE_FILE = path.join(process.cwd(), 'utils', 'dispatch', 'geocode-cache.json')

async function loadFileCache(): Promise<void> {
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

async function persistFileCache(): Promise<void> {
  if (!fileCacheDirty) return
  try {
    const obj: Record<string, LatLng> = {}
    memCache.forEach((v, k) => { obj[k] = v })
    await fs.writeFile(CACHE_FILE, JSON.stringify(obj, null, 2) + '\n', 'utf8')
    fileCacheDirty = false
  } catch {
    // Read-only filesystem (Vercel prod) — best-effort.
  }
}

export async function geocode(address: string): Promise<LatLng | null> {
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
  return loc
}

export async function geocodeMany(
  addresses: string[],
): Promise<Map<string, LatLng>> {
  // Pre-load the file cache once so each parallel geocode() call hits the
  // populated mem-cache and only the truly-uncached addresses go to Google.
  await loadFileCache()
  const out = new Map<string, LatLng>()
  // Parallel — Google's per-second quota easily handles a dispatch run's
  // ~20 simultaneous lookups, and most are cache hits anyway.
  const results = await Promise.all(addresses.map((a) => geocode(a)))
  addresses.forEach((a, i) => {
    const r = results[i]
    if (r) out.set(a, r)
  })
  await persistFileCache()
  return out
}
