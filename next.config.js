/** @type {import('./next-config').PublicConfig} */
const publicRuntimeConfig = {
  rapydBaseUrl: process.env.RAPYD_BASE_URL,
  OAGBaseUrl: process.env.OAG_BASE_URL,
  rapydAccessKey: process.env.RAPYD_ACCESS_KEY,
}

/** @type {import('./next-config').ServerConfig} */
const serverRuntimeConfig = {
  rapydSecretKey: process.env.RAPYD_SECRET_KEY,
  goFlightAccessKey: process.env.GOFLIGHT_API_ACCESS_KEY,
  airtableAccessToken: process.env.AIRTABLE_ACCESS_TOKEN,
  airtableBaseId: process.env.AIRTABLE_BASE_ID,
  airtableTableId: process.env.AIRTABLE_TABLE_ID,
  airtableTagNumbersTableId: process.env.AIRTABLE_TAG_NUMBERS_TABLE_ID,
  airtableEndpointUrl: process.env.AIRTABLE_ENDPOINT_URL,
  azinQAirportApiBaseUrl: process.env.AZINQAIRPORTAPI_BASE_URL,
  azinQAirportApiPassword: process.env.AZINQAIRPORTAPI_PASSWORD,
  azinQAirportApiUsername: process.env.AZINQAIRPORTAPI_USERNAME,
  azinQAirportApiToken: process.env.AZINQAIRPORTAPI_TOKEN,
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  publicRuntimeConfig,
  serverRuntimeConfig,
  reactStrictMode: true,
  compiler: {
    // Enables the styled-components SWC transform
    styledComponents: true,
  },
  swcMinify: true,
  images: {
    domains: ['images.ctfassets.net', 'v5.airtableusercontent.com', 'dl.airtable.com'],
  },
  i18n: {
    locales: ['en', 'is'],
    defaultLocale: 'is',
    localeDetection: false,
  },
}

module.exports = nextConfig
