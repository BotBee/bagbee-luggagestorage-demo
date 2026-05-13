import styled from '@emotion/styled'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FlightData } from '../../common/types'

type Direction = 'arrival' | 'departure'

interface Props {
  flightNumber: string
  date: string | null // YYYY-MM-DD — the leg's date (pickup for arrivals, delivery for departures)
  direction: Direction
  locale: 'en' | 'is'
  // Fires when a flight matches OR the customer commits a manual landing
  // time (we synthesize a FlightData with AODBFlightId=-1 for the latter
  // so the parent can treat both paths the same way — read EstimatedDateTime,
  // compute the time window).
  // eslint-disable-next-line no-unused-vars
  onMatch?: (flight: FlightData) => void
  // Fires when input is cleared, lookup errors, no flight matches, AND
  // manual mode isn't active either. Wipes the previously auto-filled
  // time window in the parent.
  onClear?: () => void
  // Suggestion clicks update the parent's flight-number state so the lookup
  // re-runs with the corrected value. e.g. customer types 'SK4788',
  // clicks the 'SK4787' suggestion → parent updates booking.pickupFlightNumber
  // → FlightLookup re-renders → real match fires onMatch.
  // eslint-disable-next-line no-unused-vars
  onChangeFlightNumber?: (newValue: string) => void
}

// Parse a user-entered flight number into airline IATA + numeric portion.
// Tolerant of spaces, dashes, lowercase — customers type it lots of ways.
// 'FI544' / 'fi 544' / 'FI-544' / 'fi544' all normalise to { airline: 'FI', number: '544' }.
// Partial input is also fine: 'FI' alone parses with number='' so suggestions
// can show every same-airline flight; 'FI5' parses with number='5' so the
// suggestion list narrows to FI flights whose number starts with 5.
// Returns null if the airline IATA portion is malformed.
const parseFlightNumber = (raw: string): { airline: string; number: string } | null => {
  const cleaned = raw.replace(/[\s-]+/g, '').toUpperCase()
  const m = /^([A-Z]{2,3})(\d{0,5})$/.exec(cleaned)
  if (!m) return null
  return { airline: m[1], number: m[2] }
}

// Build the date-range payload Azinq's airport API wants. Same trick as
// modules/isaviaAPI/api.ts — full UTC day, with timezone suffix.
const toIsoDayRange = (ymd: string): { start: string; end: string } | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const start = new Date(ymd + 'T00:00:00Z')
  const end = new Date(ymd + 'T23:59:59Z')
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null
  return {
    start: start.toISOString().split('.')[0] + '+00:00',
    end: end.toISOString().split('.')[0] + '+00:00',
  }
}

// Format ScheduledDateTime / EstimatedDateTime strings (e.g.
// '2026-06-23T09:35:00+00:00') for display as 'HH:MM' in Reykjavík time.
const fmtTime = (iso: string | undefined | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Atlantic/Reykjavik',
  })
}

const Wrap = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #f3f7f4;
  border: 1px solid #cde2d5;
  font-family: 'Poppins';
  font-size: 13px;
  line-height: 18px;
  color: #143b27;
`

const WrapMuted = styled(Wrap)`
  background: #f7f8fa;
  border-color: #e6e9ee;
  color: #6b7280;
`

const WrapWarn = styled(Wrap)`
  background: #fff8eb;
  border-color: #f4d199;
  color: #7a5400;
`

const Strong = styled.span`
  font-weight: 600;
  color: #0b0f1a;
`

const Delayed = styled.span`
  font-weight: 600;
  color: #b45309;
`

const Status = styled.span<{ $tone?: 'ok' | 'warn' | 'muted' }>`
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 99px;
  background: ${({ $tone }) =>
    $tone === 'warn' ? '#fde68a' : $tone === 'muted' ? '#e6e9ee' : '#d1fae5'};
  color: ${({ $tone }) =>
    $tone === 'warn' ? '#7a5400' : $tone === 'muted' ? '#4a5260' : '#065f46'};
`

const COPY = {
  en: {
    typeToSearch: 'Enter a flight number to look up the time.',
    pickDateFirst: {
      arrival: 'Pick a pick-up date so we know which day to search.',
      departure: 'Pick a delivery date so we know which day to search.',
    },
    searching: 'Looking up flight…',
    notFound:
      'No flight matching that number was found at KEF on this date. Double-check the number.',
    networkError:
      'Couldn’t reach the flight database. Your booking still works — we just can’t show the time right now.',
    fromTo: { arrival: 'from', departure: 'to' },
    scheduled: 'Scheduled',
    estimated: 'Estimated',
    onTime: 'On time',
    delayed: 'Delayed',
    early: 'Early',
    didYouMean: 'Did you mean:',
    enterManually: 'Or enter your landing time manually',
    manualLabel: 'Landing time',
    manualHelp: 'We’ll use this to build your pick-up window. Format: HH:MM.',
    manualBadge: 'Manual',
    cancelManual: 'Cancel',
  },
  is: {
    typeToSearch: 'Skráðu flugnúmer til að fletta upp tíma.',
    pickDateFirst: {
      arrival: 'Veldu dagsetningu fyrir sókn til að við vitum hvaða dag á að leita.',
      departure: 'Veldu dagsetningu fyrir afhendingu til að við vitum hvaða dag á að leita.',
    },
    searching: 'Leita að flugi…',
    notFound:
      'Ekkert flug með þessu númeri fannst á KEF á þessari dagsetningu. Athugaðu númerið.',
    networkError:
      'Náðum ekki sambandi við flugagrunninn. Bókunin virkar samt — við sjáum bara ekki tímann núna.',
    fromTo: { arrival: 'frá', departure: 'til' },
    scheduled: 'Áætlað',
    estimated: 'Endurmetið',
    onTime: 'Á áætlun',
    delayed: 'Seinkað',
    early: 'Á undan',
    didYouMean: 'Áttirðu við:',
    enterManually: 'Eða skráðu lendingartímann handvirkt',
    manualLabel: 'Lendingartími',
    manualHelp: 'Við notum þetta til að setja upp sækjugluggann. Snið: HH:MM.',
    manualBadge: 'Handvirkt',
    cancelManual: 'Hætta við',
  },
}

const NoMatchBox = styled.div`
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #fff8eb;
  border: 1px solid #f4d199;
  font-family: 'Poppins';
  font-size: 13px;
  line-height: 18px;
  color: #7a5400;
`

const SuggestionList = styled.div`
  display: grid;
  gap: 6px;
`

const SuggestionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  background: white;
  border: 1px solid #f4d199;
  font-family: 'Poppins';
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  color: #12141d;
  &:hover {
    background: #fef3c7;
  }
  strong {
    font-weight: 700;
    color: #0b0f1a;
  }
`

const ManualLink = styled.button`
  background: none;
  border: none;
  padding: 0;
  font-family: 'Poppins';
  font-size: 13px;
  color: #b45309;
  text-decoration: underline;
  cursor: pointer;
  text-align: left;
  width: fit-content;
  &:hover {
    color: #92400e;
  }
`

const ManualRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`

const ManualInput = styled.input`
  font-family: 'Poppins';
  font-size: 14px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #c8cdd6;
  width: 110px;
  color: #12141d;
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
  }
`

const ManualHelp = styled.div`
  font-size: 12px;
  color: #6b7280;
`

const FlightLookup = ({
  flightNumber,
  date,
  direction,
  locale,
  onMatch,
  onClear,
  onChangeFlightNumber,
}: Props) => {
  const t = COPY[locale]
  const parsed = useMemo(() => parseFlightNumber(flightNumber), [flightNumber])
  const azinqType = direction === 'arrival' ? 'A' : 'D'

  // Manual landing-time fallback state. Triggered by the "Enter manually"
  // link below the suggestions; resets whenever the flight number changes
  // or the lookup finds a real match (so it doesn't shadow good data).
  const [manualMode, setManualMode] = useState(false)
  const [manualTime, setManualTime] = useState('')

  // Only fire the query once we have both a parsed flight number AND a date.
  const enabled = !!parsed && !!date && toIsoDayRange(date) !== null

  const { data, isFetching, isError } = useQuery<FlightData[]>({
    queryKey: ['kef-flights', azinqType, date],
    queryFn: async () => {
      const range = toIsoDayRange(date!)
      if (!range) throw new Error('invalid date')
      const res = await fetch('/api/air-travel/get-flights', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          DepartureArrivalType: azinqType,
          ScheduledTimeStart: range.start,
          ScheduledTimeEnd: range.end,
        }),
      })
      if (!res.ok) throw new Error('flight lookup failed')
      const json = await res.json()
      return Array.isArray(json) ? json : []
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 min — KEF schedules don't change that fast
  })

  const stripZero = (s: string) => s.replace(/^0+/, '') || '0'
  const match: FlightData | undefined =
    parsed && data
      ? data.find(
          (f) =>
            (f.AirlineIATA || '').toUpperCase() === parsed.airline &&
            stripZero(f.FlightNumber || '') === stripZero(parsed.number),
        )
      : undefined

  // Same-airline suggestions when there's no exact number match. As the
  // customer types more digits the list narrows: 'FI' shows every Icelandair
  // flight that day, 'FI5' narrows to FI flights whose number starts with 5
  // (FI587, FI544, …), 'FI54' narrows further. Sorted by scheduled time and
  // capped at 8 so the dropdown stays scannable.
  const sameAirlineSuggestions: FlightData[] =
    parsed && data && !match
      ? data
          .filter((f) => (f.AirlineIATA || '').toUpperCase() === parsed.airline)
          .filter((f) =>
            parsed.number
              ? stripZero(f.FlightNumber || '').startsWith(stripZero(parsed.number))
              : true,
          )
          .sort((a, b) => (a.ScheduledDateTime || '').localeCompare(b.ScheduledDateTime || ''))
          .slice(0, 8)
      : []

  // Synthesize a "manual match" FlightData when the customer commits a manual
  // landing time. Same shape as a real AODB match so the parent can treat
  // both identically (read EstimatedDateTime → compute window). AODBFlightId
  // is -1 as a sentinel for "this didn't come from Azinq".
  const manualMatch: FlightData | null = (() => {
    if (!manualMode || !parsed || !date) return null
    const m = /^(\d{1,2}):(\d{2})$/.exec(manualTime.trim())
    if (!m) return null
    const h = Number(m[1])
    const mm = Number(m[2])
    if (h > 23 || mm > 59) return null
    const iso = `${date}T${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+00:00`
    return {
      AirlineIATA: parsed.airline,
      AirlineDesc: '',
      AODBFlightId: -1,
      DepartureArrivalType: azinqType,
      EstimatedDateTime: iso,
      FlightNumber: parsed.number,
      FlightStatus: null,
      FlightStatusDesc: null,
      OriginDestAirportDesc: '',
      OriginDestAirportIATA: '',
      ScheduledDateTime: iso,
    }
  })()

  const resolved: FlightData | null = match ?? manualMatch
  // Source key drives the onMatch/onClear callbacks — fire only when the
  // resolution changes, not on every render.
  const sourceKey = match
    ? `aodb:${match.AODBFlightId}`
    : manualMatch
      ? `manual:${manualMatch.ScheduledDateTime}`
      : null
  const lastSourceKey = useRef<string | null>(null)
  useEffect(() => {
    if (sourceKey === lastSourceKey.current) return
    lastSourceKey.current = sourceKey
    if (resolved) onMatch?.(resolved)
    else onClear?.()
    // The resolved object is stable for a given sourceKey; tracking the key
    // alone is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey])

  // Reset manual mode whenever the flight number string changes — typing a
  // new number means the customer is going back to the lookup path.
  const lastFlightNumber = useRef(flightNumber)
  useEffect(() => {
    if (flightNumber !== lastFlightNumber.current) {
      lastFlightNumber.current = flightNumber
      setManualMode(false)
      setManualTime('')
    }
  }, [flightNumber])

  // Empty input → nothing to render (the parent already shows the input).
  if (!flightNumber.trim()) return null
  if (!date) return <WrapMuted>{t.pickDateFirst[direction]}</WrapMuted>
  if (!parsed) return <WrapMuted>{t.typeToSearch}</WrapMuted>
  if (isFetching) return <WrapMuted>{t.searching}</WrapMuted>
  if (isError) return <WrapWarn>{t.networkError}</WrapWarn>

  // No real match yet — but maybe the customer entered a manual landing time?
  // Render that as a confirmed pill so they know the booking will use it.
  if (!match && manualMatch) {
    const manualHHMM = fmtTime(manualMatch.ScheduledDateTime)
    return (
      <Wrap>
        <Strong>
          {parsed.airline}
          {parsed.number}
        </Strong>
        <span>
          {t.scheduled} {manualHHMM}
        </span>
        <Status $tone="muted">{t.manualBadge}</Status>
        <ManualLink type="button" onClick={() => { setManualMode(false); setManualTime('') }}>
          {t.cancelManual}
        </ManualLink>
      </Wrap>
    )
  }

  // No real match, no manual — show "Did you mean" + manual fallback.
  if (!match) {
    return (
      <NoMatchBox>
        {/* When the customer has only typed the airline code (e.g. 'FI'),
            don't shame them with "no flight found" — they haven't finished
            typing yet. Just show the airline's flights as a picker. */}
        {parsed && parsed.number && <div>{t.notFound}</div>}
        {sameAirlineSuggestions.length > 0 && (
          <>
            <div>{t.didYouMean}</div>
            <SuggestionList>
              {sameAirlineSuggestions.map((f) => {
                const display = `${f.AirlineIATA}${stripZero(f.FlightNumber || '0')}`
                return (
                  <SuggestionButton
                    key={f.AODBFlightId}
                    type="button"
                    onClick={() => onChangeFlightNumber?.(display)}
                  >
                    <span>
                      <strong>{display}</strong>
                      {' — '}
                      {t.fromTo[direction]} {f.OriginDestAirportDesc || f.OriginDestAirportIATA}
                    </span>
                    <span>{fmtTime(f.ScheduledDateTime)}</span>
                  </SuggestionButton>
                )
              })}
            </SuggestionList>
          </>
        )}
        {!manualMode ? (
          <ManualLink type="button" onClick={() => setManualMode(true)}>
            {t.enterManually}
          </ManualLink>
        ) : (
          <ManualRow>
            <span>{t.manualLabel}:</span>
            <ManualInput
              type="time"
              value={manualTime}
              onChange={(e) => setManualTime(e.target.value)}
              aria-label={t.manualLabel}
            />
            <ManualLink type="button" onClick={() => { setManualMode(false); setManualTime('') }}>
              {t.cancelManual}
            </ManualLink>
            <ManualHelp>{t.manualHelp}</ManualHelp>
          </ManualRow>
        )}
      </NoMatchBox>
    )
  }

  const scheduled = fmtTime(match.ScheduledDateTime)
  const estimated = fmtTime(match.EstimatedDateTime)
  const isDelayed =
    !!match.EstimatedDateTime &&
    !!match.ScheduledDateTime &&
    new Date(match.EstimatedDateTime).getTime() >
      new Date(match.ScheduledDateTime).getTime() + 60 * 1000 // >1 min late
  const isEarly =
    !!match.EstimatedDateTime &&
    !!match.ScheduledDateTime &&
    new Date(match.EstimatedDateTime).getTime() <
      new Date(match.ScheduledDateTime).getTime() - 60 * 1000

  return (
    <Wrap>
      <Strong>
        {parsed.airline}
        {parsed.number}
      </Strong>
      <span>
        {t.fromTo[direction]} {match.OriginDestAirportDesc || match.OriginDestAirportIATA}
      </span>
      <span>
        {t.scheduled} {scheduled}
      </span>
      {estimated && estimated !== scheduled ? (
        <>
          <span>·</span>
          <Delayed>
            {t.estimated} {estimated}
          </Delayed>
        </>
      ) : null}
      <Status $tone={isDelayed ? 'warn' : isEarly ? 'muted' : 'ok'}>
        {isDelayed ? t.delayed : isEarly ? t.early : t.onTime}
      </Status>
    </Wrap>
  )
}

export default FlightLookup
