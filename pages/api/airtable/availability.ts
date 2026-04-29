import { NextApiRequest, NextApiResponse } from 'next'
import {
  getPickupConfig,
  getPickupConfigMatrix,
  getPickupTimes,
  getPostalCodeCutoffs,
  parseSlotStartHour,
} from '../../../utils/airtable'
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
    let postalCode: string = ''
    try {
      const body = JSON.parse(req.body)
      departureDate = body?.departureDate
      // postalCode is optional — empty/unknown → no postcode rule applied,
      // capacity-only check (today's behaviour). Server validates on submit.
      const rawPostal = body?.postalCode
      postalCode = typeof rawPostal === 'string' ? rawPostal.trim() : ''
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

    // Postal-code rule lookup. Empty string / unknown postcode → no rule
    // applies (legacy behaviour: capacity-only check). Currently only applied
    // to evening slots; morning slots are unrestricted by postcode for now.
    const postalCodeRules = await getPostalCodeCutoffs()
    const postalRule = postalCode ? postalCodeRules[postalCode] : undefined
    const isUnserviced = postalRule ? postalRule.service === false : false
    const earliestStartHour = postalRule ? postalRule.earliestSlotStartHour : null
    const latestStartHour = postalRule ? postalRule.latestSlotStartHour : null

    // The 3-hour "any-time" 19:00 - 22:00 slot is exempt from earliest/latest
    // cutoffs — it covers the full evening window so the driver can swing by
    // whenever they're in the area. This matches the "also 19:00-22:00"
    // column in the postcode rules table (every serviced row keeps it on).
    const ANY_TIME_SLOT = '19:00 - 22:00'

    const slotPassesPostalRule = (slotKey: string): boolean => {
      if (isUnserviced) return false
      const slotLabel = slotKey.split('/')[1] ?? ''
      if (slotLabel === ANY_TIME_SLOT) return true
      const slotStartHour = parseSlotStartHour(slotLabel)
      if (slotStartHour == null) return true
      if (earliestStartHour != null && slotStartHour < earliestStartHour) return false
      if (latestStartHour != null && slotStartHour > latestStartHour) return false
      return true
    }

    // check if the number of pickups for a given timeslot is less than the max
    const timeslots = {
      morningSlots: mapValues(morningSlots, (_, key) => {
        const maxPickups = pickupConfigMatrix[key] || defaultTimeslotMax
        if (maxPickups <= 0) return false
        const slotDate = dayjs(key.split('/')[0])
        // If it's same day, don't allow morning slots
        if (slotDate.isSame(currentTime, 'day')) return false
        if (isMorningPickupPastBookingCutoff(slotDate)) return false
        // If the postcode is unserviced, hide morning slots too (driver
        // doesn't go there at all). Time-based cutoffs only apply to evening
        // slots, so we skip the cutoff check here.
        if (isUnserviced) return false
        return !pickupTimesByDate[key] || pickupTimesByDate[key] < maxPickups
      }),
      eveningSlots: mapValues(eveningSlots, (_, key) => {
        const maxPickups = pickupConfigMatrix[key] || defaultTimeslotMax
        if (maxPickups <= 0) return false
        if (!slotPassesPostalRule(key)) return false
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
