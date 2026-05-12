import { NextConfig } from 'next'

export type AppConfig = {
  publicRuntimeConfig: PublicConfig
  serverRuntimeConfig: ServerConfig
} & NextConfig

export type PublicConfig = {
  rapydBaseUrl: string
  OAGBaseUrl: string
  rapydAccessKey: string
}

export type ServerConfig = {
  rapydSecretKey: string
  airtableAccessToken: string
  airtableBaseId: string
  airtableTableId: string
  airtableEndpointUrl: string
  azinQAirportApiUsername: string
  azinQAirportApiPassword: string
  azinQAirportApiToken: string
  azinQAirportApiBaseUrl: string
  paydayBaseUrl: string
  paydayClientId: string
  paydayClientSecret: string
}
