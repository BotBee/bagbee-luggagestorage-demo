import { DayPicker, DateRange } from 'react-day-picker'
import styled from '@emotion/styled'
import 'react-day-picker/style.css'
import { nowInIceland } from '../../utils/icelandTime'

interface TransportCalendarProps {
  // ISO YYYY-MM-DD strings, kept in sync with the Zustand store so we don't
  // have to translate between Date objects across the form.
  pickupDate: string | null
  deliveryDate: string | null
  // eslint-disable-next-line no-unused-vars
  onChange: (pickupDate: string | null, deliveryDate: string | null) => void
  locale: 'en' | 'is'
  // Days closed for booking (YYYY-MM-DD), e.g. from the Airtable "Closed Dates"
  // table. Rendered disabled in the picker alongside the min/max bounds.
  disabledDates?: string[]
}

const Container = styled.div`
  display: flex;
  justify-content: center;
  padding: 8px 0 16px;
  .rdp-day_selected,
  .rdp-day_selected:focus-visible,
  .rdp-day_selected:hover {
    background-color: ${({ theme }) => theme.colors.yellow};
    color: white;
  }
  .rdp-day_range_middle {
    background-color: #fdf2d7;
    color: #12141d;
  }
`

const formatDate = (d: Date): string => {
  // Local YYYY-MM-DD — no UTC shift. Matches what we store in Zustand and
  // what the pricing engine expects. Using toISOString() would yield UTC and
  // off-by-one days for customers east of GMT (Iceland is GMT 365 days a year,
  // so it actually works there, but this avoids surprises if site is ever
  // visited from another timezone).
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const parseYmd = (s: string | null): Date | undefined => {
  if (!s) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return undefined
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? undefined : d
}

const TransportCalendar = ({
  pickupDate,
  deliveryDate,
  onChange,
  disabledDates,
}: TransportCalendarProps) => {
  // Same earliest-bookable rule as the regular booking flow:
  //   before 15:00 → tomorrow at the earliest
  //   after 15:00 → day after tomorrow
  // Driver operations need a buffer to dispatch. The cutoff runs on the
  // ICELAND clock, not the customer's browser clock.
  const now = nowInIceland()
  const minDate = new Date(
    now.year(),
    now.month(),
    now.date() + (now.hour() < 15 ? 1 : 2),
  )
  const oneYearFromNow = new Date(now.year() + 1, now.month(), now.date())

  // Staff-closed days (YYYY-MM-DD) → Date objects for the disabled matchers.
  const closedDays = (disabledDates || [])
    .map((s) => parseYmd(s))
    .filter((d): d is Date => !!d)

  const selected: DateRange | undefined = (() => {
    const from = parseYmd(pickupDate)
    const to = parseYmd(deliveryDate)
    if (!from && !to) return undefined
    return { from, to }
  })()

  const handleSelect = (range: DateRange | undefined) => {
    if (!range) {
      onChange(null, null)
      return
    }
    const fromStr = range.from ? formatDate(range.from) : null
    const toStr = range.to ? formatDate(range.to) : null
    onChange(fromStr, toStr)
  }

  return (
    <Container>
      <DayPicker
        mode="range"
        selected={selected}
        onSelect={handleSelect}
        defaultMonth={selected?.from || minDate}
        disabled={[{ before: minDate }, { after: oneYearFromNow }, ...closedDays]}
      />
    </Container>
  )
}

export default TransportCalendar
