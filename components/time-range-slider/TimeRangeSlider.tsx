import styled from '@emotion/styled'
import React, { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { SliderConstraints } from '../../common/postalCodeConstraints'

const SLIDER_TEXT = {
  en: {
    selected: 'Selected',
    clickToSelect: 'Click to select this window',
    notAvailable: 'Not available',
    pickupBetween: 'Pickup between',
    pickupAnytime: 'BagBee can pick up anytime between',
    noPickup: 'No pickup time available. Please adjust the slider.',
  },
  is: {
    selected: 'Valið',
    clickToSelect: 'Smelltu til að velja þennan tímaramma',
    notAvailable: 'Ekki í boði',
    pickupBetween: 'Sótt á tímabilinu',
    pickupAnytime: 'BagBee getur sótt hvenær sem er á milli',
    noPickup: 'Enginn sóknartími í boði. Vinsamlegast stilltu sleðann.',
  },
}

interface TimeRangeSliderProps {
  // eslint-disable-next-line no-unused-vars
  onChange: (leftOffset: number, rightOffset: number) => void
  leftValue: number
  rightValue: number
  constraints: SliderConstraints
  startHour: number
  endHour: number
  disabled?: boolean
  onActivate?: () => void
}

const Wrapper = styled.div<{ disabled?: boolean; isActive?: boolean }>`
  margin: 16px 0;
  padding: 16px;
  border-radius: 20px;
  border: 2px solid
    ${({ isActive, disabled }) =>
      isActive ? '#f3ad3c' : disabled ? '#d0d0d0' : 'transparent'};
  background: ${({ isActive }) => (isActive ? '#fffaf0' : 'transparent')};
  opacity: ${({ disabled }) => (disabled ? 0.55 : 1)};
  filter: ${({ disabled }) => (disabled ? 'grayscale(60%)' : 'none')};
  transition: all 0.25s ease;
  cursor: ${({ disabled }) => (disabled ? 'pointer' : 'default')};
  position: relative;

  &:hover {
    ${({ disabled }) =>
      disabled
        ? `
      opacity: 0.75;
      filter: grayscale(30%);
      border-color: #e0c080;
    `
        : ''}
  }
`

const SelectPrompt = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 500;
  padding: 8px 20px;
  border-radius: 24px;
  z-index: 20;
  pointer-events: none;
  white-space: nowrap;
`

const SelectedBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #e37f2f;
  margin-bottom: 8px;
`

const BarContainer = styled.div`
  position: relative;
  width: 100%;
  height: 56px;
  cursor: pointer;
  touch-action: none;
  user-select: none;
`

const BarTrack = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #e0e0e0;
`

const UnavailableZoneLeft = styled.div<{ widthPercent: number }>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: ${({ widthPercent }) => widthPercent}%;
  background: repeating-linear-gradient(
    -45deg,
    #f0f0f0,
    #f0f0f0 6px,
    #e0e0e0 6px,
    #e0e0e0 12px
  );
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width 0.15s ease;
`

const UnavailableZoneRight = styled.div<{ widthPercent: number }>`
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: ${({ widthPercent }) => widthPercent}%;
  background: repeating-linear-gradient(
    -45deg,
    #f0f0f0,
    #f0f0f0 6px,
    #e0e0e0 6px,
    #e0e0e0 12px
  );
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width 0.15s ease;
`

const UnavailableLabel = styled.span<{ visible: boolean }>`
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: #999;
  opacity: ${({ visible }) => (visible ? 1 : 0)};
  white-space: nowrap;
  pointer-events: none;
`

const AvailableZone = styled.div<{ leftPercent: number; rightPercent: number }>`
  position: absolute;
  top: 0;
  left: ${({ leftPercent }) => leftPercent}%;
  right: ${({ rightPercent }) => rightPercent}%;
  height: 100%;
  background: linear-gradient(135deg, #f3ad3c 0%, #e37f2f 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: left 0.15s ease, right 0.15s ease;
`

const AvailableLabel = styled.span`
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: white;
  white-space: nowrap;
  pointer-events: none;
`

const DragHandle = styled.div<{ leftPercent: number; locked?: boolean }>`
  position: absolute;
  top: 50%;
  left: ${({ leftPercent }) => leftPercent}%;
  transform: translate(-50%, -50%);
  width: 28px;
  height: 28px;
  background: white;
  border: 3px solid #f3ad3c;
  border-radius: 50%;
  cursor: ${({ locked }) => (locked ? 'default' : 'grab')};
  z-index: 10;
  transition: left 0.15s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  opacity: ${({ locked }) => (locked ? 0.4 : 1)};

  &:active {
    cursor: ${({ locked }) => (locked ? 'default' : 'grabbing')};
    transform: translate(-50%, -50%)
      ${({ locked }) => (locked ? '' : 'scale(1.1)')};
  }

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 8px;
    background: #f3ad3c;
    border-radius: 50%;
  }
`

const HourMarkers = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  padding: 0 2px;
`

const HourLabel = styled.span`
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #696f79;
`

function formatHour(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function snapToHour(rawOffset: number): number {
  return Math.round(rawOffset)
}

const TimeRangeSlider: React.FC<TimeRangeSliderProps> = ({
  onChange,
  leftValue,
  rightValue,
  constraints,
  startHour,
  endHour,
  disabled,
  onActivate,
}) => {
  const router = useRouter()
  const st = router?.locale === 'en' ? SLIDER_TEXT.en : SLIDER_TEXT.is
  const totalHours = endHour - startHour
  const barRef = useRef<HTMLDivElement>(null)
  const [activeHandle, setActiveHandle] = useState<'left' | 'right' | null>(
    null
  )

  const getOffsetFromEvent = useCallback(
    (clientX: number): number => {
      if (!barRef.current) return 0
      const rect = barRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const percent = Math.max(0, Math.min(1, x / rect.width))
      return percent * totalHours
    },
    [totalHours]
  )

  const getClosestHandle = useCallback(
    (offset: number): 'left' | 'right' => {
      if (constraints.rightLocked) return 'left'
      const distToLeft = Math.abs(offset - leftValue)
      const distToRight = Math.abs(offset - rightValue)
      return distToLeft <= distToRight ? 'left' : 'right'
    },
    [constraints.rightLocked, leftValue, rightValue]
  )

  const clampLeft = useCallback(
    (raw: number): number => {
      const snapped = snapToHour(raw)
      const min = constraints.minLeft
      const max = Math.min(
        constraints.maxLeft,
        rightValue - constraints.minWindow
      )
      return Math.max(min, Math.min(max, snapped))
    },
    [constraints, rightValue]
  )

  const clampRight = useCallback(
    (raw: number): number => {
      if (constraints.rightLocked) return rightValue
      const snapped = snapToHour(raw)
      const min = Math.max(
        constraints.minRight,
        leftValue + constraints.minWindow
      )
      const max = constraints.maxRight
      return Math.max(min, Math.min(max, snapped))
    },
    [constraints, leftValue, rightValue]
  )

  const handleStart = useCallback(
    (clientX: number) => {
      if (disabled) {
        onActivate?.()
        return
      }
      const rawOffset = getOffsetFromEvent(clientX)
      const handle = getClosestHandle(rawOffset)
      setActiveHandle(handle)

      if (handle === 'left') {
        onChange(clampLeft(rawOffset), rightValue)
      } else {
        onChange(leftValue, clampRight(rawOffset))
      }
    },
    [
      disabled,
      onActivate,
      getOffsetFromEvent,
      getClosestHandle,
      clampLeft,
      clampRight,
      onChange,
      leftValue,
      rightValue,
    ]
  )

  const handleMove = useCallback(
    (clientX: number) => {
      if (disabled || !activeHandle) return
      const rawOffset = getOffsetFromEvent(clientX)

      if (activeHandle === 'left') {
        onChange(clampLeft(rawOffset), rightValue)
      } else {
        onChange(leftValue, clampRight(rawOffset))
      }
    },
    [
      disabled,
      activeHandle,
      getOffsetFromEvent,
      clampLeft,
      clampRight,
      onChange,
      leftValue,
      rightValue,
    ]
  )

  const handleEnd = useCallback(() => {
    setActiveHandle(null)
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      handleStart(e.clientX)
    },
    [handleStart]
  )
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => handleMove(e.clientX),
    [handleMove]
  )

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => handleStart(e.touches[0].clientX),
    [handleStart]
  )
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => handleMove(e.touches[0].clientX),
    [handleMove]
  )

  const leftPercent = (leftValue / totalHours) * 100
  const rightPercent = ((totalHours - rightValue) / totalHours) * 100
  const pickupStartHour = startHour + leftValue
  const pickupEndHour = startHour + rightValue
  const pickupStart = formatHour(pickupStartHour)
  const pickupEnd = formatHour(pickupEndHour)

  const hours = []
  for (let h = startHour; h <= endHour; h++) {
    hours.push(h)
  }

  const windowSize = rightValue - leftValue

  const isActive = !disabled

  return (
    <Wrapper
      disabled={disabled}
      isActive={isActive}
      onClick={disabled ? onActivate : undefined}
    >
      {isActive && (
        <SelectedBadge>
          <span>&#10003;</span> {st.selected}
        </SelectedBadge>
      )}
      <BarContainer
        ref={barRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEnd}
      >
        <BarTrack>
          {leftValue > 0 && (
            <UnavailableZoneLeft widthPercent={leftPercent}>
              <UnavailableLabel visible={leftPercent > 15}>
                {st.notAvailable}
              </UnavailableLabel>
            </UnavailableZoneLeft>
          )}
          <AvailableZone leftPercent={leftPercent} rightPercent={rightPercent}>
            <AvailableLabel>
              {pickupStart} - {pickupEnd}
            </AvailableLabel>
          </AvailableZone>
          {rightValue < totalHours && (
            <UnavailableZoneRight widthPercent={rightPercent}>
              <UnavailableLabel visible={rightPercent > 15}>
                Not available
              </UnavailableLabel>
            </UnavailableZoneRight>
          )}
        </BarTrack>
        {disabled && <SelectPrompt>{st.clickToSelect}</SelectPrompt>}
        {!disabled && (
          <>
            <DragHandle leftPercent={leftPercent} />
            <DragHandle
              leftPercent={100 - rightPercent}
              locked={constraints.rightLocked}
            />
          </>
        )}
      </BarContainer>

      <HourMarkers>
        {hours.map((h) => (
          <HourLabel key={h}>{formatHour(h)}</HourLabel>
        ))}
      </HourMarkers>

      {!disabled && (
        <div
          style={{
            marginTop: 12,
            fontFamily: "'Poppins', sans-serif",
            fontSize: 14,
            color: '#696f79',
            lineHeight: 1.5,
          }}
        >
          {windowSize <= 0 ? (
            <>{st.noPickup}</>
          ) : (
            <>
              {st.pickupBetween}{' '}
              <span style={{ fontWeight: 600, color: '#0b0a0f' }}>
                {pickupStart} - {pickupEnd}
              </span>
            </>
          )}
        </div>
      )}
    </Wrapper>
  )
}

export default TimeRangeSlider
