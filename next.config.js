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
  airtableFastTrackTableId: process.env.AIRTABLE_FAST_TRACK_TABLE_ID,
  airtableEndpointUrl: process.env.AIRTABLE_ENDPOINT_URL,
  azinQAirportApiBaseUrl: process.env.AZINQAIRPORTAPI_BASE_URL,
  azinQAirportApiPassword: process.env.AZINQAIRPORTAPI_PASSWORD,
  azinQAirportApiUsername: process.env.AZINQAIRPORTAPI_USERNAME,
  azinQAirportApiToken: process.env.AZINQAIRPORTAPI_TOKEN,
  paydayBaseUrl: process.env.PAYDAY_BASE_URL,
  paydayClientId: process.env.PAYDAY_CLIENT_ID,
  paydayClientSecret: process.env.PAYDAY_CLIENT_SECRET,
  storageRefundSecret: process.env.STORAGE_REFUND_SECRET,
}

// Baseline security headers applied to every route. Deliberately conservative:
//
// - Strict-Transport-Security pins HTTPS for 2 years. `preload` opted-in so
//   the domain can be added to the HSTS preload list later if we want.
//   Safe because the production site has been HTTPS-only for years.
// - X-Content-Type-Options blocks MIME sniffing.
// - X-Frame-Options: SAMEORIGIN — nothing legitimate iframes bagbee.is from
//   a third party (would block clickjacking of /orders, refund, etc.).
// - Referrer-Policy: strict-origin-when-cross-origin — sends just the host
//   (not full URL with ?orderNo=…) to third-party scripts (GA, GTM, etc.).
// - Permissions-Policy disables APIs we never use (camera, mic, geo).
//
// NOT included yet (separate task): Content-Security-Policy. Would need to
// allowlist GTM / GA / HubSpot / Hotjar / Rapyd-Apple-Pay / Google Maps /
// Stripe Apple Pay JS / Contentful images / Airtable user content. Worth
// doing in a dedicated PR with `Content-Security-Policy-Report-Only` first.
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
]

// The partner booking popups under /embed are meant to be iframed onto the
// sister-company sites (luggagelockers.is, bikerent.is) in place of their old
// Fillout embeds. They therefore must NOT send X-Frame-Options (which would be
// SAMEORIGIN from the global rule and block third-party framing). Instead they
// send a CSP `frame-ancestors` that allows exactly those partner origins (and
// 'self' for local preview). All other security headers are kept.
const EMBED_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
  {
    key: 'Content-Security-Policy',
    value:
      "frame-ancestors 'self' https://luggagelockers.is https://*.luggagelockers.is https://bikerent.is https://*.bikerent.is",
  },
]

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
  async headers() {
    return [
      // Everything except /embed/* gets the standard headers (incl. X-Frame-Options).
      {
        source: '/((?!embed/).*)',
        headers: SECURITY_HEADERS,
      },
      // /embed/* is framable by the partner origins (no X-Frame-Options; CSP instead).
      {
        source: '/embed/:path*',
        headers: EMBED_HEADERS,
      },
    ]
  },
}

module.exports = nextConfig
