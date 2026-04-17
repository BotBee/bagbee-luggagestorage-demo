/** A common location for all types */

export interface FlightData {
  AirlineIATA: string | null
  AirlineDesc: string
  AODBFlightId: number
  DepartureArrivalType: string
  EstimatedDateTime: string
  FlightNumber: string
  FlightStatus: string | null
  FlightStatusDesc: string | null
  OriginDestAirportDesc: string
  OriginDestAirportIATA: string
  ScheduledDateTime: string
  isMorningFlight?: boolean | undefined
}

export interface FlightWithAirport extends FlightData {
  name: string
  city: string
  countryCode: string
}

export type RouteResult = {
  success: boolean
  data: Array<Route>
}

export type Route = {
  airlineIata: string
  airlineIcao: string
  airportName?: string
  arrivalIata: string
  arrivalIcao: string
  arrivalTerminal?: string
  arrivalTime?: string
  departureIata: string
  departureIcao: string
  departureTerminal?: string
  departureTime?: string
  flightNumber: string
  regNumber: Array<string>
}

export type IsaviaFlightsResult = {
  Success: boolean
  Items: Array<IsaviaFlight>
}

export type IsaviaFlight = {
  Id: number
  No: string
  Departure: boolean
  InAir: boolean
  AirlineIATA: string
  Airline: string
  HomeAirportIATA: string
  HomeAirport: string
  OriginDestIATA: string
  OriginDest: string
  DisplayName: string
  Scheduled: string
  Status: string
  Codeshare: string
  Logo: string
  AltDisplayName: string
  isMorningFlight?: boolean | undefined
  name: string
  city: string
  countryCode: string
}

export type AirtableOrderId = {
  'Order ID': number
}

export type AirtableOrder = {
  'Dagsetning flugs': string
  'Dagsetning pick-up': string
  Flugfélag: string
  Heimilisfang: string
  'Hótel Nafn': string
  'Delivery Address': string
  'Nafn viðskiptavinar': string
  Tímasetning: string
  Málstaðall: string
  Símanúmer: string
  Flugnúmer: string
  Tölvupóstfang: string
  Töskufjöldi_no: number
  Töskufjöldi_no_yfirstærð: number
  Áfangastaður: string
  Kennitala?: string
  'Annað (comment)': string
  Greitt: boolean
  Greiðslustaða: string
  Upphæð: number
  Gengi: string
  Tilvísun: string
  'Discount Code'?: string
}

export type Customer = {
  name: string
  address: string
  email: string
  phoneNumber: string
  companyId?: string
  discountCode?: {
    discount: number
    code: string
  }
  agreesToTermsAndConditions: boolean
}

export type Airport = {
  name: string
  iata: string
  city: string
  icao?: string
  countryCode: string
}

export type Airline = {
  name: string
  callSign?: string
  iata: string
  icao: string
}

export interface Airlines {
  neos: Airline
  icelandAir: Airline
  airCanada: Airline
}

export type BaggageType = 'Bag' | 'Oversized'

export type Price = {
  amount: number
  currency: string
}

export type BaggageInformation = {
  baggage: {
    oddSizeAmount: number
    amount: number
  }
}
export type PickupInformation = {
  pickupSlot: string
  hotelName: string
  pickupLocation: string
  postalCode: string
  comments: string
  pickupDate: Date
  deliveryAddress: 'Keflavíkurflugvöllur'
}

export type FlightInformation = {
  flightNumber: string
  airline: Airline
  departureAirport: Airport
  arrivalAirport: Airport
  departureDate: Date
  arrivalDate: string
  selectedFlight?: FlightData
}

/** Our Rapyd payment object */
export type RapydPaymentObject = {
  amount: number
  country: string
  currency: string
  language: string
  merchant_reference_id: string
  complete_payment_url: string
  error_payment_url: string
}

export type ServiceType = 'departure' | 'arrival' | 'both'

export type ArrivalInformation = {
  deliveryAddress: string
  deliveryHotelName: string
  deliverySlot: string
  meetingPoint: 'customs_gate' | 'luggage_truck'
  comments: string
}

/** Our booking object */
export type Booking = {
  serviceType: ServiceType
  customerInfo: Customer
  pickupInformation: PickupInformation
  flightInformation: FlightInformation
  baggageInformation: BaggageInformation
  checkoutPrice: Price
  availableFlights?: FlightData[]
  // Arrival service fields
  arrivalFlightInformation?: FlightInformation
  arrivalBaggageInformation?: BaggageInformation
  arrivalInfo?: ArrivalInformation
  arrivalCheckoutPrice?: Price
  arrivalAvailableFlights?: FlightData[]
}
