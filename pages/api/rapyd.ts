import { ClientRequest, IncomingMessage } from 'http'

import https from 'https'

import { NextApiRequest, NextApiResponse } from 'next'
import { generateRandomString, sign } from '../../common/rapyd-helper'
import getAppConfig from '../../modules/config'

const {
  publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
} = getAppConfig()

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
    const path = `/v1/checkout`

    const body = ensureCheckoutUrls(req.body)
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
