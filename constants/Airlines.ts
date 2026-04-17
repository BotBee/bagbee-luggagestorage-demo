import { Airline } from '../common/types'

export const getDefaultAirlines = (): Array<Airline> => {
  return [
    {
      iata: 'FI',
      icao: 'ICE',
      name: 'Icelandair',
      callSign: 'ICEAIR',
    },
    {
      iata: 'NO',
      icao: 'NOS',
      name: 'Neos',
      callSign: 'NEOSAIR',
    },
  ]
}
