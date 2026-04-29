import styled from '@emotion/styled'
import { useRouter } from 'next/router'
import React from 'react'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import { pickupSlots } from '../../common/pickupSlots'
import { useBookingStore } from '../../store/store'
import PickUpTimeCard from '../time-card/TimeCard'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import { isMorningPickupPastBookingCutoff } from '../../utils/morningPickupCutoff'

const AvailableTimesContainer = styled.div`
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    grid-template-columns: 1fr 1fr;
  }
`
const Label = styled.label`
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  display: flex;
  align-items: center;
  color: #696f79;
  margin-bottom: 8px;
  margin-top: 24px;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 24px;
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  color: #696f79;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`

const AvailablePickupTimes = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const bookingState = useBookingStore((state) => state.booking)
  const updatePickupDate = useBookingStore((state) => state.updatePickupDate)
  const updatePickupSlot = useBookingStore((state) => state.updatePickupSlot)

  // For now, Bagbee will only pick up luggage the evening of the day before the flight, commenting this
  // out until
  const dayOfDeparture = bookingState.flightInformation.departureDate
  const isMorningFlight = bookingState.flightInformation.selectedFlight?.isMorningFlight

  /** Must match API input; using this for the query key avoids a duplicate fetch when departureDate and selectedFlight hydrate at different times (e.g. pick-up deep link). */
  const scheduledDeparture = bookingState.flightInformation.selectedFlight?.ScheduledDateTime
  // Postal code is part of the cache key so changing the address (e.g. from
  // 270 Mosfellsbær to 101 Reykjavík) refetches with the new postcode rule.
  // Empty string is fine here — server treats it as "no rule, capacity only".
  const postalCode = bookingState.pickupInformation.postalCode ?? ''

  // dayBeforeDeparture is used when the user has a morning flight and will get a bag pick up the day before his departure
  let dayBeforeDeparture: Date = new Date(bookingState.flightInformation.departureDate)
  dayBeforeDeparture.setDate(bookingState.flightInformation.departureDate.getDate() - 1)

  const { data, isPending } = useQuery({
    queryKey: ['available-pickup-times', scheduledDeparture, postalCode],
    enabled: Boolean(scheduledDeparture),
    queryFn: () =>
      fetch('/api/airtable/availability', {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({ departureDate: scheduledDeparture, postalCode }),
      })
        .then((res) => res.json())
        .catch(() => {
          toast.error(t.pickUpStep.errorLoadingAvailableTimes)
        }),
  })

  if (!scheduledDeparture || isPending) {
    return <LoadingContainer>{t.pickUpStep.loadingAvailableTimes}</LoadingContainer>
  }

  const isMorningSlotVisibleForDate = (pickupDay: Date) => {
    if (dayjs(pickupDay).isSame(dayjs(), 'day')) return false
    if (isMorningPickupPastBookingCutoff(pickupDay)) return false
    return true
  }

  // if morning flight, only show pick up slots available the day before departure, both morning and evening
  if (isMorningFlight) {
    return (
      <div>
        {isMorningSlotVisibleForDate(dayBeforeDeparture) && (
          <>
            <Label>{t.pickUpStep.morningPickUpGroupLabel}</Label>
            <AvailableTimesContainer>
              {pickupSlots.morningSlots.map((slot, i) => {
                const slotKey = `${dayjs(dayBeforeDeparture).format('YYYY-MM-DD')}/${slot}`
                const isDisabled = !data?.timeslots?.morningSlots?.[slotKey]
                return (
                  <PickUpTimeCard
                    index={i}
                    onClick={() => {
                      updatePickupDate(dayBeforeDeparture)
                      updatePickupSlot(slot)
                    }}
                    key={slot}
                    timeSlot={slot}
                    date={dayBeforeDeparture.toLocaleDateString()}
                    selected={bookingState.pickupInformation.pickupSlot === slot}
                    disabled={isDisabled}
                  />
                )
              })}
            </AvailableTimesContainer>
          </>
        )}
        <Label>{t.pickUpStep.eveningPickUpGroupLabel}</Label>
        <AvailableTimesContainer>
          {pickupSlots.eveningSlots.map((slot, i) => {
            const slotKey = `${dayjs(dayBeforeDeparture).format('YYYY-MM-DD')}/${slot}`
            const isDisabled = !data?.timeslots?.eveningSlots?.[slotKey]
            return (
              <PickUpTimeCard
                index={i}
                onClick={() => {
                  updatePickupDate(dayBeforeDeparture)
                  updatePickupSlot(slot)
                }}
                key={slot}
                timeSlot={slot}
                date={dayBeforeDeparture.toLocaleDateString()}
                selected={bookingState.pickupInformation.pickupSlot === slot}
                disabled={isDisabled}
              />
            )
          })}
        </AvailableTimesContainer>
      </div>
    )
  }
  // if evening flight, show evening pickups the day before departure and morning pickups the day of departure
  else
    return (
      <div>
        <Label>
          {t.pickUpStep.dayBeforeDeparture} ({dayBeforeDeparture.toLocaleDateString()})
        </Label>
        <AvailableTimesContainer>
          {pickupSlots.eveningSlots.map((slot, i) => {
            const slotKey = `${dayjs(dayBeforeDeparture).format('YYYY-MM-DD')}/${slot}`
            const isDisabled = !data?.timeslots?.eveningSlots?.[slotKey]
            return (
              <PickUpTimeCard
                index={i}
                onClick={() => {
                  updatePickupDate(dayBeforeDeparture)
                  updatePickupSlot(slot)
                }}
                key={slot}
                timeSlot={slot}
                date={dayBeforeDeparture.toLocaleDateString()}
                selected={bookingState.pickupInformation.pickupSlot === slot}
                disabled={isDisabled}
              />
            )
          })}
        </AvailableTimesContainer>
        {isMorningSlotVisibleForDate(dayOfDeparture) && (
          <>
            <Label>
              {t.pickUpStep.dayOfDeparture} (
              {bookingState.flightInformation.departureDate.toLocaleDateString()})
            </Label>
            <AvailableTimesContainer>
              {pickupSlots.morningSlots.map((slot, i) => {
                const slotKey = `${dayjs(dayOfDeparture).format('YYYY-MM-DD')}/${slot}`
                const isDisabled = !data?.timeslots?.morningSlots?.[slotKey]
                return (
                  <PickUpTimeCard
                    index={i}
                    onClick={() => {
                      updatePickupDate(dayOfDeparture)
                      updatePickupSlot(slot)
                    }}
                    key={slot}
                    timeSlot={slot}
                    date={dayOfDeparture.toLocaleDateString()}
                    selected={bookingState.pickupInformation.pickupSlot === slot}
                    disabled={isDisabled}
                  />
                )
              })}
            </AvailableTimesContainer>
          </>
        )}
      </div>
    )
}

export default AvailablePickupTimes
