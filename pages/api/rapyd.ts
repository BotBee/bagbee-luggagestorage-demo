import { ClientRequest, IncomingMessage } from 'http'

import https from 'https'

import { NextApiRequest, NextApiResponse } from 'next'
import { generateRandomString, sign } from '../../common/rapyd-helper'
import getAppConfig from '../../modules/config'

const {
  publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
} = getAppConfig()

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const path = `/v1/checkout`

    const result = await makeRequest(req.method || '', path, req.body)
    res.status(200).json(result)
  } catch (err) {
    console.log(err)
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
