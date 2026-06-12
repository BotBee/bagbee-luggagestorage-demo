import dayjs, { type Dayjs } from 'dayjs'
import { nowInIceland } from './icelandTime'

/**
 * When pickup falls on Iceland's tomorrow and it is 15:00+ in Iceland,
 * morning slots are not bookable. Matches pages/api/airtable/availability.ts
 * (which runs on UTC servers — Iceland is UTC year-round) so the UI can hide
 * slots instead of showing them disabled. Uses the Iceland clock, never the
 * customer's browser clock.
 */
export const isMorningPickupPastBookingCutoff = (slotCalendarDate: string | Date | Dayjs) => {
  const now = nowInIceland()
  const slotDate = dayjs(slotCalendarDate)
  // Compare calendar dates as strings: slotCalendarDate is a local-midnight
  // calendar day, `now` is tz-shifted — .isSame(…, 'day') would compare them
  // in the browser timezone and drift around midnight.
  return (
    slotDate.format('YYYY-MM-DD') === now.add(1, 'day').format('YYYY-MM-DD') &&
    now.hour() >= 15
  )
}
