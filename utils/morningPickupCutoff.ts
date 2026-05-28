import dayjs, { type Dayjs } from 'dayjs'

/**
 * When pickup falls on tomorrow and local time is 15:00+, morning slots are not bookable.
 * Matches pages/api/airtable/availability.ts so UI can hide slots instead of showing them disabled.
 */
export const isMorningPickupPastBookingCutoff = (slotCalendarDate: string | Date | Dayjs) => {
  const now = dayjs()
  const slotDate = dayjs(slotCalendarDate)
  return slotDate.isSame(now.add(1, 'day'), 'day') && now.hour() >= 15
}
