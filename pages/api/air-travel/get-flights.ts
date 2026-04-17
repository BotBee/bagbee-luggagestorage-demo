// pages/api/flights.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { FlightData } from '../../../common/types'
import getAppConfig from '../../../modules/config'

interface ErrorResponse {
  error: string
  details?: string
}
const {
  serverRuntimeConfig: {
    azinQAirportApiBaseUrl,
    azinQAirportApiPassword,
    azinQAirportApiToken,
    azinQAirportApiUsername,
  },
} = getAppConfig()
interface FlightRequestBody {
  OriginDestAirportIATA?: string
  DepartureArrivalType?: string
  ScheduledTimeStart?: string
  ScheduledTimeEnd?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FlightData[] | ErrorResponse>
) {
  if (req.method === 'POST') {
    const {
      OriginDestAirportIATA,
      DepartureArrivalType,
      ScheduledTimeStart,
      ScheduledTimeEnd,
    }: FlightRequestBody = req.body

    try {
      // Fetch data from the external API, passing all parameters as headers
      const response = await fetch(azinQAirportApiBaseUrl, {
        method: 'GET',
        headers: {
          Username: azinQAirportApiUsername,
          Password: azinQAirportApiPassword,
          Token: azinQAirportApiToken,
          ...(OriginDestAirportIATA && { OriginDestAirportIATA }),
          ...(DepartureArrivalType && { DepartureArrivalType }),
          ...(ScheduledTimeStart && { ScheduledTimeStart }),
          ...(ScheduledTimeEnd && { ScheduledTimeEnd }),
        },
      })

      if (!response.ok) {
        const errorResponse = await response.text() // Capture the error response
        console.log('API Error Response:', errorResponse) // Log the error response
        return res.status(response.status).json({
          error: 'Failed to fetch data from the API',
          details: errorResponse,
        })
      }

      const data = await response.json()

      return res.status(200).json(data)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return res.status(500).json({
          error: 'An error occurred while fetching data',
          details: error.message,
        })
      }

      return res
        .status(500)
        .json({ error: 'An unknown error occurred while fetching data' })
    }
  } else {
    res.setHeader('Allow', ['POST'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}
