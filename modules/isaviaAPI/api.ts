import { FlightData } from '../../common/types'
import { ApplicationRoutes } from '../../utils/routing'

export const getFlights = async (
  date: string,
  type: 'D' | 'A' = 'D'
): Promise<FlightData[]> => {
  const startDate = new Date(date)
  startDate.setUTCHours(0, 0, 0, 0)

  const endDate = new Date(date)
  endDate.setUTCHours(23, 59, 59, 999)

  const scheduledTimeStart = startDate.toISOString().split('.')[0] + '+00:00'
  const scheduledTimeEnd = endDate.toISOString().split('.')[0] + '+00:00'

  const res = await fetch(ApplicationRoutes.Isavia.apiGetFlights, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      DepartureArrivalType: type,
      ScheduledTimeStart: scheduledTimeStart,
      ScheduledTimeEnd: scheduledTimeEnd,
    }),
  })

  if (!res.ok) {
    throw new Error('Failed to fetch flights')
  }

  return res.json()
}
