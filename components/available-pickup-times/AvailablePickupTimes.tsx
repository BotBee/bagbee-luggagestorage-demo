import styled from '@emotion/styled'
import { useRouter } from 'next/router'
import React, { useCallback, useEffect, useState } from 'react'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import {
  getSliderConstraints,
  getMorningConstraints,
  SliderConstraints,
} from '../../common/postalCodeConstraints'
import { useBookingStore } from '../../store/store'
import TimeRangeSlider from '../time-range-slider/TimeRangeSlider'

const MORNING_START = 9
const MORNING_END = 12
const MORNING_TOTAL = MORNING_END - MORNING_START

const EVENING_START = 17
const EVENING_END = 22
const EVENING_TOTAL = EVENING_END - EVENING_START

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

function formatHour(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function clampValues(
  left: number,
  right: number,
  c: SliderConstraints
): [number, number] {
  let newLeft = Math.max(c.minLeft, Math.min(c.maxLeft, left))
  let newRight = c.rightLocked
    ? c.maxRight
    : Math.max(c.minRight, Math.min(c.maxRight, right))
  if (newRight - newLeft < c.minWindow) {
    newRight = Math.min(newLeft + c.minWindow, c.maxRight)
  }
  if (newRight - newLeft < c.minWindow) {
    newLeft = Math.max(newRight - c.minWindow, c.minLeft)
  }
  return [newLeft, newRight]
}

const AvailablePickupTimes = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const bookingState = useBookingStore((state) => state.booking)
  const updatePickupDate = useBookingStore((state) => state.updatePickupDate)
  const updatePickupSlot = useBookingStore((state) => state.updatePickupSlot)

  const postalCode = bookingState.pickupInformation.postalCode
  const eveningConstraints = getSliderConstraints(postalCode)
  const morningConstraints = getMorningConstraints()

  const [activeWindow, setActiveWindow] = useState<
    'morning' | 'evening' | null
  >(null)

  // Evening slider state
  const [eveningLeft, setEveningLeft] = useState(0)
  const [eveningRight, setEveningRight] = useState(EVENING_TOTAL)

  // Morning slider state
  const [morningLeft, setMorningLeft] = useState(0)
  const [morningRight, setMorningRight] = useState(MORNING_TOTAL)

  // Clamp evening slider when postal code changes
  useEffect(() => {
    const c = getSliderConstraints(postalCode)
    const [newLeft, newRight] = clampValues(eveningLeft, eveningRight, c)
    setEveningLeft(newLeft)
    setEveningRight(newRight)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postalCode])

  const isMorningFlight =
    bookingState.flightInformation.selectedFlight?.isMorningFlight

  let dayBeforeDeparture: Date = new Date(
    bookingState.flightInformation.departureDate
  )
  dayBeforeDeparture.setDate(
    bookingState.flightInformation.departureDate.getDate() - 1
  )
  const dayOfDeparture = bookingState.flightInformation.departureDate

  const getPickupDate = useCallback(
    (window: 'morning' | 'evening') => {
      if (isMorningFlight) {
        // Morning flight: both morning and evening pickups are day before departure
        return dayBeforeDeparture
      }
      // Evening flight: evening = day before, morning = day of departure
      return window === 'evening' ? dayBeforeDeparture : dayOfDeparture
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMorningFlight, dayBeforeDeparture.getTime(), dayOfDeparture.getTime()]
  )

  const handleEveningChange = useCallback(
    (left: number, right: number) => {
      setEveningLeft(left)
      setEveningRight(right)
      const startHour = EVENING_START + left
      const endHour = EVENING_START + right
      if (startHour >= endHour) {
        updatePickupSlot('')
        return
      }
      const slot = `${formatHour(startHour)} - ${formatHour(endHour)}`
      updatePickupDate(getPickupDate('evening'))
      updatePickupSlot(slot)
    },
    [updatePickupDate, updatePickupSlot, getPickupDate]
  )

  const handleMorningChange = useCallback(
    (left: number, right: number) => {
      setMorningLeft(left)
      setMorningRight(right)
      const startHour = MORNING_START + left
      const endHour = MORNING_START + right
      if (startHour >= endHour) {
        updatePickupSlot('')
        return
      }
      const slot = `${formatHour(startHour)} - ${formatHour(endHour)}`
      updatePickupDate(getPickupDate('morning'))
      updatePickupSlot(slot)
    },
    [updatePickupDate, updatePickupSlot, getPickupDate]
  )

  const activateMorning = useCallback(() => {
    setActiveWindow('morning')
    // Update store with current morning slider values
    const startHour = MORNING_START + morningLeft
    const endHour = MORNING_START + morningRight
    const slot = `${formatHour(startHour)} - ${formatHour(endHour)}`
    updatePickupDate(getPickupDate('morning'))
    updatePickupSlot(slot)
  }, [
    morningLeft,
    morningRight,
    updatePickupDate,
    updatePickupSlot,
    getPickupDate,
  ])

  const activateEvening = useCallback(() => {
    setActiveWindow('evening')
    // Update store with current evening slider values
    const startHour = EVENING_START + eveningLeft
    const endHour = EVENING_START + eveningRight
    const slot = `${formatHour(startHour)} - ${formatHour(endHour)}`
    updatePickupDate(getPickupDate('evening'))
    updatePickupSlot(slot)
  }, [
    eveningLeft,
    eveningRight,
    updatePickupDate,
    updatePickupSlot,
    getPickupDate,
  ])

  const getMorningDateLabel = () => {
    if (isMorningFlight) {
      return `${t.pickUpStep.dayBeforeDeparture} (${dayBeforeDeparture.toLocaleDateString()})`
    }
    return `${t.pickUpStep.dayOfDeparture} (${dayOfDeparture.toLocaleDateString()})`
  }

  const getEveningDateLabel = () => {
    return `${t.pickUpStep.dayBeforeDeparture} (${dayBeforeDeparture.toLocaleDateString()})`
  }

  return (
    <div>
      <Label>
        {t.pickUpStep.morningPickUpGroupLabel} - {getMorningDateLabel()}
      </Label>
      <TimeRangeSlider
        startHour={MORNING_START}
        endHour={MORNING_END}
        leftValue={morningLeft}
        rightValue={morningRight}
        constraints={morningConstraints}
        disabled={activeWindow !== 'morning'}
        onActivate={activateMorning}
        onChange={handleMorningChange}
      />

      <Label>
        {t.pickUpStep.eveningPickUpGroupLabel} - {getEveningDateLabel()}
      </Label>
      <TimeRangeSlider
        startHour={EVENING_START}
        endHour={EVENING_END}
        leftValue={eveningLeft}
        rightValue={eveningRight}
        constraints={eveningConstraints}
        disabled={activeWindow !== 'evening'}
        onActivate={activateEvening}
        onChange={handleEveningChange}
      />
    </div>
  )
}

export default AvailablePickupTimes
