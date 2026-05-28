import { FlightData } from '../../common/types'
import { ApplicationRoutes } from '../../utils/routing'

export const getFlights = async (date: string): Promise<FlightData[]> => {
  // Convert the input date to start and end date strings in the required format
  const startDate = new Date(date)
  startDate.setUTCHours(0, 0, 0, 0) // Set time to 00:00:00

  const endDate = new Date(date)
  endDate.setUTCHours(23, 59, 59, 999) // Set time to 23:59:59

  // Format the dates to the ISO string format without milliseconds (as needed by the API)
  const scheduledTimeStart = startDate.toISOString().split('.')[0] + '+00:00'
  const scheduledTimeEnd = endDate.toISOString().split('.')[0] + '+00:00'

  // Call the backend API endpoint
  const res = await fetch(ApplicationRoutes.Isavia.apiGetFlights, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      DepartureArrivalType: 'D', // for departure
      ScheduledTimeStart: scheduledTimeStart,
      ScheduledTimeEnd: scheduledTimeEnd,
    }),
  })

  // Check if the response is successful
  if (!res.ok) {
    throw new Error('Failed to fetch flights')
  }

  return res.json()
}
