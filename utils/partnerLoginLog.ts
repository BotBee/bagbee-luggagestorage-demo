// Append-only audit log for partner-portal sign-ins. Writes one row to the
// Airtable "Partner logins" table per successful verify-code call.
//
// Why a dedicated table:
//   - Vercel runtime logs roll off after 24h on Hobby — useless for "did
//     anyone from Iceland Travel log in this month?".
//   - The session cookie is the only other artefact, and it lives only in
//     the user's browser.
//   - Airtable gives ops a sortable / filterable view without us building
//     an admin UI.
//
// Fail-soft: a log-write failure must never block the login. Errors are
// logged to the Vercel function log and swallowed.

import Airtable from 'airtable'
import type { NextApiRequest } from 'next'

const BASE_ID = 'appHB2bNYPAhfUcLv'
const TABLE_ID = 'tbllGLawpUHpsDQfg' // Partner logins

// Airtable field IDs — using IDs (not names) lets ops rename columns
// without breaking the integration.
const F = {
  email: 'fldouWfpFrbqgxoF5',
  partner: 'fld93dZNUVH8VoPjc',
  loggedInAt: 'fldok1HLKrRTlVYfh',
  ip: 'fld5N0tWhdeiLfZw3',
  userAgent: 'fldA1RHzevP9JryG6',
} as const

let cachedBase: ReturnType<typeof Airtable.prototype.base> | null = null

const getBase = () => {
  if (cachedBase) return cachedBase
  const apiKey = process.env.AIRTABLE_ACCESS_TOKEN
  if (!apiKey) {
    throw new Error('AIRTABLE_ACCESS_TOKEN missing — login log disabled')
  }
  const at = new Airtable({ apiKey })
  cachedBase = at.base(BASE_ID)
  return cachedBase
}

// Pull the real client IP from the standard proxy headers. Vercel sets
// x-real-ip; behind any CDN we also have x-forwarded-for (a comma list,
// first entry is the original client). req.socket.remoteAddress is just
// the Vercel proxy in serverless so it's the last resort.
const extractIp = (req: NextApiRequest): string => {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim()
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return String(xff[0]).split(',')[0].trim()
  }
  const xreal = req.headers['x-real-ip']
  if (typeof xreal === 'string') return xreal
  return req.socket?.remoteAddress || ''
}

const extractUserAgent = (req: NextApiRequest): string => {
  const ua = req.headers['user-agent']
  if (typeof ua === 'string') return ua.slice(0, 500) // cap to keep cells tidy
  return ''
}

export async function logPartnerLogin(args: {
  partnerId: string
  email: string
  req: NextApiRequest
}): Promise<void> {
  try {
    const base = getBase()
    await base(TABLE_ID).create([
      {
        fields: {
          [F.email]: args.email,
          [F.partner]: args.partnerId,
          // Use the server's clock — Airtable converts to its own UTC
          // storage anyway. ISO string keeps it locale-free.
          [F.loggedInAt]: new Date().toISOString(),
          [F.ip]: extractIp(args.req),
          [F.userAgent]: extractUserAgent(args.req),
        },
      },
    ])
  } catch (err) {
    // Never let an audit-log failure cascade — the session cookie is
    // already issued by the time we get here. Just log and move on.
    console.error('[partnerLoginLog] failed to record login', {
      partnerId: args.partnerId,
      email: args.email,
      err,
    })
  }
}
