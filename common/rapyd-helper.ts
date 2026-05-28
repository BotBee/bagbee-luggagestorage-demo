import { createHmac, randomBytes } from 'crypto'
import getAppConfig from '../modules/config'

const {
  publicRuntimeConfig: { rapydAccessKey },
  serverRuntimeConfig: { rapydSecretKey },
} = getAppConfig()

/** Rapyd request validation helper */

export const sign = (
  method: string,
  urlPath: string,
  salt: string,
  timestamp: number,
  body: any
) => {
  try {
    let bodyString = ''
    if (body) {
      bodyString = JSON.stringify(body)
      bodyString = bodyString == '{}' ? '' : bodyString
    }

    let toSign =
      method.toLowerCase() +
      urlPath +
      salt +
      timestamp +
      rapydAccessKey +
      rapydSecretKey +
      bodyString

    let hash = createHmac('sha256', rapydSecretKey || '')
    hash.update(toSign)
    const signature = Buffer.from(hash.digest('hex')).toString('base64')

    return signature
  } catch (error) {
    console.error('Error generating signature')
    throw error
  }
}

export const generateRandomString = (size: number) => {
  try {
    return randomBytes(size).toString('hex')
  } catch (error) {
    console.error('Error generating salt')
    throw error
  }
}
