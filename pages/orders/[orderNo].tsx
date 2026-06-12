import styled from '@emotion/styled'
import { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import { NextSeo } from 'next-seo'
import Header from '../../components/header/Header'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { trackPurchase } from '../../utils/analytics'
import {
  usePlacesWidget,
  ReactGoogleAutocompleteProps,
} from 'react-google-autocomplete'
import TimeRangeSlider from '../../components/time-range-slider/TimeRangeSlider'
import { getMorningConstraints, getSliderConstraints } from '../../common/postalCodeConstraints'
import {
  DAY_STORAGE_BSI_SLOTS,
  isCruisePortAddress,
} from '../../common/transportConstants'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import { useBookingStore } from '../../store/store'
import { inIcelandTime } from '../../utils/icelandTime'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import CharterPassengerCard from '../../components/charter-passenger-card/CharterPassengerCard'
import { internalSecretHeaders } from '../../utils/internalApiAuth'

// Format a phone number for display.
// Defaults to Iceland (+354) when the number has no country code (most BagBee
// customers are local). Returns the international format ("+354 698 3808",
// "+1 415 555 2671") when parseable; falls back to the raw string otherwise.
const formatPhoneForDisplay = (raw: string | undefined | null): string => {
  if (!raw) return ''
  try {
    const parsed = parsePhoneNumberFromString(String(raw), 'IS')
    if (!parsed) return String(raw)
    return parsed.formatInternational()
  } catch {
    return String(raw)
  }
}

// --- Status types ---
type OrderStatus = 'Pending' | 'Confirmed' | 'Planned' | 'In Progress' | 'Delivered'

const STATUS_COLORS: Record<OrderStatus, string> = {
  Pending: '#A3A4A7',
  Confirmed: '#F3AD3C',
  Planned: '#3D7165',
  'In Progress': '#E37F2F',
  Delivered: '#3D7165',
}

// Status icons available for future use
// const STATUS_ICONS: Record<OrderStatus, string> = {
//   Pending: '&#9711;', Confirmed: '&#10003;', Planned: '&#128197;',
//   'In Progress': '&#128666;', Delivered: '&#10004;&#65039;',
// }

// --- Styled Components ---
const PageContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  padding-bottom: 80px;
`

const OrderTitle = styled.h1`
  font-family: 'Poppins', sans-serif;
  font-size: 28px;
  font-weight: 600;
  color: #000929;
  margin-bottom: 8px;
  @media (min-width: 768px) { font-size: 36px; }
`

const OrderSubtitle = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #a3a4a7;
  margin-bottom: 24px;
`

const Section = styled.section`
  margin-bottom: 32px;
`

const SectionTitle = styled.h2`
  font-family: 'Poppins', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: #000929;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`

const StatusCard = styled.div`
  background: white;
  border-radius: 20px;
  padding: 24px;
  border: 1px solid #e5e6eb;
`

const StatusBadge = styled.span<{ bgColor: string }>`
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: white;
  background: ${({ bgColor }) => bgColor};
`

// Status progress bar
const ProgressContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
  margin: 20px 0 24px;
`

const ProgressStep = styled.div<{ active: boolean; completed: boolean }>`
  flex: 1;
  text-align: center;
  position: relative;
`

const ProgressDot = styled.div<{ active: boolean; completed: boolean; color: string }>`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${({ completed, active, color }) => completed || active ? color : '#e5e6eb'};
  margin: 0 auto 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: white;
  position: relative;
  z-index: 2;
`

const ProgressLabel = styled.span<{ active: boolean }>`
  font-family: 'Poppins', sans-serif;
  font-size: 10px;
  color: ${({ active }) => active ? '#000929' : '#a3a4a7'};
  font-weight: ${({ active }) => active ? 600 : 400};
`

const ProgressLine = styled.div<{ filled: boolean }>`
  position: absolute;
  top: 14px;
  left: 50%;
  right: -50%;
  height: 3px;
  background: ${({ filled }) => filled ? '#3D7165' : '#e5e6eb'};
  z-index: 1;
`

const DetailGrid = styled.div`
  display: grid;
  gap: 12px;
  margin-top: 16px;
`

const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  &:last-child { border-bottom: none; }
`

const DetailLabel = styled.span`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #696f79;
`

const DetailValue = styled.span`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: #000929;
  /* Honor embedded newlines (hotel name on line 1, address on line 2) without
     forcing the column wider — pre-wrap collapses spaces normally but renders
     \n as a visible line break. */
  white-space: pre-wrap;
`

const MapContainer = styled.div`
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  height: 300px;
  iframe { width: 100%; height: 100%; border: none; }
`

const AddressText = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #696f79;
  margin-top: 8px;
  /* Hotel name on top line, street on next — same rationale as DetailValue. */
  white-space: pre-wrap;
`

const PhotoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
`

const PhotoCard = styled.div`
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  aspect-ratio: 1;
  cursor: pointer;
  transition: transform 0.2s ease;
  &:hover { transform: scale(1.02); }
  img { width: 100%; height: 100%; object-fit: cover; }
`

const LightboxOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  cursor: pointer;
  img { max-width: 90vw; max-height: 90vh; border-radius: 8px; object-fit: contain; }
`

const NotFound = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  gap: 16px;
`

const NotFoundTitle = styled.h1`
  font-family: 'Poppins', sans-serif;
  font-size: 48px;
  font-weight: 600;
  color: #000929;
`

const NotFoundText = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 16px;
  color: #696f79;
`

// Edit mode components
const EditSection = styled.div`
  background: #fffaf0;
  border: 2px solid #f3ad3c;
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 32px;
`

const EditTitle = styled.h3`
  font-family: 'Poppins', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: #000929;
  margin-bottom: 16px;
`

const EditRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f0e0c0;
  &:last-child { border-bottom: none; }
`

const EditLabel = styled.span`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #696f79;
`

const Counter = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`

const CounterButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid #f3ad3c;
  background: white;
  color: #f3ad3c;
  font-size: 20px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover { background: #fffaf0; }
  &:disabled { opacity: 0.3; cursor: default; }
`

const CounterValue = styled.span`
  font-family: 'Poppins', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: #000929;
  min-width: 24px;
  text-align: center;
`

const SubmitButton = styled.button`
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #f3ad3c 0%, #e37f2f 100%);
  color: white;
  font-family: 'Poppins', sans-serif;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 16px;
  transition: opacity 0.2s;
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.5; cursor: default; }
`

const SuccessMessage = styled.div`
  background: #f0faf5;
  border: 1px solid #3D7165;
  border-radius: 12px;
  padding: 16px;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #3D7165;
  text-align: center;
  margin-top: 16px;
`

const TimeWindowLabel = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  color: #696f79;
  margin-top: 8px;
  margin-bottom: 4px;
`

// Action cards grid (Fast-Track card, full-width)
const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
`

// Header row inside StatusCard (badge + compact edit button)
const StatusCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
`

const EditOrderLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #d0d0d8;
  border-radius: 20px;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #000929;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: #f5f5f7;
    border-color: #000929;
  }
`

// Subdued text-link style for cancellation — intentionally NOT a button to
// avoid competing with primary actions (Edit, Fast-Track). Customers who
// want to cancel will find it; casual browsers won't misclick.
const CancelOrderRow = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #efeff3;
`

const CancelOrderLink = styled.button`
  background: transparent;
  border: 0;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  color: #8a8a94;
  cursor: pointer;
  text-decoration: underline;
  padding: 4px 8px;
  &:hover {
    color: #c2313b;
  }
`

// Cancellation confirmation modal
const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
`

const ModalCard = styled.div`
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
`

const ModalTitle = styled.h3`
  font-family: 'Poppins', sans-serif;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #000929;
`

const ModalBody = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #454555;
  margin: 0 0 20px 0;
`

const ModalButtonRow = styled.div`
  display: flex;
  gap: 12px;
  flex-direction: column;
  @media (min-width: 480px) {
    flex-direction: row;
    justify-content: flex-end;
  }
`

const ModalPrimaryButton = styled.button<{ destructive?: boolean }>`
  padding: 12px 20px;
  border-radius: 12px;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 0;
  background: ${({ destructive }) => (destructive ? '#c2313b' : '#000929')};
  color: white;
  transition: opacity 0.15s;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const ModalSecondaryButton = styled.button`
  padding: 12px 20px;
  border-radius: 12px;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background: white;
  color: #000929;
  border: 1px solid #d0d0d8;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const ActionCard = styled.div<{ variant?: 'primary' | 'secondary' }>`
  background: ${({ variant }) =>
    variant === 'primary'
      ? 'linear-gradient(135deg, #fff8ee 0%, #fff1d6 100%)'
      : 'white'};
  border: 1px solid
    ${({ variant }) =>
      variant === 'primary' ? '#f3ad3c' : '#e5e6eb'};
  border-radius: 20px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
  }
`

const ActionIcon = styled.div<{ variant?: 'primary' | 'secondary' }>`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: ${({ variant }) =>
    variant === 'primary' ? '#f3ad3c' : '#f0f0f5'};
  color: ${({ variant }) => (variant === 'primary' ? 'white' : '#696f79')};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 600;
`

const ActionTitle = styled.h3`
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  font-size: 17px;
  color: #000929;
  margin: 0;
`

const ActionDescription = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  color: #696f79;
  line-height: 1.5;
  margin: 0;
  flex: 1;
`

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  width: 100%;
  padding: 12px 16px;
  border: ${({ variant }) =>
    variant === 'primary' ? 'none' : '1px solid #d0d0d8'};
  border-radius: 12px;
  background: ${({ variant }) =>
    variant === 'primary'
      ? 'linear-gradient(135deg, #f3ad3c 0%, #e37f2f 100%)'
      : 'white'};
  color: ${({ variant }) => (variant === 'primary' ? 'white' : '#000929')};
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.9;
    background: ${({ variant }) =>
      variant === 'primary'
        ? 'linear-gradient(135deg, #f3ad3c 0%, #e37f2f 100%)'
        : '#f5f5f7'};
  }
`

// Day-storage bag steppers — mirrors the public luggagestorage.tsx style.
const BagStepper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  border: 1px solid #e6e9ee;
  border-radius: 10px;
  background: #fbfbfd;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  width: fit-content;
`
const StepBtn = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1.5px solid ${({ disabled }: { disabled?: boolean }) => (disabled ? '#f4d199' : '#f3ad3c')};
  background: white;
  color: ${({ disabled }: { disabled?: boolean }) => (disabled ? '#f4d199' : '#f3ad3c')};
  font-size: 18px;
  font-weight: 500;
  line-height: 1;
  cursor: ${({ disabled }: { disabled?: boolean }) => (disabled ? 'default' : 'pointer')};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  &:hover {
    background: ${({ disabled }: { disabled?: boolean }) => (disabled ? 'white' : '#fff8ec')};
  }
`
const StepVal = styled.span`
  font-family: 'Poppins';
  font-weight: 700;
  font-size: 20px;
  min-width: 24px;
  text-align: center;
  color: #12141d;
`
const StepperHint = styled.div`
  font-family: 'Poppins';
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
`

// Tip section (English, post-Delivered)
const TipCard = styled.div`
  background: linear-gradient(135deg, #f0faf5 0%, #dff4e9 100%);
  border: 1px solid #3D7165;
  border-radius: 20px;
  padding: 24px;
`

const TipHeading = styled.h3`
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  font-size: 18px;
  color: #1D3C34;
  margin: 0 0 8px;
`

const TipSubtext = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #4a6b60;
  line-height: 1.5;
  margin: 0 0 16px;
`

const TipButtonGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
`

const TipButton = styled.button<{ selected?: boolean }>`
  padding: 12px 8px;
  border: 2px solid
    ${({ selected }) => (selected ? '#3D7165' : '#c2dbcf')};
  border-radius: 12px;
  background: ${({ selected }) => (selected ? '#3D7165' : 'white')};
  color: ${({ selected }) => (selected ? 'white' : '#1D3C34')};
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #3D7165;
  }
`

const TipInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #c2dbcf;
  border-radius: 12px;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: #3D7165;
  }
`

const TipSubmit = styled.button`
  width: 100%;
  padding: 14px 16px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #3D7165 0%, #1D3C34 100%);
  color: white;
  font-family: 'Poppins', sans-serif;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 12px;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`

// --- Types ---
type Photo = { url: string; filename: string; type: string; tagNumber?: string }
type OrderFields = { [key: string]: any }
type FastTrackPassenger = { firstName: string; lastName: string }
type FastTrackRecord = {
  id: string
  passengers: FastTrackPassenger[]
  flightDate: string | null
  paidAmount: number | null
}
// Derived server-side from the paid Fast-Track rows + today's date so the
// active/expired card renders identically on SSR and client (no hydration
// mismatch around midnight).
type FastTrackSummary = {
  state: 'active' | 'expired'
  flightDate: string | null
  passengers: FastTrackPassenger[]
}

interface OrderPageProps {
  order: { id: string; fields: OrderFields } | null
  photos: Photo[]
  orderNo: string
  scheduledAt: string | null
  fastTrackSummary: FastTrackSummary | null
}

const ALL_STATUSES: OrderStatus[] = ['Pending', 'Confirmed', 'Planned', 'In Progress', 'Delivered']

// P&D edit-form time slider. Spans 04:00 – 22:00 (18h) to cover early
// cruise-terminal pickups and late evening windows. minWindow=1 enforces
// the customer-facing rule: no tighter than a 1-hour window.
const PD_SLIDER_START = 4
const PD_SLIDER_END = 22
const PD_SLIDER_CONSTRAINTS = {
  minLeft: 0,
  maxLeft: 17,
  minRight: 1,
  maxRight: 18,
  rightLocked: false,
  minWindow: 1,
} as const

// Parse "HH:MM - HH:MM" (and minor variants) into slider offsets from
// PD_SLIDER_START, clamped to the slider range with a min 1-hour window.
// Floors the start and ceils the end so that sub-hour windows like
// "08:30 - 09:00" widen to "08:00 - 09:00" rather than collapsing.
function parsePdWindowToOffsets(s: string): { left: number; right: number } {
  const m = String(s || '').match(/(\d{1,2}):(\d{2})\s*-?\s*(\d{1,2}):(\d{2})/)
  if (!m) return { left: 5, right: 9 } // default 09:00 - 13:00
  const startH = parseInt(m[1], 10) + parseInt(m[2], 10) / 60
  const endH = parseInt(m[3], 10) + parseInt(m[4], 10) / 60
  let left = Math.floor(startH) - PD_SLIDER_START
  let right = Math.ceil(endH) - PD_SLIDER_START
  left = Math.max(0, Math.min(PD_SLIDER_CONSTRAINTS.maxLeft, left))
  right = Math.max(left + PD_SLIDER_CONSTRAINTS.minWindow,
                   Math.min(PD_SLIDER_CONSTRAINTS.maxRight, right))
  return { left, right }
}

function formatPdWindowFromOffsets(left: number, right: number): string {
  return `${formatHour(PD_SLIDER_START + left)} - ${formatHour(PD_SLIDER_START + right)}`
}

function formatHour(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// Format an Airtable date string (e.g. "2026-03-30" or "2026/03/30") as DD/MM/YYYY
function formatDate(input: any): string {
  if (!input) return 'N/A'
  const str = String(input)
  // Accept both YYYY-MM-DD and YYYY/MM/DD
  const match = str.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/)
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`
  }
  // Try parsing as a full ISO date
  const date = new Date(str)
  if (!isNaN(date.getTime())) {
    const dd = date.getDate().toString().padStart(2, '0')
    const mm = (date.getMonth() + 1).toString().padStart(2, '0')
    const yyyy = date.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }
  return str
}

// Format scheduled time with +/- 10 minute window. Rendered on the Iceland
// clock — the pickup happens in Iceland, and Airtable returns the dateTime
// as UTC ISO (= Iceland wall-clock); the browser's local clock would show
// a customer abroad the wrong window.
function formatEtaWindow(isoString: string | null): string | null {
  if (!isoString) return null
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return null
  const earlier = new Date(date.getTime() - 10 * 60 * 1000)
  const later = new Date(date.getTime() + 10 * 60 * 1000)
  const fmt = (d: Date) => inIcelandTime(d).format('HH:mm')
  return `${fmt(earlier)} - ${fmt(later)}`
}

// Active/expired confirmation card shown on the order page when the customer
// has already paid for Fast-Track. Green when active (through flight day),
// red the day after. Active state offers an "Add another passenger" link
// that re-opens the existing purchase form.
const FastTrackStatusCard = ({
  state,
  passengers,
  flightDate,
  t,
  onAddMore,
}: {
  state: 'active' | 'expired'
  passengers: FastTrackPassenger[]
  flightDate: string | null
  t: any
  onAddMore: () => void
}) => {
  const isActive = state === 'active'
  const dateStr = flightDate ? formatDate(flightDate) : ''
  const description = isActive
    ? t.fastTrackActiveDescription
    : String(t.fastTrackExpiredDescription).replace('{date}', dateStr)
  return (
    <div
      style={{
        background: isActive
          ? 'linear-gradient(135deg, #f0faf5 0%, #dff4e9 100%)'
          : 'linear-gradient(135deg, #fdf2f2 0%, #fadbdb 100%)',
        border: `1px solid ${isActive ? '#3D7165' : '#c33'}`,
        borderRadius: 20,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: isActive ? '#3D7165' : '#c33',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 600,
          }}
        >
          {isActive ? '✓' : '!'}
        </div>
        <div>
          <h3
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: 17,
              color: '#000929',
              margin: 0,
            }}
          >
            {isActive ? t.fastTrackActiveTitle : t.fastTrackExpiredTitle}
          </h3>
          {flightDate && (
            <p
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 13,
                color: isActive ? '#3D7165' : '#c33',
                margin: '2px 0 0',
                fontWeight: 500,
              }}
            >
              {String(t.fastTrackValidThrough).replace('{date}', dateStr)}
            </p>
          )}
        </div>
      </div>
      <p
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 13,
          color: '#696f79',
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {description}
      </p>
      {passengers.length > 0 && (
        <div
          style={{
            background: 'rgba(255,255,255,0.6)',
            borderRadius: 12,
            padding: 12,
          }}
        >
          <p
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 12,
              fontWeight: 600,
              color: '#696f79',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              margin: '0 0 6px',
            }}
          >
            {t.fastTrackPassengersLabel}
          </p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              color: '#000929',
            }}
          >
            {passengers.map((p, i) => (
              <li key={i} style={{ padding: '2px 0' }}>
                {`${p.firstName} ${p.lastName}`.trim()}
              </li>
            ))}
          </ul>
        </div>
      )}
      {isActive && (
        <button
          onClick={onAddMore}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '4px 0 0',
            color: '#e37f2f',
            fontFamily: 'Poppins, sans-serif',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'left',
            textDecoration: 'underline',
          }}
        >
          {t.fastTrackAddMore}
        </button>
      )}
    </div>
  )
}

// --- Component ---
const OrderPage = ({
  order,
  photos,
  orderNo,
  scheduledAt,
  fastTrackSummary,
}: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const router = useRouter()
  const t = (router.locale === 'en' ? en : is).orderTrackingPage
  const paymentSuccess = router.query.paid === 'true'
  const paymentError = router.query.error === 'true'
  const fastTrackPaid = router.query.fast_track_paid === 'true'
  const fastTrackError = router.query.fast_track_error === 'true'
  const dayStoragePaid = router.query.day_storage_paid === 'true'
  const dayStorageError = router.query.day_storage_error === 'true'

  // Booking is paid — drop the persisted booking-store snapshot so the
  // customer doesn't see a stale half-filled wizard if they come back to
  // /book days later. Successful baggage payments redirect straight here
  // via /orders/{code}?paid=true.
  useEffect(() => {
    if (paymentSuccess) {
      useBookingStore.persist.clearStorage()
    }
  }, [paymentSuccess])

  // Fire GA4 `purchase` event on successful payment landings.
  useEffect(() => {
    if (!order || !orderNo) return
    if (paymentSuccess || fastTrackPaid) {
      const amount = Number(order.fields?.['Upphæð']) || undefined
      const txId = `${orderNo}${fastTrackPaid ? '-ft' : ''}`
      trackPurchase(txId, amount != null ? { value: amount, items: [] } : undefined)
    }
  }, [paymentSuccess, fastTrackPaid, order, orderNo])

  // Lightbox tracks the index of the open photo so users can swipe / arrow
  // through the gallery. null = closed.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const lightboxTouchStartX = useRef<number | null>(null)
  const lightboxTouchStartY = useRef<number | null>(null)

  // Charter-flight passenger names (from Leiguflug, populated by the
  // CharterPassengerCard either from a previous submission or a fresh one).
  // Used to pre-fill the Fast-Track form so the customer doesn't have to
  // re-type every passenger.
  const [charterPassengers, setCharterPassengers] = useState<string[]>([])

  // Fast-Track state
  const [showFastTrack, setShowFastTrack] = useState(false)
  const [ftPassengers, setFtPassengers] = useState<
    Array<{ firstName: string; lastName: string }>
  >([{ firstName: '', lastName: '' }])
  const [ftSubmitting, setFtSubmitting] = useState(false)
  const [ftError, setFtError] = useState('')

  // Tip state
  const [tipPreset, setTipPreset] = useState<number | null>(null)
  const [tipCustom, setTipCustom] = useState('')
  const [tipSubmitting, setTipSubmitting] = useState(false)
  const tipPaid = router.query.tip_paid === 'true'
  const tipError = router.query.tip_error === 'true'

  // Cruise day-storage add-on state
  const [showDayStorage, setShowDayStorage] = useState(false)
  const [dsLarge, setDsLarge] = useState(1) // luggage items (suitcases/sports bags) @ 2000
  const [dsSmall, setDsSmall] = useState(0) // backpacks / purses @ 1500
  const [dsSlot, setDsSlot] = useState(DAY_STORAGE_BSI_SLOTS[0].value)
  const [dsSubmitting, setDsSubmitting] = useState(false)
  const [dsError, setDsError] = useState('')

  // Cancel-order state
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelResult, setCancelResult] = useState<
    null | { success: boolean; message: string }
  >(null)

  // Edit state
  const [editBags, setEditBags] = useState<number>(0)
  const [editOddSize, setEditOddSize] = useState<number>(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editSubmitted, setEditSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [editError, setEditError] = useState('')

  // "Add bags" affordance for orders past Confirmed — once the route is
  // Planned or the driver is In Progress, we don't want time/address changes
  // (they'd break dispatch), but customers regularly realise they have an
  // extra suitcase at the door and want to pay for it. Add-only counters
  // (regular + odd-size) → reuses /api/order/update Rapyd surcharge flow.
  const [showAddBags, setShowAddBags] = useState(false)
  const [addBagsExtra, setAddBagsExtra] = useState<number>(0)
  const [addOddSizeExtra, setAddOddSizeExtra] = useState<number>(0)
  const [addBagsSubmitting, setAddBagsSubmitting] = useState(false)
  const [addBagsError, setAddBagsError] = useState('')

  // Address edit state
  const [editAddress, setEditAddress] = useState<string>('')

  // P&D-only edit state
  const [editPickupDate, setEditPickupDate] = useState<string>('')
  const [editDeliveryAddress, setEditDeliveryAddress] = useState<string>('')
  const [editDeliveryDate, setEditDeliveryDate] = useState<string>('')
  // P&D time-window slider state (offsets in hours from PD_SLIDER_START=4)
  const [editPickupLeft, setEditPickupLeft] = useState<number>(5)
  const [editPickupRight, setEditPickupRight] = useState<number>(9)
  const [editDeliveryLeft, setEditDeliveryLeft] = useState<number>(5)
  const [editDeliveryRight, setEditDeliveryRight] = useState<number>(9)

  // Google Places autocomplete for address
  const { ref: addressRef } = usePlacesWidget<ReactGoogleAutocompleteProps>({
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    options: {
      types: ['geocode', 'establishment'],
      componentRestrictions: { country: 'is' },
    },
    onPlaceSelected: (place: any) => {
      setEditAddress(place.formatted_address ?? '')
    },
  })

  // Time window edit state
  const [editTimeWindow, setEditTimeWindow] = useState<string>('')
  const [morningLeft, setMorningLeft] = useState(0)
  const [morningRight, setMorningRight] = useState(3)
  const [eveningLeft, setEveningLeft] = useState(0)
  const [eveningRight, setEveningRight] = useState(5)
  const [activeWindow, setActiveWindow] = useState<'morning' | 'evening' | null>(null)

  const handleMorningChange = useCallback((left: number, right: number) => {
    setMorningLeft(left)
    setMorningRight(right)
    setActiveWindow('morning')
    setEditTimeWindow(`${formatHour(9 + left)} - ${formatHour(9 + right)}`)
  }, [])

  const handleEveningChange = useCallback((left: number, right: number) => {
    setEveningLeft(left)
    setEveningRight(right)
    setActiveWindow('evening')
    setEditTimeWindow(`${formatHour(17 + left)} - ${formatHour(17 + right)}`)
  }, [])

  if (!order) {
    return (
      <>
        <NextSeo title='BagBee | Order not found' />
        <Header hideNav />
        <PageContainer>
          <NotFound>
            <NotFoundTitle>{t.notFoundTitle}</NotFoundTitle>
            <NotFoundText>
              {t.notFoundText.replace('{orderNo}', orderNo)}
            </NotFoundText>
          </NotFound>
        </PageContainer>
      </>
    )
  }

  const fields = order.fields
  const rawStatus = fields['Order Status'] || fields['Status'] || 'Pending'
  const normalizedStatus =
    String(rawStatus).toLowerCase() === 'in progress'
      ? 'In Progress'
      : rawStatus
  // When user just paid (?paid=true in URL), the Rapyd webhook may not have
  // reached Airtable yet. Show Confirmed optimistically if status is still
  // Pending — the webhook will persist it moments later.
  const status = (
    paymentSuccess &&
    (normalizedStatus === 'Pending' || !normalizedStatus)
      ? 'Confirmed'
      : normalizedStatus
  ) as OrderStatus
  const statusIndex = ALL_STATUSES.indexOf(status)
  const statusColor = STATUS_COLORS[status] || '#A3A4A7'

  const isArrival = fields['Annað (comment)']?.includes('[ARRIVAL SERVICE]') || false
  const requestedServiceRaw = fields['Requested service']
  const requestedService =
    typeof requestedServiceRaw === 'string'
      ? requestedServiceRaw
      : requestedServiceRaw?.name || ''
  const isPickupDelivery = requestedService === 'Pickup & Delivery'
  const serviceType = isPickupDelivery
    ? t.pickupDeliveryService
    : isArrival
      ? t.arrivalService
      : t.departureService
  const isDelivered = status === 'Delivered'
  const isConfirmed = status === 'Confirmed'
  const isPlanned = status === 'Planned'
  // Raw Airtable values include both "In Progress" and "In progress" but
  // they're normalized to "In Progress" above (line 1078) before reaching us.
  const isInProgress = status === 'In Progress'
  const isBeforePickup = status === 'Pending' || status === 'Confirmed' || status === 'Planned'
  // Show the add-bags card on Planned + In Progress (Pending/Confirmed already
  // have the full Edit pill which covers bag changes). Delivered/Cancelled
  // are out — the operational window has closed.
  const canAddBagsAfterPlanning = isPlanned || isInProgress

  const deliveryAddress = fields['Delivery Address'] || ''
  const pickupAddress = fields['Heimilisfang'] || ''
  // Day-storage add-on is offered only to disembarkation passengers being
  // picked up at a cruise terminal. Check-in orders (Departure Service) store
  // the pickup location in `Short Address`, not `Heimilisfang` — match either.
  const isCruisePortPickup =
    isCruisePortAddress(String(pickupAddress)) ||
    isCruisePortAddress(String(fields['Short Address'] || ''))
  // No pickup fee (driver is already at the pier). Luggage items 2000 kr each
  // (dsLarge → API largeBags), backpacks/purses 1500 kr each (dsSmall →
  // smallBags). Total count capped at 10 across both.
  const dsTotalBags = dsLarge + dsSmall
  const dsTotal = dsLarge * 2000 + dsSmall * 1500
  const dsCanSubmit = dsTotalBags >= 1 && dsTotalBags <= 10 && !!dsSlot
  // `Hótel Nafn` is still written for the dispatcher's quick reference and
  // for legacy compatibility, but the customer-facing rendering reads the
  // hotel name straight out of the multi-line address string — no separate
  // hotelName variable needed here.

  // P&D: always show map; toggle pickup vs delivery at the moment of pickup
  // Other services: existing behaviour (Planned = pickup, Delivered = delivery)
  const showMap = isPickupDelivery ? true : (isDelivered || isPlanned)
  const showPickupOnMap = isPickupDelivery ? isBeforePickup : isPlanned

  // Transport bookings now write the address as a possibly-two-line string —
  // "Hotel name\nStreet, City, Country" when the leg is a hotel, or just
  // "Street, City, Country" otherwise. For the Google Maps embed query we
  // want the actual street line (Google geocodes brand names like '101
  // Hotel' to a generic place, but '101 Hotel\nHverfisgata 10' geocodes
  // cleanly because the comma-joined version is a real address).
  // For DISPLAY (the AddressText below the map), we keep both lines.
  const flattenForGeocode = (s: string): string =>
    s
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(', ')

  const mapAddress = showPickupOnMap
    ? pickupAddress
    : deliveryAddress || pickupAddress
  const displayMapAddress = showPickupOnMap
    ? pickupAddress
    : (deliveryAddress || pickupAddress)
  // Older bookings (pre-2026-05-14) stored a single-line "Hotel delivery —
  // 101 Hotel — ..." string with the leg's hotel name already inline, AND
  // duplicated the hotel name into `Hótel Nafn`. New bookings keep the
  // address line clean and rely on `Hótel Nafn` for the hotel signal. The
  // legacy prepend (` ${hotelName}, ${pickupAddress}` ) is what was causing
  // KEF → Hotel pickups to geocode to the hotel — dropped here.
  const mapHeading = showPickupOnMap ? t.pickupLocationTitle : t.deliveryLocationTitle

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  // Geocode query: Google handles "Hotel name, Street" better than a literal
  // newline. flattenForGeocode reduces "Hotel name\nStreet" to a single
  // comma-joined line that the embed URL can encode safely.
  const encodedAddress = encodeURIComponent(
    flattenForGeocode(displayMapAddress) || 'Keflavik Airport, Iceland',
  )
  // KEF terminal — Google's geocoded pin for "Flugstöð" lands slightly off; this
  // is the actual baggage-arrivals door we want the customer to see.
  const isFlugstodAddress = /flugst[öo]ð/i.test(displayMapAddress || '')
  const mapsEmbedUrl = isFlugstodAddress
    ? `https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=63.9961944%2C-22.6244167`
    : `https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${encodedAddress}`

  const originalBags = fields['Töskufjöldi_no'] || 0
  const originalOddSize = fields['Töskufjöldi_no_yfirstærð'] || 0
  const originalTimeWindow = fields['Tímasetning'] || ''

  // Parse existing time window to pre-set the slider
  const parseTimeWindow = (tw: string) => {
    const match = tw.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/)
    if (!match) return null
    const startH = parseInt(match[1])
    const endH = parseInt(match[3])
    return { startH, endH }
  }

  const originalAddress = fields['Heimilisfang'] || ''

  // Self-service cancellation is only allowed up to 24h before the pickup
  // window starts. Server-side enforcement lives in /api/order/cancel — this
  // flag drives the UI so we don't even surface the link inside the window.
  // Fail open when the date is missing (e.g. older orders): allow cancel.
  const cancelHoursUntilPickup = (() => {
    const pickupDateStr = String(fields['Dagsetning pick-up'] || '').trim()
    if (!pickupDateStr) return Infinity
    const m = String(fields['Tímasetning'] || '').match(/^(\d{1,2}):(\d{2})/)
    const hh = m ? m[1].padStart(2, '0') : '00'
    const mm = m ? m[2] : '00'
    const pickupAt = new Date(`${pickupDateStr}T${hh}:${mm}:00Z`)
    const hours = (pickupAt.getTime() - Date.now()) / 3_600_000
    return isNaN(hours) ? Infinity : hours
  })()
  // ≥24h before pickup → cancellation gets a full Rapyd refund.
  // <24h → cancel still allowed (the link stays visible) but no refund is
  // issued. The UI warns the customer before they confirm. The hard cutoff
  // for cancellation is the order's status, not the clock — see the
  // blocklist in the UI checks below and in /api/order/cancel.ts.
  const cancelHasRefund = cancelHoursUntilPickup >= 24

  const startEditing = () => {
    setEditBags(originalBags || 1)
    setEditOddSize(originalOddSize)
    setEditTimeWindow(originalTimeWindow)
    setEditAddress(originalAddress)
    setEditSubmitted(false)

    if (isPickupDelivery) {
      setEditPickupDate(String(fields['Dagsetning pick-up'] || ''))
      setEditDeliveryAddress(String(fields['Delivery Address'] || ''))
      setEditDeliveryDate(String(fields['Delivery date'] || ''))
      const pu = parsePdWindowToOffsets(originalTimeWindow)
      setEditPickupLeft(pu.left)
      setEditPickupRight(pu.right)
      const dv = parsePdWindowToOffsets(String(fields['Delivery Time-window'] || ''))
      setEditDeliveryLeft(dv.left)
      setEditDeliveryRight(dv.right)
    }

    // Pre-set the time slider to current selection
    const parsed = parseTimeWindow(originalTimeWindow)
    if (parsed) {
      if (parsed.startH >= 17) {
        // Evening window
        setActiveWindow('evening')
        setEveningLeft(parsed.startH - 17)
        setEveningRight(parsed.endH - 17)
        setMorningLeft(0)
        setMorningRight(3)
      } else if (parsed.startH >= 9 && parsed.startH < 13) {
        // Morning window
        setActiveWindow('morning')
        setMorningLeft(parsed.startH - 9)
        setMorningRight(parsed.endH - 9)
        setEveningLeft(0)
        setEveningRight(5)
      }
    } else {
      setActiveWindow(null)
    }

    setEditError('')
    setIsEditing(true)
  }

  // Calculate surcharge for display
  const extraBags = Math.max(0, editBags - originalBags)
  const extraOddSize = Math.max(0, editOddSize - originalOddSize)
  const surcharge = extraBags * 1990 + extraOddSize * 2490
  const hasBagChanges = editBags !== originalBags || editOddSize !== originalOddSize

  const submitUpdate = async () => {
    setSubmitting(true)
    setEditError('')
    try {
      // P&D uses its own time-range slider per leg; non-P&D uses the
      // morning/evening slider that writes into editTimeWindow.
      const pickupTimeWindowToSend = isPickupDelivery
        ? formatPdWindowFromOffsets(editPickupLeft, editPickupRight)
        : editTimeWindow
      const deliveryTimeWindowToSend = isPickupDelivery
        ? formatPdWindowFromOffsets(editDeliveryLeft, editDeliveryRight)
        : ''
      const originalDeliveryAddress = String(fields['Delivery Address'] || '')
      const originalPickupDate = String(fields['Dagsetning pick-up'] || '')
      const originalDeliveryDate = String(fields['Delivery date'] || '')
      const originalDeliveryTimeWindow = String(fields['Delivery Time-window'] || '')

      const response = await fetch('/api/order/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo,
          originalBags,
          originalOddSize,
          originalAmount: fields['Upphæð'] || 0,
          changes: {
            bags: editBags,
            oddSize: editOddSize,
            timeWindow: pickupTimeWindowToSend || undefined,
            address:
              editAddress && editAddress !== originalAddress
                ? editAddress
                : undefined,
            ...(isPickupDelivery && editPickupDate && editPickupDate !== originalPickupDate
              ? { pickupDate: editPickupDate }
              : {}),
            ...(isPickupDelivery &&
            editDeliveryAddress &&
            editDeliveryAddress !== originalDeliveryAddress
              ? { deliveryAddress: editDeliveryAddress }
              : {}),
            ...(isPickupDelivery &&
            editDeliveryDate &&
            editDeliveryDate !== originalDeliveryDate
              ? { deliveryDate: editDeliveryDate }
              : {}),
            ...(isPickupDelivery &&
            deliveryTimeWindowToSend &&
            deliveryTimeWindowToSend !== originalDeliveryTimeWindow
              ? { deliveryTimeWindow: deliveryTimeWindowToSend }
              : {}),
            originalAddress,
            originalTimeWindow,
          },
        }),
      })
      if (!response.ok) {
        throw new Error(`order update failed with status ${response.status}`)
      }
      const data = await response.json()

      if (data.paymentRequired && data.paymentUrl) {
        // Redirect to Rapyd payment page
        window.location.href = data.paymentUrl
        return
      }

      // Free update — show success
      setEditSubmitted(true)
      setIsEditing(false)
      setSubmitMessage(t.changesSaved)
    } catch {
      // Keep the edit form open and say it did NOT save — these are
      // dispatch-critical fields, a false "saved" means a missed pickup.
      setEditError(t.changesSaveFailed)
    }
    setSubmitting(false)
  }

  // --- Add-bags-only helpers (Planned + In Progress states) ---
  const addBagsSurcharge =
    addBagsExtra * 1990 + addOddSizeExtra * 2490
  const addBagsCanSubmit = addBagsExtra > 0 || addOddSizeExtra > 0

  const openAddBags = () => {
    setAddBagsExtra(0)
    setAddOddSizeExtra(0)
    setAddBagsError('')
    setShowAddBags(true)
  }

  const closeAddBags = () => {
    setShowAddBags(false)
    setAddBagsExtra(0)
    setAddOddSizeExtra(0)
    setAddBagsError('')
  }

  const submitAddBags = async () => {
    if (!addBagsCanSubmit) return
    setAddBagsSubmitting(true)
    setAddBagsError('')
    try {
      // Reuses the same Rapyd surcharge flow as the full edit. Send only the
      // bag deltas — no time/address fields — so the payment-success handler
      // updates bag counts without touching dispatch-critical fields.
      const response = await fetch('/api/order/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo,
          originalBags,
          originalOddSize,
          originalAmount: fields['Upphæð'] || 0,
          changes: {
            bags: originalBags + addBagsExtra,
            oddSize: originalOddSize + addOddSizeExtra,
          },
        }),
      })
      if (!response.ok) {
        throw new Error(`add-bags update failed with status ${response.status}`)
      }
      const data = await response.json()
      if (data.paymentRequired && data.paymentUrl) {
        window.location.href = data.paymentUrl
        return
      }
      // Shouldn't really happen — adding bags always has a surcharge — but
      // handle it gracefully by treating it as a success.
      setShowAddBags(false)
    } catch {
      setAddBagsError(t.addBagsError)
    }
    setAddBagsSubmitting(false)
  }

  // --- Fast-Track helpers ---
  const customerFirstName = String(fields['First Name (fx)'] || '')
  const customerLastName = String(fields['Last Name (fx)'] || '')

  // Splits a single full-name string (as collected by the charter card) into
  // the firstName/lastName shape the Fast-Track form expects. Treats the
  // last whitespace-separated token as the last name and everything before
  // as the first name(s) — works for typical Icelandic names like
  // "Kristín Fjola Gunnlaugsdóttir" → "Kristín Fjola" / "Gunnlaugsdóttir".
  const splitFullName = (full: string): { firstName: string; lastName: string } => {
    const parts = full.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return { firstName: '', lastName: '' }
    if (parts.length === 1) return { firstName: parts[0], lastName: '' }
    return {
      firstName: parts.slice(0, -1).join(' '),
      lastName: parts[parts.length - 1],
    }
  }

  const openFastTrack = () => {
    // Pre-fill passenger 1 with the main customer's name. If the charter
    // card already collected a passenger list (Leiguflug), pre-fill the
    // rest of the Fast-Track form with those names too — Fast-Track caps
    // at 4 passengers, so we slice. Each charter "Full name" gets split
    // into firstName/lastName via splitFullName above.
    const charterPrefilled = charterPassengers
      .slice(0, 4)
      .map((name) => splitFullName(name))

    const initialFt =
      charterPrefilled.length > 0
        ? charterPrefilled
        : [{ firstName: customerFirstName, lastName: customerLastName }]

    setFtPassengers(initialFt)
    setFtError('')
    setShowFastTrack(true)
  }

  const closeFastTrack = () => {
    setShowFastTrack(false)
    setFtError('')
  }

  const addFtPassenger = () => {
    if (ftPassengers.length >= 4) return
    setFtPassengers([...ftPassengers, { firstName: '', lastName: '' }])
  }

  const removeFtPassenger = (index: number) => {
    if (index === 0) return // Can't remove main passenger
    setFtPassengers(ftPassengers.filter((_, i) => i !== index))
  }

  const updateFtPassenger = (
    index: number,
    field: 'firstName' | 'lastName',
    value: string
  ) => {
    const updated = [...ftPassengers]
    updated[index] = { ...updated[index], [field]: value }
    setFtPassengers(updated)
  }

  const ftTotal = ftPassengers.length * 2490
  const ftCanSubmit = ftPassengers.every(
    (p) => p.firstName.trim() && p.lastName.trim()
  )

  const submitCancel = async () => {
    setCancelling(true)
    setCancelResult(null)
    try {
      const response = await fetch('/api/order/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNo }),
      })
      const data = await response.json()
      if (response.ok) {
        setCancelResult({
          success: true,
          message:
            data.lateCancel === true
              ? t.cancelOrder.successNoRefund
              : data.paymentCount === 0
                ? t.cancelOrder.successNoPayments
                : data.refundStatus === 'Refunded'
                  ? t.cancelOrder.successRefunded
                  : t.cancelOrder.successPartial,
        })
        // Give the user a moment to read the result, then reload so the UI
        // reflects the new Cancelled status from Airtable.
        setTimeout(() => {
          window.location.reload()
        }, 2500)
      } else {
        setCancelResult({
          success: false,
          message:
            data.message === 'tooLate'
              ? t.cancelOrder.tooLate
              : data.message || t.cancelOrder.error,
        })
      }
    } catch {
      setCancelResult({ success: false, message: t.cancelOrder.error })
    } finally {
      setCancelling(false)
    }
  }

  const submitFastTrack = async () => {
    if (!ftCanSubmit) return
    setFtSubmitting(true)
    setFtError('')
    try {
      const response = await fetch('/api/fast-track/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo,
          passengers: ftPassengers.map((p) => ({
            firstName: p.firstName.trim(),
            lastName: p.lastName.trim(),
          })),
          locale: router.locale || 'is',
        }),
      })
      const data = await response.json()

      if (response.ok && data.paymentUrl) {
        window.location.href = data.paymentUrl
        return
      }
      setFtError(t.fastTrackError)
    } catch {
      setFtError(t.fastTrackError)
    }
    setFtSubmitting(false)
  }

  const submitDayStorage = async () => {
    if (!dsCanSubmit) return
    setDsSubmitting(true)
    setDsError('')
    try {
      const response = await fetch('/api/day-storage/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo,
          smallBags: dsSmall,
          largeBags: dsLarge,
          bsiSlot: dsSlot,
          locale: router.locale || 'is',
        }),
      })
      const data = await response.json()
      if (response.ok && data.paymentUrl) {
        window.location.href = data.paymentUrl
        return
      }
      setDsError(t.dayStorageError)
    } catch {
      setDsError(t.dayStorageError)
    }
    setDsSubmitting(false)
  }

  // --- Tip helpers ---
  const effectiveTipAmount =
    tipPreset !== null ? tipPreset : parseInt(tipCustom, 10) || 0

  const submitTip = async () => {
    if (effectiveTipAmount < 100) return
    setTipSubmitting(true)
    try {
      const response = await fetch('/api/tip/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo,
          amount: effectiveTipAmount,
        }),
      })
      const data = await response.json()
      if (response.ok && data.paymentUrl) {
        window.location.href = data.paymentUrl
        return
      }
    } catch {
      // Fall through to error below
    }
    setTipSubmitting(false)
  }

  return (
    <>
      <NextSeo title={`BagBee | Order #${orderNo}`} />
      <Header hideNav />
      <PageContainer>
        {/* Payment result banners */}
        {paymentSuccess && (
          <SuccessMessage style={{ marginBottom: 24 }}>
            {t.paymentSuccess}
          </SuccessMessage>
        )}
        {paymentError && (
          <div style={{
            background: '#fff0f0', border: '1px solid #e55', borderRadius: 12,
            padding: 16, fontFamily: 'Poppins', fontSize: 14, color: '#c33',
            textAlign: 'center', marginBottom: 24,
          }}>
            {t.paymentError}
          </div>
        )}
        {fastTrackPaid && (
          <SuccessMessage style={{ marginBottom: 24 }}>
            {t.fastTrackSuccess}
          </SuccessMessage>
        )}
        {fastTrackError && (
          <div style={{
            background: '#fff0f0', border: '1px solid #e55', borderRadius: 12,
            padding: 16, fontFamily: 'Poppins', fontSize: 14, color: '#c33',
            textAlign: 'center', marginBottom: 24,
          }}>
            {t.fastTrackError}
          </div>
        )}
        {tipPaid && router.locale === 'en' && (
          <SuccessMessage style={{ marginBottom: 24 }}>
            {t.tipSuccess}
          </SuccessMessage>
        )}
        {tipError && router.locale === 'en' && (
          <div style={{
            background: '#fff0f0', border: '1px solid #e55', borderRadius: 12,
            padding: 16, fontFamily: 'Poppins', fontSize: 14, color: '#c33',
            textAlign: 'center', marginBottom: 24,
          }}>
            {t.tipError}
          </div>
        )}
        {dayStoragePaid && (
          <SuccessMessage style={{ marginBottom: 24 }}>
            {t.dayStorageSuccess}
          </SuccessMessage>
        )}
        {dayStorageError && (
          <div style={{
            background: '#fff0f0', border: '1px solid #e55', borderRadius: 12,
            padding: 16, fontFamily: 'Poppins', fontSize: 14, color: '#c33',
            textAlign: 'center', marginBottom: 24,
          }}>
            {t.dayStorageError}
          </div>
        )}

        <OrderTitle>{t.orderLabel} #{orderNo}</OrderTitle>
        <OrderSubtitle>BagBee {serviceType}</OrderSubtitle>

        {/* Status Progress Bar */}
        <Section>
          <ProgressContainer>
            {ALL_STATUSES.map((s, i) => {
              // When the order is Delivered (final state), the Afhent circle
              // also shows a checkmark \u2014 the journey is finished.
              const isFinalDelivered = status === 'Delivered'
              const completed = isFinalDelivered ? i <= statusIndex : i < statusIndex
              const active = i === statusIndex
              return (
                <ProgressStep key={s} active={active} completed={completed}>
                  {i < ALL_STATUSES.length - 1 && (
                    <ProgressLine filled={completed} />
                  )}
                  <ProgressDot
                    active={active}
                    completed={completed}
                    color={active ? statusColor : '#3D7165'}
                  >
                    {completed ? '\u2713' : ''}
                  </ProgressDot>
                  <ProgressLabel active={active}>{t.status[s] || s}</ProgressLabel>
                </ProgressStep>
              )
            })}
          </ProgressContainer>
        </Section>

        {/* Charter-flight passenger collection. Only renders when the flight
            number matches Icelandair's leiguflug pattern (FI1 + 3 digits,
            e.g. FI1080). BagBee needs every passenger's name in the party
            to perform the airline-side check-in via Amadeus. Replaces the
            legacy email→Fillout-form flow. */}
        {(() => {
          const flightNumber = (fields['Flugnúmer'] as string) || ''
          if (!/^FI1\d{3}$/.test(flightNumber)) return null
          return (
            <CharterPassengerCard
              recordId={order.id}
              flightNumber={flightNumber}
              customerName={(fields['Nafn viðskiptavinar'] as string) || ''}
              locale={router.locale ?? 'is'}
              onPassengersAvailable={setCharterPassengers}
            />
          )
        })()}

        {/* Order Details */}
        {isPickupDelivery ? (
          <>
            {/* Client information */}
            <Section style={{ marginBottom: 12 }}>
              <SectionTitle>{t.clientInfoTitle}</SectionTitle>
              <StatusCard>
                <StatusCardHeader>
                  <StatusBadge bgColor={statusColor}>
                    {t.status[status as OrderStatus] || status}
                  </StatusBadge>
                  {isConfirmed && !isEditing && !editSubmitted && (
                    <EditOrderLink onClick={startEditing}>
                      <span>&#9998;</span> {t.editOrder}
                    </EditOrderLink>
                  )}
                </StatusCardHeader>
                <DetailGrid>
                  <DetailRow>
                    <DetailLabel>{t.customer}</DetailLabel>
                    <DetailValue>{fields['Nafn viðskiptavinar'] || 'N/A'}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>{t.email}</DetailLabel>
                    <DetailValue>{fields['Tölvupóstfang'] || 'N/A'}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>{t.phone}</DetailLabel>
                    <DetailValue>
                      {fields['Símanúmer']
                        ? formatPhoneForDisplay(fields['Símanúmer'])
                        : 'N/A'}
                    </DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>{t.bags}</DetailLabel>
                    <DetailValue>
                      {fields['Töskufjöldi_no'] || 0} {t.standardSuffix}
                      {fields['Töskufjöldi_no_yfirstærð'] > 0 &&
                        ` + ${fields['Töskufjöldi_no_yfirstærð']} ${t.oddSizeSuffix}`}
                    </DetailValue>
                  </DetailRow>
                </DetailGrid>

                {!isEditing &&
                  !editSubmitted &&
                  !['Planned', 'In progress', 'In Progress', 'Delivered', 'Cancelled'].includes(
                    status as string,
                  ) && (
                    <>
                      <CancelOrderRow>
                        <CancelOrderLink
                          onClick={() => {
                            setCancelResult(null)
                            setShowCancelModal(true)
                          }}
                        >
                          {t.cancelOrder.linkText}
                        </CancelOrderLink>
                      </CancelOrderRow>
                      {!cancelHasRefund && (
                        <p
                          style={{
                            fontFamily: 'Poppins, sans-serif',
                            fontSize: 12,
                            color: '#a3a4a7',
                            textAlign: 'center',
                            marginTop: 8,
                            marginBottom: 0,
                          }}
                        >
                          {t.cancelOrder.noRefund}
                        </p>
                      )}
                    </>
                  )}
              </StatusCard>
            </Section>

            {/* Pickup information — heading inside the card for a tighter feel */}
            <Section style={{ marginBottom: 12 }}>
              <StatusCard>
                <h3 style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#000929',
                  margin: '0 0 16px',
                }}>
                  {t.pickupInfoTitle}
                </h3>
                <DetailGrid>
                  <DetailRow>
                    <DetailLabel>{t.pickupAddress}</DetailLabel>
                    <DetailValue>{fields['Heimilisfang'] || 'N/A'}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>{t.pickupDate}</DetailLabel>
                    <DetailValue>{formatDate(fields['Dagsetning pick-up'])}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>{t.pickupWindow}</DetailLabel>
                    <DetailValue>{fields['Tímasetning'] || 'N/A'}</DetailValue>
                  </DetailRow>
                </DetailGrid>
              </StatusCard>
            </Section>

            {/* Delivery information — heading inside the card */}
            <Section>
              <StatusCard>
                <h3 style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#000929',
                  margin: '0 0 16px',
                }}>
                  {t.deliveryInfoTitle}
                </h3>
                <DetailGrid>
                  <DetailRow>
                    <DetailLabel>{t.deliveryAddress}</DetailLabel>
                    <DetailValue>{fields['Delivery Address'] || 'N/A'}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>{t.deliveryDate}</DetailLabel>
                    <DetailValue>{formatDate(fields['Delivery date'])}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>{t.deliveryWindow}</DetailLabel>
                    <DetailValue>{fields['Delivery Time-window'] || 'N/A'}</DetailValue>
                  </DetailRow>
                </DetailGrid>
              </StatusCard>
            </Section>
          </>
        ) : (
          <Section>
            <SectionTitle>{t.orderDetailsTitle}</SectionTitle>
            <StatusCard>
              <StatusCardHeader>
                <StatusBadge bgColor={statusColor}>
                  {t.status[status as OrderStatus] || status}
                </StatusBadge>
                {isConfirmed && !isEditing && !editSubmitted && (
                  <EditOrderLink onClick={startEditing}>
                    <span>&#9998;</span> {t.editOrder}
                  </EditOrderLink>
                )}
              </StatusCardHeader>
              <DetailGrid>
                <DetailRow>
                  <DetailLabel>{t.customer}</DetailLabel>
                  <DetailValue>{fields['Nafn viðskiptavinar'] || 'N/A'}</DetailValue>
                </DetailRow>
                {fields['Short Address'] && (
                  <DetailRow>
                    <DetailLabel>{t.address}</DetailLabel>
                    <DetailValue>{fields['Short Address']}</DetailValue>
                  </DetailRow>
                )}
                <DetailRow>
                  <DetailLabel>{t.phone}</DetailLabel>
                  <DetailValue>
                    {fields['Símanúmer']
                      ? formatPhoneForDisplay(fields['Símanúmer'])
                      : 'N/A'}
                  </DetailValue>
                </DetailRow>
                <DetailRow>
                  <DetailLabel>{t.pickupDate}</DetailLabel>
                  <DetailValue>{formatDate(fields['Dagsetning pick-up'])}</DetailValue>
                </DetailRow>
                {fields['Tímasetning'] && (
                  <DetailRow>
                    <DetailLabel>{isArrival ? t.deliveryWindow : t.pickupWindow}</DetailLabel>
                    <DetailValue>{fields['Tímasetning']}</DetailValue>
                  </DetailRow>
                )}
                <DetailRow>
                  <DetailLabel>{t.bags}</DetailLabel>
                  <DetailValue>
                    {fields['Töskufjöldi_no'] || 0} {t.standardSuffix}
                    {fields['Töskufjöldi_no_yfirstærð'] > 0 &&
                      ` + ${fields['Töskufjöldi_no_yfirstærð']} ${t.oddSizeSuffix}`}
                  </DetailValue>
                </DetailRow>
                <DetailRow>
                  <DetailLabel>{t.flightDate}</DetailLabel>
                  <DetailValue>{formatDate(fields['Dagsetning flugs'])}</DetailValue>
                </DetailRow>
                <DetailRow>
                  <DetailLabel>{t.airline}</DetailLabel>
                  <DetailValue>{fields['Flugfélag'] || 'N/A'}</DetailValue>
                </DetailRow>
                <DetailRow>
                  <DetailLabel>{t.flight}</DetailLabel>
                  <DetailValue>{fields['Flugnúmer'] || 'N/A'}</DetailValue>
                </DetailRow>
              </DetailGrid>

              {/* Cancel order — subdued link; only shown when cancellation is
                  still actionable (not In progress / Delivered / Cancelled). */}
              {!isEditing &&
                !editSubmitted &&
                !['Planned', 'In progress', 'In Progress', 'Delivered', 'Cancelled'].includes(
                  status as string,
                ) && (
                  <>
                    <CancelOrderRow>
                      <CancelOrderLink
                        onClick={() => {
                          setCancelResult(null)
                          setShowCancelModal(true)
                        }}
                      >
                        {t.cancelOrder.linkText}
                      </CancelOrderLink>
                    </CancelOrderRow>
                    {!cancelHasRefund && (
                      <p
                        style={{
                          fontFamily: 'Poppins, sans-serif',
                          fontSize: 12,
                          color: '#a3a4a7',
                          textAlign: 'center',
                          marginTop: 8,
                          marginBottom: 0,
                        }}
                      >
                        {t.cancelOrder.noRefund}
                      </p>
                    )}
                  </>
                )}
            </StatusCard>
          </Section>
        )}

        {/* Add bags — visible on Planned + In Progress so a customer can pay
            for an extra suitcase right up until the driver leaves their hands.
            (Pending/Confirmed already have the full Edit pill that covers bag
            changes alongside time/address.) */}
        {canAddBagsAfterPlanning && !isEditing && !showAddBags && (
          <ActionGrid>
            <ActionCard variant='primary'>
              <ActionIcon variant='primary'>+</ActionIcon>
              <ActionTitle>{t.addBagsTitle}</ActionTitle>
              <ActionDescription>{t.addBagsDescription}</ActionDescription>
              <ActionButton variant='primary' onClick={openAddBags}>
                {t.addBagsOpenButton}
              </ActionButton>
            </ActionCard>
          </ActionGrid>
        )}
        {canAddBagsAfterPlanning && !isEditing && showAddBags && (
          <Section>
            <EditSection>
              <EditTitle>{t.addBagsSectionTitle}</EditTitle>
              <p
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 13,
                  color: '#696f79',
                  margin: '0 0 16px',
                  lineHeight: 1.5,
                }}
              >
                {String(t.addBagsCurrentBags)
                  .replace('{regular}', String(originalBags))
                  .replace('{oddsize}', String(originalOddSize))}
              </p>

              {/* Regular bags counter */}
              <div style={{ marginBottom: 12 }}>
                <TimeWindowLabel>{t.addBagsRegularLabel}</TimeWindowLabel>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 16px',
                    border: '1px solid #e5e6eb',
                    borderRadius: 12,
                  }}
                >
                  <button
                    type='button'
                    onClick={() => setAddBagsExtra(Math.max(0, addBagsExtra - 1))}
                    disabled={addBagsExtra === 0}
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      border: '1px solid #e5e6eb', background: '#fafafa',
                      fontSize: 18, fontWeight: 600, color: '#000929',
                      cursor: addBagsExtra === 0 ? 'not-allowed' : 'pointer',
                      opacity: addBagsExtra === 0 ? 0.4 : 1,
                    }}
                  >−</button>
                  <span style={{
                    flex: 1, textAlign: 'center', fontFamily: 'Poppins, sans-serif',
                    fontSize: 16, fontWeight: 600, color: '#000929',
                  }}>+{addBagsExtra}</span>
                  <button
                    type='button'
                    onClick={() => setAddBagsExtra(addBagsExtra + 1)}
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      border: 'none',
                      background: 'linear-gradient(135deg, #f3ad3c 0%, #e37f2f 100%)',
                      fontSize: 18, fontWeight: 600, color: 'white', cursor: 'pointer',
                    }}
                  >+</button>
                </div>
              </div>

              {/* Odd-size bags counter */}
              <div style={{ marginBottom: 12 }}>
                <TimeWindowLabel>{t.addBagsOddSizeLabel}</TimeWindowLabel>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 16px',
                    border: '1px solid #e5e6eb',
                    borderRadius: 12,
                  }}
                >
                  <button
                    type='button'
                    onClick={() => setAddOddSizeExtra(Math.max(0, addOddSizeExtra - 1))}
                    disabled={addOddSizeExtra === 0}
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      border: '1px solid #e5e6eb', background: '#fafafa',
                      fontSize: 18, fontWeight: 600, color: '#000929',
                      cursor: addOddSizeExtra === 0 ? 'not-allowed' : 'pointer',
                      opacity: addOddSizeExtra === 0 ? 0.4 : 1,
                    }}
                  >−</button>
                  <span style={{
                    flex: 1, textAlign: 'center', fontFamily: 'Poppins, sans-serif',
                    fontSize: 16, fontWeight: 600, color: '#000929',
                  }}>+{addOddSizeExtra}</span>
                  <button
                    type='button'
                    onClick={() => setAddOddSizeExtra(addOddSizeExtra + 1)}
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      border: 'none',
                      background: 'linear-gradient(135deg, #f3ad3c 0%, #e37f2f 100%)',
                      fontSize: 18, fontWeight: 600, color: 'white', cursor: 'pointer',
                    }}
                  >+</button>
                </div>
              </div>

              <div
                style={{
                  background: '#fff8ee',
                  border: '1px solid #f3ad3c',
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                  textAlign: 'center',
                }}
              >
                <p style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 14, color: '#000929', margin: 0,
                }}>
                  {t.addBagsTotal}: <strong>{addBagsSurcharge.toLocaleString()} kr</strong>
                </p>
                <p style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 12, color: '#696f79', margin: '4px 0 0',
                }}>
                  {addBagsExtra > 0 && `${addBagsExtra} × 1,990 kr`}
                  {addBagsExtra > 0 && addOddSizeExtra > 0 && '  +  '}
                  {addOddSizeExtra > 0 && `${addOddSizeExtra} × 2,490 kr`}
                </p>
              </div>

              {addBagsError && (
                <p style={{
                  color: '#c33', fontFamily: 'Poppins, sans-serif',
                  fontSize: 13, marginTop: 12, textAlign: 'center',
                }}>
                  {addBagsError}
                </p>
              )}

              <SubmitButton
                onClick={submitAddBags}
                disabled={addBagsSubmitting || !addBagsCanSubmit}
              >
                {addBagsSubmitting
                  ? t.fastTrackProcessing
                  : t.addBagsPay.replace(
                      '{amount}',
                      addBagsSurcharge.toLocaleString(),
                    )}
              </SubmitButton>

              <button
                onClick={closeAddBags}
                disabled={addBagsSubmitting}
                style={{
                  width: '100%', marginTop: 8, padding: 12,
                  background: 'transparent', border: 'none',
                  color: '#696f79', fontFamily: 'Poppins, sans-serif',
                  fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                {t.addBagsCancel}
              </button>
            </EditSection>
          </Section>
        )}

        {/* Fast-Track — collapsed promo OR expanded form, in the same slot
            so opening the form replaces the card in place (not below the bag photos) */}
        {/* Fast-Track is hidden only while the customer is actively in the
            order-edit form (focus reasons) — NOT after the edit has been
            submitted. Previously `!editSubmitted` was in the gate, which
            silently removed Fast-Track for the rest of the order's life
            once the customer had ever updated bag count / time window. */}
        {!isEditing && isCruisePortPickup && !showDayStorage && (
          <ActionGrid>
            <ActionCard variant='primary'>
              <ActionIcon variant='primary'>🧳</ActionIcon>
              <ActionTitle>{t.dayStorageTitle}</ActionTitle>
              <ActionDescription>{t.dayStorageDescription}</ActionDescription>
              <ActionButton variant='primary' onClick={() => setShowDayStorage(true)}>
                {t.dayStorageOpenButton}
              </ActionButton>
            </ActionCard>
          </ActionGrid>
        )}
        {!isEditing && isCruisePortPickup && showDayStorage && (
          <Section>
            <EditSection>
              <EditTitle>{t.dayStorageSectionTitle}</EditTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 14, color: '#696f79' }}>{t.dayStorageLuggageLabel}</span>
                    <BagStepper>
                      <StepBtn
                        type='button'
                        disabled={dsLarge <= 0}
                        onClick={() => setDsLarge(Math.max(0, dsLarge - 1))}
                      >−</StepBtn>
                      <StepVal>{dsLarge}</StepVal>
                      <StepBtn
                        type='button'
                        disabled={dsTotalBags >= 10}
                        onClick={() => setDsLarge(Math.min(10, dsLarge + 1))}
                      >+</StepBtn>
                    </BagStepper>
                    <StepperHint>{t.dayStorageLuggageHint}</StepperHint>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 14, color: '#696f79' }}>{t.dayStorageBackpackLabel}</span>
                    <BagStepper>
                      <StepBtn
                        type='button'
                        disabled={dsSmall <= 0}
                        onClick={() => setDsSmall(Math.max(0, dsSmall - 1))}
                      >−</StepBtn>
                      <StepVal>{dsSmall}</StepVal>
                      <StepBtn
                        type='button'
                        disabled={dsTotalBags >= 10}
                        onClick={() => setDsSmall(Math.min(10, dsSmall + 1))}
                      >+</StepBtn>
                    </BagStepper>
                    <StepperHint>{t.dayStorageBackpackHint}</StepperHint>
                  </div>
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'Poppins', fontSize: 14 }}>
                  <span>{t.dayStorageSlotLabel}</span>
                  <select
                    value={dsSlot}
                    onChange={(e) => setDsSlot(e.target.value)}
                    style={{ padding: 10, borderRadius: 8, border: '1px solid #e5e6eb', fontFamily: 'Poppins' }}
                  >
                    {DAY_STORAGE_BSI_SLOTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.value}</option>
                    ))}
                  </select>
                </label>
                <div style={{ fontFamily: 'Poppins', fontWeight: 600, fontSize: 16 }}>
                  {t.dayStorageTotalLabel}: {dsTotal.toLocaleString('is-IS')} kr
                </div>
                {dsError && (
                  <div style={{ color: '#c33', fontFamily: 'Poppins', fontSize: 14 }}>{dsError}</div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <ActionButton
                    variant='primary'
                    disabled={dsSubmitting || !dsCanSubmit}
                    onClick={submitDayStorage}
                  >
                    {dsSubmitting
                      ? t.dayStorageProcessing
                      : t.dayStoragePay.replace('{amount}', dsTotal.toLocaleString('is-IS'))}
                  </ActionButton>
                  <ActionButton
                    variant='secondary'
                    onClick={() => {
                      setShowDayStorage(false)
                      setDsError('')
                    }}
                  >
                    {t.dayStorageCancel}
                  </ActionButton>
                </div>
              </div>
            </EditSection>
          </Section>
        )}
        {!isEditing && !showFastTrack && !isPickupDelivery && (
          <ActionGrid>
            {fastTrackSummary ? (
              <FastTrackStatusCard
                state={fastTrackSummary.state}
                passengers={fastTrackSummary.passengers}
                flightDate={fastTrackSummary.flightDate}
                t={t}
                onAddMore={openFastTrack}
              />
            ) : (
              <ActionCard variant='primary'>
                <ActionIcon variant='primary'>&#9992;&#xFE0E;</ActionIcon>
                <ActionTitle>{t.fastTrackTitle}</ActionTitle>
                <ActionDescription>{t.fastTrackDescription}</ActionDescription>
                <ActionButton variant='primary' onClick={openFastTrack}>
                  {t.fastTrackOpenButton}
                </ActionButton>
              </ActionCard>
            )}
          </ActionGrid>
        )}
        {!isEditing && showFastTrack && !isPickupDelivery && (
          <Section>
            <EditSection>
              <EditTitle>{t.fastTrackSectionTitle}</EditTitle>

              {ftPassengers.map((passenger, i) => (
                <div
                  key={i}
                  style={{
                    paddingBottom: 12,
                    marginBottom: 12,
                    borderBottom:
                      i < ftPassengers.length - 1
                        ? '1px solid #f0e0c0'
                        : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <TimeWindowLabel style={{ margin: 0 }}>
                      {i === 0
                        ? t.fastTrackMainPassenger
                        : `${t.fastTrackPassenger} ${i + 1}`}
                    </TimeWindowLabel>
                    {i > 0 && (
                      <button
                        onClick={() => removeFtPassenger(i)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#c33',
                          fontFamily: 'Poppins',
                          fontSize: 12,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {t.fastTrackRemovePassenger}
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                    }}
                  >
                    <input
                      type='text'
                      placeholder={t.fastTrackFirstName}
                      value={passenger.firstName}
                      onChange={(e) =>
                        updateFtPassenger(i, 'firstName', e.target.value)
                      }
                      style={{
                        width: '100%',
                        minWidth: 0,
                        padding: '12px 16px',
                        fontSize: 14,
                        fontFamily: 'Poppins, sans-serif',
                        border: '1px solid #e5e6eb',
                        borderRadius: 12,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <input
                      type='text'
                      placeholder={t.fastTrackLastName}
                      value={passenger.lastName}
                      onChange={(e) =>
                        updateFtPassenger(i, 'lastName', e.target.value)
                      }
                      style={{
                        width: '100%',
                        minWidth: 0,
                        padding: '12px 16px',
                        fontSize: 14,
                        fontFamily: 'Poppins, sans-serif',
                        border: '1px solid #e5e6eb',
                        borderRadius: 12,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              ))}

              {ftPassengers.length < 4 && (
                <button
                  onClick={addFtPassenger}
                  style={{
                    width: '100%',
                    padding: 12,
                    background: 'transparent',
                    border: '1px dashed #f3ad3c',
                    borderRadius: 12,
                    color: '#e37f2f',
                    fontFamily: 'Poppins',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    marginBottom: 16,
                  }}
                >
                  {t.fastTrackAddPassenger}
                </button>
              )}

              <div
                style={{
                  background: '#fff8ee',
                  border: '1px solid #f3ad3c',
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    fontFamily: 'Poppins',
                    fontSize: 14,
                    color: '#000929',
                    margin: 0,
                  }}
                >
                  {t.fastTrackTotal}:{' '}
                  <strong>{ftTotal.toLocaleString()} kr</strong>
                </p>
                <p
                  style={{
                    fontFamily: 'Poppins',
                    fontSize: 12,
                    color: '#696f79',
                    margin: '4px 0 0',
                  }}
                >
                  {ftPassengers.length} × 2,490 kr
                </p>
              </div>

              {ftError && (
                <p
                  style={{
                    color: '#c33',
                    fontFamily: 'Poppins',
                    fontSize: 13,
                    marginTop: 12,
                    textAlign: 'center',
                  }}
                >
                  {ftError}
                </p>
              )}

              <SubmitButton
                onClick={submitFastTrack}
                disabled={ftSubmitting || !ftCanSubmit}
              >
                {ftSubmitting
                  ? t.fastTrackProcessing
                  : t.fastTrackPay.replace(
                      '{amount}',
                      ftTotal.toLocaleString()
                    )}
              </SubmitButton>

              <button
                onClick={closeFastTrack}
                disabled={ftSubmitting}
                style={{
                  width: '100%',
                  marginTop: 8,
                  padding: 12,
                  background: 'transparent',
                  border: 'none',
                  color: '#696f79',
                  fontFamily: 'Poppins',
                  fontSize: 13,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {t.fastTrackCancel}
              </button>
            </EditSection>
          </Section>
        )}

        {/* P&D edit form — simpler form with pickup AND delivery side */}
        {isConfirmed && isEditing && isPickupDelivery && (
          <EditSection>
            <EditTitle>{t.updateYourOrder}</EditTitle>

            <h4 style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, margin: '0 0 12px', color: '#000929' }}>
              {t.editPickupSection}
            </h4>

            <div style={{ marginBottom: 12 }}>
              <TimeWindowLabel>{t.pickupAddressLabel}</TimeWindowLabel>
              <input
                type='text'
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px', fontSize: 14,
                  fontFamily: 'Poppins, sans-serif',
                  border: '1px solid #e5e6eb', borderRadius: 12,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <TimeWindowLabel>{t.pickupDateLabel}</TimeWindowLabel>
              <input
                type='date'
                value={editPickupDate}
                onChange={(e) => setEditPickupDate(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px', fontSize: 14,
                  fontFamily: 'Poppins, sans-serif',
                  border: '1px solid #e5e6eb', borderRadius: 12,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <TimeWindowLabel>{t.pickupTimeWindowLabel}</TimeWindowLabel>
            <TimeRangeSlider
              startHour={PD_SLIDER_START}
              endHour={PD_SLIDER_END}
              leftValue={editPickupLeft}
              rightValue={editPickupRight}
              constraints={PD_SLIDER_CONSTRAINTS}
              onChange={(l, r) => { setEditPickupLeft(l); setEditPickupRight(r) }}
            />

            <h4 style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, margin: '16px 0 12px', color: '#000929' }}>
              {t.editDeliverySection}
            </h4>

            <div style={{ marginBottom: 12 }}>
              <TimeWindowLabel>{t.deliveryAddressLabel}</TimeWindowLabel>
              <input
                type='text'
                value={editDeliveryAddress}
                onChange={(e) => setEditDeliveryAddress(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px', fontSize: 14,
                  fontFamily: 'Poppins, sans-serif',
                  border: '1px solid #e5e6eb', borderRadius: 12,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <TimeWindowLabel>{t.deliveryDateLabel}</TimeWindowLabel>
              <input
                type='date'
                value={editDeliveryDate}
                onChange={(e) => setEditDeliveryDate(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px', fontSize: 14,
                  fontFamily: 'Poppins, sans-serif',
                  border: '1px solid #e5e6eb', borderRadius: 12,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <TimeWindowLabel>{t.deliveryTimeWindowLabel}</TimeWindowLabel>
            <TimeRangeSlider
              startHour={PD_SLIDER_START}
              endHour={PD_SLIDER_END}
              leftValue={editDeliveryLeft}
              rightValue={editDeliveryRight}
              constraints={PD_SLIDER_CONSTRAINTS}
              onChange={(l, r) => { setEditDeliveryLeft(l); setEditDeliveryRight(r) }}
            />

            <EditRow>
              <EditLabel>{t.standardBags}</EditLabel>
              <Counter>
                <CounterButton disabled={editBags <= 0} onClick={() => setEditBags(Math.max(0, editBags - 1))}>-</CounterButton>
                <CounterValue>{editBags}</CounterValue>
                <CounterButton onClick={() => setEditBags(editBags + 1)}>+</CounterButton>
              </Counter>
            </EditRow>

            <EditRow>
              <EditLabel>{t.oddSizeBags}</EditLabel>
              <Counter>
                <CounterButton disabled={editOddSize <= 0} onClick={() => setEditOddSize(Math.max(0, editOddSize - 1))}>-</CounterButton>
                <CounterValue>{editOddSize}</CounterValue>
                <CounterButton onClick={() => setEditOddSize(editOddSize + 1)}>+</CounterButton>
              </Counter>
            </EditRow>

            {surcharge > 0 && (
              <div style={{
                background: '#fff8ee', border: '1px solid #f3ad3c', borderRadius: 12,
                padding: 16, marginTop: 16, textAlign: 'center',
              }}>
                <p style={{ fontFamily: 'Poppins', fontSize: 14, color: '#000929', margin: 0 }}>
                  {t.surcharge} <strong>{surcharge.toLocaleString()} kr</strong>
                </p>
                <p style={{ fontFamily: 'Poppins', fontSize: 12, color: '#696f79', margin: '4px 0 0' }}>
                  {extraBags > 0 && `${extraBags} ${extraBags === 1 ? t.extraBag : t.extraBags} (${extraBags * 1990} kr)`}
                  {extraBags > 0 && extraOddSize > 0 && ' + '}
                  {extraOddSize > 0 && `${extraOddSize} ${t.extraOddSize} (${extraOddSize * 2490} kr)`}
                </p>
              </div>
            )}

            {editError && (
              <p style={{
                color: '#c33', fontFamily: 'Poppins, sans-serif',
                fontSize: 13, marginTop: 12, textAlign: 'center',
              }}>
                {editError}
              </p>
            )}

            <SubmitButton onClick={submitUpdate} disabled={submitting || (editBags + editOddSize === 0)}>
              {submitting
                ? t.processing
                : surcharge > 0
                  ? t.payAndUpdate.replace('{amount}', surcharge.toLocaleString())
                  : t.saveChanges}
            </SubmitButton>
            {!hasBagChanges && (
              <p style={{ fontFamily: 'Poppins', fontSize: 12, color: '#3D7165', marginTop: 8, textAlign: 'center' }}>
                {t.freeTimeWindow}
              </p>
            )}
          </EditSection>
        )}

        {/* Edit Mode (non-P&D) */}
        {isConfirmed && isEditing && !isPickupDelivery && (
          <EditSection>
            <EditTitle>{t.updateYourOrder}</EditTitle>

            <div style={{ marginBottom: 16 }}>
              <TimeWindowLabel>{t.addressLabel}</TimeWindowLabel>
              <input
                // @ts-ignore
                ref={addressRef}
                type='text'
                defaultValue={originalAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder={originalAddress}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: 14,
                  fontFamily: 'Poppins, sans-serif',
                  border: '1px solid #e5e6eb',
                  borderRadius: 12,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <EditRow>
              <EditLabel>{t.standardBags}</EditLabel>
              <Counter>
                <CounterButton
                  disabled={editBags <= 0}
                  onClick={() => setEditBags(Math.max(0, editBags - 1))}
                >
                  -
                </CounterButton>
                <CounterValue>{editBags}</CounterValue>
                <CounterButton onClick={() => setEditBags(editBags + 1)}>
                  +
                </CounterButton>
              </Counter>
            </EditRow>

            <EditRow>
              <EditLabel>{t.oddSizeBags}</EditLabel>
              <Counter>
                <CounterButton
                  disabled={editOddSize <= 0}
                  onClick={() => setEditOddSize(Math.max(0, editOddSize - 1))}
                >
                  -
                </CounterButton>
                <CounterValue>{editOddSize}</CounterValue>
                <CounterButton onClick={() => setEditOddSize(editOddSize + 1)}>
                  +
                </CounterButton>
              </Counter>
            </EditRow>

            <TimeWindowLabel>{t.selectPickupTimeWindow}</TimeWindowLabel>

            <div style={{ marginBottom: 8 }}>
              <TimeWindowLabel>{t.morningLabel}</TimeWindowLabel>
              <TimeRangeSlider
                startHour={9}
                endHour={12}
                leftValue={morningLeft}
                rightValue={morningRight}
                constraints={getMorningConstraints()}
                disabled={activeWindow !== 'morning'}
                onActivate={() => {
                  setActiveWindow('morning')
                  setEditTimeWindow(`${formatHour(9 + morningLeft)} - ${formatHour(9 + morningRight)}`)
                }}
                onChange={handleMorningChange}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <TimeWindowLabel>{t.eveningLabel}</TimeWindowLabel>
              <TimeRangeSlider
                startHour={17}
                endHour={22}
                leftValue={eveningLeft}
                rightValue={eveningRight}
                constraints={getSliderConstraints('')}
                disabled={activeWindow !== 'evening'}
                onActivate={() => {
                  setActiveWindow('evening')
                  setEditTimeWindow(`${formatHour(17 + eveningLeft)} - ${formatHour(17 + eveningRight)}`)
                }}
                onChange={handleEveningChange}
              />
            </div>

            {editTimeWindow && (
              <p style={{ fontFamily: 'Poppins', fontSize: 13, color: '#696f79', marginTop: 8 }}>
                {t.selected} <strong>{editTimeWindow}</strong>
              </p>
            )}

            {surcharge > 0 && (
              <div style={{
                background: '#fff8ee', border: '1px solid #f3ad3c', borderRadius: 12,
                padding: 16, marginTop: 16, textAlign: 'center',
              }}>
                <p style={{ fontFamily: 'Poppins', fontSize: 14, color: '#000929', margin: 0 }}>
                  {t.surcharge} <strong>{surcharge.toLocaleString()} kr</strong>
                </p>
                <p style={{ fontFamily: 'Poppins', fontSize: 12, color: '#696f79', margin: '4px 0 0' }}>
                  {extraBags > 0 && `${extraBags} ${extraBags === 1 ? t.extraBag : t.extraBags} (${extraBags * 1990} kr)`}
                  {extraBags > 0 && extraOddSize > 0 && ' + '}
                  {extraOddSize > 0 && `${extraOddSize} ${t.extraOddSize} (${extraOddSize * 2490} kr)`}
                </p>
              </div>
            )}

            {editError && (
              <p style={{
                color: '#c33', fontFamily: 'Poppins, sans-serif',
                fontSize: 13, marginTop: 12, textAlign: 'center',
              }}>
                {editError}
              </p>
            )}

            <SubmitButton onClick={submitUpdate} disabled={submitting || (editBags + editOddSize === 0)}>
              {submitting
                ? t.processing
                : surcharge > 0
                  ? t.payAndUpdate.replace('{amount}', surcharge.toLocaleString())
                  : t.saveChanges}
            </SubmitButton>
            {!hasBagChanges && (
              <p style={{ fontFamily: 'Poppins', fontSize: 12, color: '#3D7165', marginTop: 8, textAlign: 'center' }}>
                {t.freeTimeWindow}
              </p>
            )}
          </EditSection>
        )}

        {/* Success message after edit */}
        {editSubmitted && (
          <SuccessMessage>
            {submitMessage}
          </SuccessMessage>
        )}

        {/* Estimated pickup time — only when Planned */}
        {isPlanned && scheduledAt && (
          <Section>
            <SectionTitle>{t.estimatedPickupTitle}</SectionTitle>
            <div
              style={{
                background: 'white',
                border: '2px solid #3D7165',
                borderRadius: 20,
                padding: 24,
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontFamily: 'Poppins',
                  fontSize: 13,
                  color: '#696f79',
                  margin: '0 0 8px',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {t.pickupBetween}
              </p>
              <p
                style={{
                  fontFamily: 'Poppins',
                  fontSize: 32,
                  fontWeight: 600,
                  color: '#000929',
                  margin: 0,
                }}
              >
                {formatEtaWindow(scheduledAt)}
              </p>
              <p
                style={{
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  color: '#a3a4a7',
                  margin: '8px 0 0',
                }}
              >
                {t.pickupEstimateNote}
              </p>
            </div>
          </Section>
        )}

        {/* Map — shows for Planned and Delivered */}
        {showMap && mapAddress && (
          <Section>
            <SectionTitle>{mapHeading}</SectionTitle>
            <MapContainer>
              <iframe
                src={mapsEmbedUrl}
                allowFullScreen
                loading='lazy'
                referrerPolicy='no-referrer-when-downgrade'
              />
            </MapContainer>
            <AddressText>{displayMapAddress}</AddressText>
          </Section>
        )}

        {/* Bag Photos — only show when Delivered AND at least one photo exists */}
        {isDelivered && photos && photos.length > 0 && (
          <Section>
            <SectionTitle>{t.yourBagsTitle}</SectionTitle>
            <PhotoGrid>
              {photos.map((photo: Photo, i: number) => (
                <div key={i}>
                  <PhotoCard onClick={() => setLightboxIndex(i)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={`Bag ${i + 1}`} />
                  </PhotoCard>
                  {photo.tagNumber && (
                    <p
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontSize: 12,
                        color: '#696f79',
                        textAlign: 'center',
                        margin: '6px 0 0',
                        fontWeight: 500,
                      }}
                    >
                      {photo.tagNumber}
                    </p>
                  )}
                </div>
              ))}
            </PhotoGrid>
          </Section>
        )}

        {/* Tip the driver — English-only, only after Delivered */}
        {isDelivered && router.locale === 'en' && (
          <Section>
            <TipCard>
              <TipHeading>{t.tipTitle}</TipHeading>
              <TipSubtext>{t.tipSubtext}</TipSubtext>

              <TipButtonGrid>
                {[700, 1400, 2800].map((amount) => (
                  <TipButton
                    key={amount}
                    selected={tipPreset === amount}
                    onClick={() => {
                      setTipPreset(amount)
                      setTipCustom('')
                    }}
                  >
                    {amount.toLocaleString()} kr
                  </TipButton>
                ))}
              </TipButtonGrid>

              <label
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 12,
                  color: '#4a6b60',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                {t.tipCustomLabel}
              </label>
              <TipInput
                type='number'
                min='100'
                placeholder='0'
                value={tipCustom}
                onChange={(e) => {
                  setTipCustom(e.target.value)
                  setTipPreset(null)
                }}
              />

              <TipSubmit
                onClick={submitTip}
                disabled={tipSubmitting || effectiveTipAmount < 100}
              >
                {tipSubmitting
                  ? t.tipProcessing
                  : effectiveTipAmount > 0
                    ? t.tipSubmit.replace(
                        '{amount}',
                        effectiveTipAmount.toLocaleString()
                      )
                    : t.tipSubmitGeneric}
              </TipSubmit>
            </TipCard>
          </Section>
        )}
      </PageContainer>

      {lightboxIndex !== null && photos && photos[lightboxIndex] && (
        <LightboxOverlay
          onClick={(e) => {
            // tapping the dim area closes; tapping the image / chrome doesn't
            if (e.target === e.currentTarget) setLightboxIndex(null)
          }}
          onTouchStart={(e) => {
            lightboxTouchStartX.current = e.touches[0].clientX
            lightboxTouchStartY.current = e.touches[0].clientY
          }}
          onTouchEnd={(e) => {
            const startX = lightboxTouchStartX.current
            const startY = lightboxTouchStartY.current
            lightboxTouchStartX.current = null
            lightboxTouchStartY.current = null
            if (startX === null || startY === null) return
            const dx = e.changedTouches[0].clientX - startX
            const dy = e.changedTouches[0].clientY - startY
            // Only treat as swipe if the gesture is clearly horizontal
            if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
            if (photos.length < 2) return
            setLightboxIndex((idx) => {
              if (idx === null) return idx
              const next = dx < 0 ? idx + 1 : idx - 1
              return (next + photos.length) % photos.length
            })
          }}
        >
          {/* Close (×) */}
          <button
            type='button'
            aria-label='Close'
            onClick={() => setLightboxIndex(null)}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: 40,
              height: 40,
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
              zIndex: 1,
            }}
          >
            ×
          </button>

          {/* Prev arrow — only visible when there are 2+ photos */}
          {photos.length > 1 && (
            <button
              type='button'
              aria-label='Previous photo'
              onClick={(e) => {
                e.stopPropagation()
                setLightboxIndex((idx) =>
                  idx === null ? idx : (idx - 1 + photos.length) % photos.length
                )
              }}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,0.5)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: 44,
                height: 44,
                fontSize: 22,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              ‹
            </button>
          )}

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              maxWidth: '90vw',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[lightboxIndex].url}
              alt={`Bag ${lightboxIndex + 1}`}
              style={{
                maxWidth: '90vw',
                maxHeight: '78vh',
                borderRadius: 8,
                objectFit: 'contain',
              }}
            />
            {photos[lightboxIndex].tagNumber && (
              <p
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#fff',
                  margin: 0,
                  textAlign: 'center',
                }}
              >
                {photos[lightboxIndex].tagNumber}
                {photos.length > 1 && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 400,
                      color: 'rgba(255,255,255,0.6)',
                      marginTop: 2,
                    }}
                  >
                    {lightboxIndex + 1} / {photos.length}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Next arrow */}
          {photos.length > 1 && (
            <button
              type='button'
              aria-label='Next photo'
              onClick={(e) => {
                e.stopPropagation()
                setLightboxIndex((idx) =>
                  idx === null ? idx : (idx + 1) % photos.length
                )
              }}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,0.5)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: 44,
                height: 44,
                fontSize: 22,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              ›
            </button>
          )}
        </LightboxOverlay>
      )}

      {showCancelModal && (
        <ModalOverlay
          onClick={(e) => {
            // click-outside-to-close, but not while a request is in flight
            if (e.target === e.currentTarget && !cancelling) {
              setShowCancelModal(false)
            }
          }}
        >
          <ModalCard>
            <ModalTitle>
              {cancelResult?.success
                ? t.cancelOrder.doneTitle
                : t.cancelOrder.confirmTitle}
            </ModalTitle>
            <ModalBody>
              {cancelResult
                ? cancelResult.message
                : cancelHasRefund
                  ? t.cancelOrder.confirmBody(
                      Number(fields['Upphæð'] || 0).toLocaleString('is-IS'),
                    )
                  : t.cancelOrder.confirmBodyNoRefund}
            </ModalBody>
            {!cancelResult && (
              <ModalButtonRow>
                <ModalSecondaryButton
                  disabled={cancelling}
                  onClick={() => setShowCancelModal(false)}
                >
                  {t.cancelOrder.keepButton}
                </ModalSecondaryButton>
                <ModalPrimaryButton
                  destructive
                  disabled={cancelling}
                  onClick={submitCancel}
                >
                  {cancelling
                    ? t.cancelOrder.cancelling
                    : cancelHasRefund
                      ? t.cancelOrder.confirmButton
                      : t.cancelOrder.confirmButtonNoRefund}
                </ModalPrimaryButton>
              </ModalButtonRow>
            )}
            {cancelResult && !cancelResult.success && (
              <ModalButtonRow>
                <ModalSecondaryButton onClick={() => setShowCancelModal(false)}>
                  {t.cancelOrder.close}
                </ModalSecondaryButton>
              </ModalButtonRow>
            )}
          </ModalCard>
        </ModalOverlay>
      )}
    </>
  )
}

export const getServerSideProps: GetServerSideProps<OrderPageProps> = async ({
  params,
  query,
}) => {
  const orderNo = params?.orderNo as string
  if (!orderNo) {
    return { props: { order: null, photos: [], orderNo: '', scheduledAt: null, fastTrackSummary: null } }
  }

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    // Customer just paid → flip Greitt: true on the Airtable record now,
    // before fetching the order data. The Rapyd webhook will also do this
    // (idempotent) but races the redirect — without this call the page can
    // render "Pending" on a paid order. Setting Greitt is enough; the
    // Order Status formula auto-flips to "Confirmed".
    if (query?.paid === 'true') {
      try {
        await fetch(`${baseUrl}/api/airtable/mark-paid-by-order-no`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...internalSecretHeaders() },
          body: JSON.stringify({ orderNo }),
        })
      } catch (err) {
        console.warn('[orders] mark-paid pre-render failed (webhook will catch it)', err)
      }
    }

    const orderRes = await fetch(
      `${baseUrl}/api/airtable/read-by-order-no?orderNo=${orderNo}`,
      { headers: internalSecretHeaders() }
    )
    if (!orderRes.ok) {
      return { props: { order: null, photos: [], orderNo, scheduledAt: null, fastTrackSummary: null } }
    }
    const order = await orderRes.json()

    let photos: Photo[] = []
    try {
      const tagRes = await fetch(
        `${baseUrl}/api/airtable/tag-numbers?orderNo=${orderNo}`
      )
      if (tagRes.ok) {
        const tagData = await tagRes.json()
        photos = tagData.photos || []
      }
    } catch {
      // optional
    }

    // Fetch Optimo pickup ETA — only if the order has linked Optimo Stops
    let scheduledAt: string | null = null
    const stopIds = (order?.fields?.['Optimo Stops'] as string[]) || []
    if (stopIds.length > 0) {
      try {
        const optimoRes = await fetch(
          `${baseUrl}/api/airtable/optimo-stop?orderNo=${orderNo}&stopIds=${stopIds.join(',')}`
        )
        if (optimoRes.ok) {
          const optimoData = await optimoRes.json()
          scheduledAt = optimoData.scheduledAt || null
        }
      } catch {
        // optional
      }
    }

    // Fetch any paid Fast-Track records for this customer's flight (matched
    // by email + flight date — see fast-track-by-order-no.ts for why those
    // are the reliable keys vs the {order number} text or {Pöntunarnúmer}
    // linked-record fields, which are blank on most paid rows). Then derive
    // the active/expired summary server-side so the cutoff is stable for the
    // whole page session and there's no hydration mismatch around midnight.
    let fastTrackSummary: FastTrackSummary | null = null
    try {
      const customerEmail = String(
        order?.fields?.['Tölvupóstfang'] || ''
      ).trim()
      const orderFlightDateRaw = order?.fields?.['Dagsetning flugs']
        ? String(order.fields['Dagsetning flugs']).slice(0, 10)
        : ''
      const params = new URLSearchParams({
        email: customerEmail,
        flightDate: orderFlightDateRaw,
      })
      const ftRes =
        customerEmail && orderFlightDateRaw
          ? await fetch(
              `${baseUrl}/api/airtable/fast-track-by-order-no?${params.toString()}`
            )
          : null
      if (ftRes && ftRes.ok) {
        const ftData = await ftRes.json()
        const rows: FastTrackRecord[] = ftData.fastTracks || []
        if (rows.length > 0) {
          // Merge passengers across all paid rows; de-dupe on case-folded name
          const seen = new Set<string>()
          const passengers: FastTrackPassenger[] = []
          for (const row of rows) {
            for (const p of row.passengers) {
              const key = `${p.firstName}|${p.lastName}`.toLowerCase()
              if (!seen.has(key)) {
                seen.add(key)
                passengers.push(p)
              }
            }
          }
          // Prefer the Fast-Track row's stored Flight date; fall back to the
          // order's own Dagsetning flugs so even older rows that pre-date the
          // copy-flight-date logic still render correctly.
          const ftFlightDate = rows
            .map((r) => r.flightDate)
            .find((d): d is string => !!d) || null
          const orderFlightDate = order?.fields?.['Dagsetning flugs']
            ? String(order.fields['Dagsetning flugs']).slice(0, 10)
            : null
          const flightDate = ftFlightDate
            ? String(ftFlightDate).slice(0, 10)
            : orderFlightDate
          // Active through the flight day itself; expired starting the day
          // after. Iceland runs on UTC year-round so UTC today equals local
          // today in Reykjavík.
          const today = new Date().toISOString().slice(0, 10)
          const state: 'active' | 'expired' =
            flightDate && today > flightDate ? 'expired' : 'active'
          fastTrackSummary = { state, flightDate, passengers }
        }
      }
    } catch {
      // optional — falls back to the purchase promo
    }

    return { props: { order, photos, orderNo, scheduledAt, fastTrackSummary } }
  } catch (error) {
    console.error('Error fetching order:', error)
    return { props: { order: null, photos: [], orderNo, scheduledAt: null, fastTrackSummary: null } }
  }
}

export default OrderPage
