import { Airlines, AirlinesFastTrack } from './types'

export const airlines: Airlines = {
  neos: {
    name: 'Neos',
    callSign: 'MOONFLOWER',
    iata: 'NO',
    icao: 'NOS',
  },
  icelandAir: {
    name: 'Icelandair',
    callSign: 'ICEAIR',
    iata: 'FI',
    icao: 'ICE',
  },
}

export const fastTrackAirlines: AirlinesFastTrack = {
  delta: {
    name: 'Delta',
    callSign: 'DELTA',
    iata: 'DL',
    icao: 'DAL',
  },
  united: {
    name: 'United',
    callSign: 'UNITED',
    iata: 'UA',
    icao: 'UAL',
  },
  airCanada: {
    name: 'Air Canada',
    callSign: 'AIR CANADA',
    iata: 'AC',
    icao: 'ACA',
  },
  britishAirways: {
    name: 'British Airways',
    callSign: 'SPEEDBIRD',
    iata: 'BA',
    icao: 'BAW',
  },
  sas: {
    name: 'SAS',
    callSign: 'SCANDINAVIAN',
    iata: 'SK',
    icao: 'SAS',
  },
  easyJet: {
    name: 'EasyJet',
    callSign: 'EASY',
    iata: 'EZY', // Should be U2, but the API returns EZY
    icao: 'EZY',
  },
  eurowings: {
    name: 'Eurowings',
    callSign: 'EUROWINGS',
    iata: 'EW',
    icao: 'EWG',
  },
  tui: {
    name: 'TUI fly',
    callSign: 'TUIJET',
    iata: 'X3',
    icao: 'TUI',
  },
  wizzAir: {
    name: 'Wizz Air',
    callSign: 'WIZZAIR',
    iata: 'W6',
    icao: 'WZZ',
  },
  norwegian: {
    name: 'Norwegian',
    callSign: 'NOR SHUTTLE',
    iata: 'DY',
    icao: 'NAX',
  },
}

export const allIataCodes = [
  ...Object.values(airlines).map((airline) => airline.iata),
  ...Object.values(fastTrackAirlines).map((airline) => airline.iata),
]

export const allAirlineNames = [
  ...Object.values(airlines).map((airline) => airline.name),
  ...Object.values(fastTrackAirlines).map((airline) => airline.name),
]
