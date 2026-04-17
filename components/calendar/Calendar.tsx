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
}
const Calendar = ({ onChange }: ICalendarProps) => {
  const bookingState = useBookingStore((state) => state.booking)
  const selectedDate = bookingState.flightInformation.departureDate

  // Get the current date and time
  const currentDate = new Date()
  const currentHour = currentDate.getHours()
  const oneYearFromNow = new Date(
    new Date().setFullYear(new Date().getFullYear() + 1)
  )

  // Calculate the minimum and maximum selectable dates based on the current time
  let minDate = null
  if (currentHour < 15) {
    // If it's before 15:00, the user can only select the day after today
    minDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() + 1
    )
  } else {
    // If it's after 15:00, the user can only select a date two days in advance or later
    minDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() + 2
    )
  }
  const currentYear = new Date().getFullYear()
  const disabledDates = [
    new Date(currentYear, 11, 25), // December 24th
    new Date(currentYear, 11, 26), // December 25th
    new Date(currentYear, 0, 1), // January 1st
    new Date(currentYear, 0, 2), // January 2st
    new Date(currentYear + 1, 0, 1), // January 1st, next year
    new Date(currentYear + 1, 0, 2), // January 2st, next year
  ]

  return (
    <Container>
      <DayPicker
        mode='single'
        selected={selectedDate}
        onSelect={onChange}
        disabled={[
          { before: minDate, after: oneYearFromNow },
          ...disabledDates,
        ]}
      />
    </Container>
  )
}

export default Calendar
