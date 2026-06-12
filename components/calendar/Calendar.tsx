import React from 'react'
import 'react-day-picker/style.css'

import 'react-calendar/dist/Calendar.css'
import { useBookingStore } from '../../store/store'
import { DayPicker } from 'react-day-picker'
import styled from '@emotion/styled'

const Container = styled.div`
  @media ${({ theme }) => theme.breakpoints.tablet} {
    margin-top: 100px;
    transform: scale(1.3);
  }
`
interface ICalendarProps {
  // eslint-disable-next-line no-unused-vars
  onChange: (date: any) => void
  minDate?: Date
  disabledDates?: Date[]
}
const Calendar = ({ onChange, minDate, disabledDates }: ICalendarProps) => {
  const bookingState = useBookingStore((state) => state.booking)
  // Only show a date as `selected` when it's a real future Date that the
  // calendar would actually allow. If the persisted state (or anything
  // upstream) hands us a string, NaN, or a stale past date, fall back to
  // undefined so DayPicker shows the current month with no preselection
  // and the customer can click any valid date.
  const persistedDate = bookingState?.flightInformation?.departureDate
  const isUsable =
    persistedDate instanceof Date &&
    !isNaN(persistedDate.getTime()) &&
    (!minDate || persistedDate.getTime() >= minDate.getTime())
  const selectedDate = isUsable ? persistedDate : undefined

  // Get the current date and time
  const oneYearFromNow = new Date(new Date().setFullYear(new Date().getFullYear() + 1))

  // Open the calendar on the month that actually has bookable dates.
  // Without this, DayPicker defaults to today's month — so after the 15:00
  // cut-off (when minDate jumps to "day after tomorrow"), customers land on
  // a month with every day disabled. Prefer the persisted selection if it
  // exists so returning customers don't get pulled back to a different
  // month than the date they previously picked.
  const defaultMonth = selectedDate || minDate || undefined

  return (
    <Container>
      <DayPicker
        mode="single"
        selected={selectedDate}
        defaultMonth={defaultMonth}
        onSelect={onChange}
        disabled={[{ before: minDate, after: oneYearFromNow }, ...(disabledDates || [])]}
      />
    </Container>
  )
}

export default Calendar
