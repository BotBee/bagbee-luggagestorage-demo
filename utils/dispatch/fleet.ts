import Airtable from 'airtable'
import getAppConfig from '../../modules/config'
import {
  FLEET_BASE_ID,
  OWN_FLEET,
  RENTAL,
  TBL_OWN_FLEET,
  TBL_RENTALS,
} from './fields'

// Reads vehicles from the separate "Fleet Management System" base. Uses the
// same Airtable PAT as the rest of the app — that token must have read access
// to base appe0dWRH3OuVExPW (if it 403s, add the base to the token's scope).

const {
  serverRuntimeConfig: { airtableAccessToken, airtableEndpointUrl },
} = getAppConfig()

function fleetBase() {
  Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
  return Airtable.base(FLEET_BASE_ID)
}

export type Vehicle = {
  recordId: string
  kind: 'own' | 'rental'
  name: string // display label
  make: string
  model: string
  colour: string | null
  suitcases: number | null // capacity (bags) — feeds VROOM
  supplier: string | null // rentals only
  recommended: boolean
  isElectric: boolean
}

function num(v: unknown): number | null {
  return typeof v === 'number' ? v : null
}
function str(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

export async function getFleet(): Promise<{ own: Vehicle[]; rentals: Vehicle[] }> {
  const base = fleetBase()

  const ownRecs = await base(TBL_OWN_FLEET)
    .select({ returnFieldsByFieldId: true })
    .all()
  const own: Vehicle[] = ownRecs.map((r) => {
    const f = r.fields as Record<string, unknown>
    const make = str(f[OWN_FLEET.make])
    const model = str(f[OWN_FLEET.model])
    const colour = f[OWN_FLEET.colour] ? str(f[OWN_FLEET.colour]) : null
    const id = str(f[OWN_FLEET.vehicleId])
    return {
      recordId: r.id,
      kind: 'own',
      name: id || `${make} ${model}`.trim(),
      make,
      model,
      colour,
      suitcases: num(f[OWN_FLEET.suitcases]),
      supplier: null,
      recommended: false,
      isElectric: Boolean(f[OWN_FLEET.isElectric]),
    }
  })

  const rentRecs = await base(TBL_RENTALS)
    .select({ returnFieldsByFieldId: true })
    .all()
  const rentals: Vehicle[] = rentRecs.map((r) => {
    const f = r.fields as Record<string, unknown>
    const make = str(f[RENTAL.make])
    const model = str(f[RENTAL.model])
    const supplier = f[RENTAL.supplier] ? str(f[RENTAL.supplier]) : null
    const id = str(f[RENTAL.vehicleId])
    const rec = f[RENTAL.recommend]
    const recommended =
      // Prefer Höldur / Europcar, or anything flagged "Recommend".
      /h[öo]ldur|europ?car|recommend|yes/i.test(str(rec)) ||
      /h[öo]ldur|europ?car/i.test(supplier ?? '')
    return {
      recordId: r.id,
      kind: 'rental',
      name: id || `${make} ${model}`.trim(),
      make,
      model,
      colour: null,
      suitcases: num(f[RENTAL.suitcases]),
      supplier,
      recommended,
      isElectric: false,
    }
  })

  return { own, rentals }
}
