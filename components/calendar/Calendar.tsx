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
  const selectedDate = bookingState.flightInformation.departureDate

  // Get the current date and time
  const oneYearFromNow = new Date(new Date().setFullYear(new Date().getFullYear() + 1))

  return (
    <Container>
      <DayPicker
        mode="single"
        selected={selectedDate}
        onSelect={onChange}
        disabled={[{ before: minDate, after: oneYearFromNow }, ...(disabledDates || [])]}
      />
    </Container>
  )
}

export default Calendar
