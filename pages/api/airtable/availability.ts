import { NextApiRequest, NextApiResponse } from 'next'
import { getPickupConfig, getPickupConfigMatrix, getPickupTimes } from '../../../utils/airtable'
import { isMorningPickupPastBookingCutoff } from '../../../utils/morningPickupCutoff'
import dayjs from 'dayjs'
import mapValues from 'lodash/mapValues'
import countBy from 'lodash/countBy'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      console.warn('[api][availability] method not allowed', req.method)
      return res.status(405).json({ error: 'Method not allowed' })
    }

    let departureDate: string = ''
    try {
      departureDate = JSON.parse(req.body)?.departureDate
    } catch (error) {
      console.error('[api][availability] invalid body', req.body)
      return res.status(400).json({ error: 'Invalid body' })
    }

    // validte the departure date
    if (!departureDate || !dayjs(departureDate).isValid()) {
      console.warn('[api][availability] invalid departure date', departureDate)
      return res.status(400).json({ error: 'Invalid departure date' })
    }

    const defaultTimeslotMax = await getPickupConfig()

    const pickupConfigMatrix = await getPickupConfigMatrix(defaultTimeslotMax)

    // same day pickup is allowed if the departure is in the evening
    const allowSameDayPickup = dayjs(departureDate).get('hour') > 14
    const currentTime = dayjs()

    const morningDate = allowSameDayPickup
      ? dayjs(departureDate)
      : dayjs(departureDate).subtract(1, 'day')
    const eveningDate = dayjs(departureDate).subtract(1, 'day')
    const morningDateKey = `${morningDate.format('YYYY-MM-DD')}`
    const eveningDateKey = `${eveningDate.format('YYYY-MM-DD')}`

    const morningSlots: Record<string, boolean> = {
      [`${morningDateKey}/09:00 - 12:00`]: false,
      [`${morningDateKey}/08:00 - 09:00`]: false,
      [`${morningDateKey}/09:00 - 10:00`]: false,
      [`${morningDateKey}/10:00 - 11:00`]: false,
      [`${morningDateKey}/11:00 - 12:00`]: false,
    }
    const eveningSlots: Record<string, boolean> = {
      [`${eveningDateKey}/19:00 - 22:00`]: false,
      [`${eveningDateKey}/17:00 - 18:00`]: false,
      [`${eveningDateKey}/18:00 - 19:00`]: false,
      [`${eveningDateKey}/19:00 - 20:00`]: false,
      [`${eveningDateKey}/20:00 - 21:00`]: false,
      [`${eveningDateKey}/21:00 - 22:00`]: false,
    }

    const pickupTimes = await getPickupTimes()

    const pickupTimesByDate = countBy(
      pickupTimes,
      (pickupTime) =>
        `${pickupTime.fields['Dagsetning pick-up']}/${pickupTime.fields['Tímasetning']}`,
    )

    // check if the number of pickups for a given timeslot is less than the max
    const timeslots = {
      morningSlots: mapValues(morningSlots, (_, key) => {
        const maxPickups = pickupConfigMatrix[key] || defaultTimeslotMax
        if (maxPickups <= 0) return false
        const slotDate = dayjs(key.split('/')[0])
        // If it's same day, don't allow morning slots
        if (slotDate.isSame(currentTime, 'day')) return false
        if (isMorningPickupPastBookingCutoff(slotDate)) return false
        return !pickupTimesByDate[key] || pickupTimesByDate[key] < maxPickups
      }),
      eveningSlots: mapValues(eveningSlots, (_, key) => {
        const maxPickups = pickupConfigMatrix[key] || defaultTimeslotMax
        if (maxPickups <= 0) return false
        return !pickupTimesByDate[key] || pickupTimesByDate[key] < maxPickups
      }),
    }

    console.log('[api][availability] success')
    res.status(200).json({ timeslots, pickupTimesByDate })
  } catch (error) {
    console.error('[api][availability] error', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
