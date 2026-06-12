// Vegagerðin road-weather lookup. We hit the public GraphQL endpoint that
// powers umferdin.is — same data, same station IDs, no auth required.
//
// For BagBee the only station that matters today is Reykjanesbraut (id 14)
// on Road 41 — the airport leg between BSÍ and KEF. If we ever add other
// regions we'll widen the IDs list.

const ENDPOINT = 'https://umferdin.is/graphql'

const QUERY = `query WeatherStations {
  WeatherStations {
    results {
      id
      name
      wind { speed gust }
      windAlert
      windDirection { description degrees }
      temperature
      roadTemperature
      lastUpdate
    }
  }
}`

export type WeatherStation = {
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

// Station IDs that sit on routes BagBee actually drives. Keep small — every
// extra station the dashboard surfaces is one more thing the dispatcher
// has to interpret.
export const ROUTE_STATIONS: { id: number; label: string }[] = [
  { id: 14, label: 'Reykjanesbraut' },
]

export async function getRouteWeather(): Promise<WeatherStation[]> {
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY }),
  })
  if (!resp.ok) {
    throw new Error(`umferdin.is GraphQL ${resp.status}`)
  }
  const data = (await resp.json()) as {
    data?: {
      WeatherStations?: {
        results?: Array<{
          id: number
          name: string
          wind: { speed: number | null; gust: number | null } | null
          windAlert: string | null
          windDirection: { description: string | null } | null
          temperature: number | null
          roadTemperature: number | null
          lastUpdate: string | null
        }>
      }
    }
    errors?: Array<{ message: string }>
  }
  if (data.errors?.length) {
    throw new Error(`GraphQL: ${data.errors.map((e) => e.message).join('; ')}`)
  }

  const wantedIds = new Set(ROUTE_STATIONS.map((s) => s.id))
  const all = data.data?.WeatherStations?.results ?? []
  return all
    .filter((s) => wantedIds.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      windMs: s.wind?.speed ?? null,
      gustMs: s.wind?.gust ?? null,
      windAlert: s.windAlert,
      windDirection: s.windDirection?.description ?? null,
      temperature: s.temperature,
      roadTemperature: s.roadTemperature,
      updatedAt: s.lastUpdate,
    }))
}

// Threshold the dispatcher uses to decide whether driving is safe. Per
// BagBee operations: don't drive if sustained wind is at or above 23 m/s.
// Gusts are advisory in the UI but don't gate the button on their own.
export const WIND_HARD_LIMIT_MS = 23
export const WIND_WARN_LIMIT_MS = 18
