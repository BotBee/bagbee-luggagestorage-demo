import { ClientRequest, IncomingMessage } from 'http'

import https from 'https'

import { NextApiRequest, NextApiResponse } from 'next'
import { generateRandomString, sign } from '../../common/rapyd-helper'
import getAppConfig from '../../modules/config'

const {
  publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
} = getAppConfig()

// Hard caps and value allowlists for /api/rapyd. This endpoint is
// reachable from the customer's browser (it MUST be — the browser can't
// sign Rapyd requests itself), so we can't gate it behind a server-only
// secret. Instead we narrow the inputs so the worst abuses of the
// open-relay shape are closed:
//
//   - phishing-redirect (attacker sets complete_payment_url to evil.com,
//     uses BagBee-branded checkout to grab cards): blocked by URL host
//     allowlist below.
//   - card testing with non-ISK cards: blocked by currency='ISK'.
//   - 9-figure amounts to trip risk systems: blocked by amount cap.
//
// Card testing with valid Icelandic cards is still possible in principle
// but rate-limited by Rapyd themselves and visible in chargebacks. A
// per-IP rate limit on this route is a sensible next step (TODO) but
// needs a real backing store — Vercel functions are stateless so an
// in-memory limit would be cosmetic.
//
// Every legitimate caller already conforms to these limits — verified by
// grep of every fetch('/api/rapyd', ...) and mapToPayment / mapTransport
// ToPayment / etc. callers. If a future feature genuinely needs USD or a
// higher amount, EXTEND the allowlist here (don't bypass).
const RAPYD_MAX_AMOUNT_ISK = 500_000
const RAPYD_ALLOWED_CURRENCY = 'ISK'
const RAPYD_ALLOWED_COUNTRY = 'IS'

// Hosts allowed in complete_payment_url / complete_checkout_url /
// error_payment_url / cancel_checkout_url.
const RAPYD_ALLOWED_HOSTS = new Set(['www.bagbee.is', 'bagbee.is'])

const isAllowedRedirectUrl = (raw: unknown): boolean => {
  if (typeof raw !== 'string' || raw.length === 0) return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  // Localhost (any port) for dev — only over http. In prod this just
  // never matches because the browser never sends localhost URLs from
  // bagbee.is.
  if (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  ) {
    return true
  }
  if (url.protocol !== 'https:') return false
  if (RAPYD_ALLOWED_HOSTS.has(url.hostname)) return true
  // Vercel preview URLs (e.g. bagbee-is-active-XYZ.vercel.app). These
  // are needed because Vercel previews don't run on bagbee.is.
  if (url.hostname.endsWith('.vercel.app')) return true
  return false
}

type ValidationResult = { ok: true } | { ok: false; reason: string }

const validateCheckoutBody = (body: any): ValidationResult => {
  if (!body || typeof body !== 'object') {
    return { ok: false, reason: 'body must be an object' }
  }
  // amount: positive integer below cap
  const amount = body.amount
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    return { ok: false, reason: 'amount must be a positive integer' }
  }
  if (amount > RAPYD_MAX_AMOUNT_ISK) {
    return { ok: false, reason: `amount above cap (${RAPYD_MAX_AMOUNT_ISK})` }
  }
  if (body.currency !== RAPYD_ALLOWED_CURRENCY) {
    return { ok: false, reason: `currency must be ${RAPYD_ALLOWED_CURRENCY}` }
  }
  if (body.country !== RAPYD_ALLOWED_COUNTRY) {
    return { ok: false, reason: `country must be ${RAPYD_ALLOWED_COUNTRY}` }
  }
  // Every redirect URL must point at an allowed host. complete_payment_url
  // is required; the wallet/error variants are validated when set (they
  // can be filled in later by ensureCheckoutUrls() — but that copy is
  // only from a URL we've already approved).
  if (!isAllowedRedirectUrl(body.complete_payment_url)) {
    return { ok: false, reason: 'complete_payment_url host not allowed' }
  }
  for (const k of ['complete_checkout_url', 'error_payment_url', 'cancel_checkout_url'] as const) {
    if (body[k] !== undefined && !isAllowedRedirectUrl(body[k])) {
      return { ok: false, reason: `${k} host not allowed` }
    }
  }
  return { ok: true }
}

// Safety net: Apple Pay / Google Pay finish on Rapyd's hosted page and
// follow `complete_checkout_url`, NOT `complete_payment_url`. If the
// caller forgot to set the wallet variants (the four inline payload
// builders — /api/order/update, /api/tip/create, /api/fast-track/create,
// /api/rapyd/retry — have all dropped them at various points in
// history), copy the off-site redirect URLs over so wallet customers
// don't land on the bagbee.is homepage. mapToPayment() in
// common/mapper.ts also sets them explicitly.
const ensureCheckoutUrls = (body: any): any => {
  if (!body || typeof body !== 'object') return body
  const next = { ...body }
  if (!next.complete_checkout_url && next.complete_payment_url) {
    next.complete_checkout_url = next.complete_payment_url
  }
  if (!next.cancel_checkout_url && next.error_payment_url) {
    next.cancel_checkout_url = next.error_payment_url
  }
  return next
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      return res.status(405).json({ message: 'Method not allowed' })
    }
    const path = `/v1/checkout`

    const body = ensureCheckoutUrls(req.body)
    const verdict = validateCheckoutBody(body)
    if (!verdict.ok) {
      console.warn('[api][rapyd] rejected payload', verdict.reason)
      return res.status(400).json({ message: 'invalid checkout request', reason: verdict.reason })
    }
    const result = await makeRequest(req.method || '', path, body)
    res.status(200).json(result)
  } catch (err) {
    console.log('[api][rapyd] error', err)
    res.status(500).send({ message: 'failed to call API', error: err })
  }
}

const makeRequest = async (method: string, urlPath: string, body = null) => {
  try {
    const httpMethod = method
    const httpBaseURL = rapydBaseUrl
    const httpURLPath = urlPath
    const salt = generateRandomString(8)
    /**
     * A key to make transaction unique
     */
    const idempotency = new Date().getTime().toString()
    const timestamp = Math.round(new Date().getTime() / 1000)
    const signature = sign(httpMethod, httpURLPath, salt, timestamp, body)

    const options = {
      hostname: httpBaseURL,
      port: 443,
      path: httpURLPath,
      method: httpMethod,
      headers: {
        'content-Type': 'application/json',
        salt: salt,
        timestamp: timestamp,
        signature: signature,
        access_key: rapydAccessKey,
        idempotency: idempotency,
      },
    }

    return await httpRequest(options, body)
  } catch (error) {
    console.error('Error generating request options')
    throw error
  }
}

const httpRequest = async (options: any, body: any) => {
  return new Promise((resolve, reject) => {
    try {
      let bodyString = ''
      if (body) {
        bodyString = JSON.stringify(body)
        bodyString = bodyString == '{}' ? '' : bodyString
      }

      const req: ClientRequest = https.request(
        options,
        (res: IncomingMessage) => {
          let response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: '',
          }

          res.on('data', (data) => {
            response.body += data
          })

          res.on('end', () => {
            if (response.statusCode !== 200) {
              return reject(response)
            }

            response.body = response.body ? JSON.parse(response.body) : {}
            return resolve(response)
          })
        }
      )

      req.on('error', (error) => {
        return reject(error)
      })

      req.write(bodyString)
      req.end()
    } catch (err) {
      return reject(err)
    }
  })
}

exports.makeRequest = makeRequest
