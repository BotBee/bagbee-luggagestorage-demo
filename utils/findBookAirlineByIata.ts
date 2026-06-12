import { airlines } from '../common/airlines'
import type { Airline } from '../common/types'

/** Airlines offered in the main /book flow (choose-airline step). */
export function findBookAirlineByIata(iata: string | null | undefined): Airline | undefined {
  if (!iata) return undefined
  const upper = iata.toUpperCase()
  return Object.values(airlines).find((a) => a.iata.toUpperCase() === upper)
}
