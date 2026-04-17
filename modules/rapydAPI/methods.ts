import { mapToPayment } from '../../common/mapper'
import { Booking } from '../../common/types'
import { ApplicationRoutes } from '../../utils/routing'

export const makePayment = async (
  recordId: string,
  booking: Booking,
  locale: string
) => {
  const payload = mapToPayment(recordId, booking, locale)

  const result = await fetch(ApplicationRoutes.apiRapyd, {
    method: 'POST',
    mode: 'cors',
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
  })

  if (!result) {
    throw new Error('Failed to fetch data')
  }

  return result.json()
}
