import { Airport } from '../common/types'

export const getDefaultAirports = (): Array<Airport> => {
  return [
    {
      iata: 'BGO',
      icao: 'ENBR',
      name: 'Bergen Airport',
      city: 'Bergen',
      countryCode: 'NO',
    },
    {
      iata: 'KEF',
      icao: 'BIKF',
      name: 'Keflavík International Airport',
      city: 'Keflavík',
      countryCode: 'IS',
    },
    {
      iata: 'ALC',
      icao: 'LEAL',
      name: 'Alicante–Elche Airport',
      city: 'Alicante',
      countryCode: 'ES',
    },
  ]
}
