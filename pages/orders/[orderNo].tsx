import styled from '@emotion/styled'
import { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import { NextSeo } from 'next-seo'
import Header from '../../components/header/Header'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import {
  usePlacesWidget,
  ReactGoogleAutocompleteProps,
} from 'react-google-autocomplete'
import TimeRangeSlider from '../../components/time-range-slider/TimeRangeSlider'
import { getMorningConstraints, getSliderConstraints } from '../../common/postalCodeConstraints'
import en from '../../common/locales/en'
import is from '../../common/locales/is'
import { useBookingStore } from '../../store/store'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

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

interface OrderPageProps {
  order: { id: string; fields: OrderFields } | null
  photos: Photo[]
  orderNo: string
  scheduledAt: string | null
}

const ALL_STATUSES: OrderStatus[] = ['Pending', 'Confirmed', 'Planned', 'In Progress', 'Delivered']

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

// Format scheduled time with +/- 10 minute window
function formatEtaWindow(isoString: string | null): string | null {
  if (!isoString) return null
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return null
  const earlier = new Date(date.getTime() - 10 * 60 * 1000)
  const later = new Date(date.getTime() + 10 * 60 * 1000)
  const fmt = (d: Date) =>
    `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  return `${fmt(earlier)} - ${fmt(later)}`
}

// --- Component ---
const OrderPage = ({
  order,
  photos,
  orderNo,
  scheduledAt,
}: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const router = useRouter()
  const t = (router.locale === 'en' ? en : is).orderTrackingPage
  const paymentSuccess = router.query.paid === 'true'
  const paymentError = router.query.error === 'true'
  const fastTrackPaid = router.query.fast_track_paid === 'true'
  const fastTrackError = router.query.fast_track_error === 'true'

  // Booking is paid — drop the persisted booking-store snapshot so the
  // customer doesn't see a stale half-filled wizard if they come back to
  // /book days later. Successful baggage payments redirect straight here
  // via /orders/{code}?paid=true.
  useEffect(() => {
    if (paymentSuccess) {
      useBookingStore.persist.clearStorage()
    }
  }, [paymentSuccess])

  // Lightbox tracks the index of the open photo so users can swipe / arrow
  // through the gallery. null = closed.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const lightboxTouchStartX = useRef<number | null>(null)
  const lightboxTouchStartY = useRef<number | null>(null)

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

  // Address edit state
  const [editAddress, setEditAddress] = useState<string>('')

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
  const serviceType = isArrival ? t.arrivalService : t.departureService
  const isDelivered = status === 'Delivered'
  const isConfirmed = status === 'Confirmed'
  const isPlanned = status === 'Planned'
  const showMap = isDelivered || isPlanned

  const deliveryAddress = fields['Delivery Address'] || ''
  const pickupAddress = fields['Heimilisfang'] || ''
  const hotelName = fields['Hótel Nafn'] || ''

  // Planned = show pickup address (Heimilisfang), Delivered = show delivery address
  const mapAddress = isPlanned
    ? pickupAddress
    : deliveryAddress || pickupAddress
  const displayMapAddress = isPlanned
    ? (hotelName ? `${hotelName}, ${pickupAddress}` : pickupAddress)
    : (deliveryAddress || (hotelName ? `${hotelName}, ${pickupAddress}` : pickupAddress))
  const mapHeading = isPlanned ? t.pickupLocationTitle : t.deliveryLocationTitle

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const encodedAddress = encodeURIComponent(displayMapAddress || 'Keflavik Airport, Iceland')
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

  const startEditing = () => {
    setEditBags(originalBags || 1)
    setEditOddSize(originalOddSize)
    setEditTimeWindow(originalTimeWindow)
    setEditAddress(originalAddress)
    setEditSubmitted(false)

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

    setIsEditing(true)
  }

  // Calculate surcharge for display
  const extraBags = Math.max(0, editBags - originalBags)
  const extraOddSize = Math.max(0, editOddSize - originalOddSize)
  const surcharge = extraBags * 1990 + extraOddSize * 2490
  const hasBagChanges = editBags !== originalBags || editOddSize !== originalOddSize

  const submitUpdate = async () => {
    setSubmitting(true)
    try {
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
            timeWindow: editTimeWindow || undefined,
            address:
              editAddress && editAddress !== originalAddress
                ? editAddress
                : undefined,
            originalAddress,
            originalTimeWindow,
          },
        }),
      })
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
      setSubmitMessage(t.changesSaved)
    }
    setSubmitting(false)
  }

  // --- Fast-Track helpers ---
  const customerFirstName = String(fields['First Name (fx)'] || '')
  const customerLastName = String(fields['Last Name (fx)'] || '')

  const openFastTrack = () => {
    // Pre-fill passenger 1 with the main customer's name
    setFtPassengers([
      {
        firstName: customerFirstName,
        lastName: customerLastName,
      },
    ])
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
            data.paymentCount === 0
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
          message: data.message || t.cancelOrder.error,
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

        {/* Order Details */}
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
              !['In progress', 'In Progress', 'Delivered', 'Cancelled'].includes(
                status as string,
              ) && (
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
              )}
          </StatusCard>
        </Section>

        {/* Fast-Track — collapsed promo OR expanded form, in the same slot
            so opening the form replaces the card in place (not below the bag photos) */}
        {!isEditing && !editSubmitted && !showFastTrack && (
          <ActionGrid>
            <ActionCard variant='primary'>
              <ActionIcon variant='primary'>&#9992;&#xFE0E;</ActionIcon>
              <ActionTitle>{t.fastTrackTitle}</ActionTitle>
              <ActionDescription>{t.fastTrackDescription}</ActionDescription>
              <ActionButton variant='primary' onClick={openFastTrack}>
                {t.fastTrackOpenButton}
              </ActionButton>
            </ActionCard>
          </ActionGrid>
        )}
        {!isEditing && !editSubmitted && showFastTrack && (
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

        {/* Edit Mode */}
        {isConfirmed && isEditing && (
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
                : t.cancelOrder.confirmBody(
                    Number(fields['Upphæð'] || 0).toLocaleString('is-IS'),
                  )}
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
                    : t.cancelOrder.confirmButton}
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
    return { props: { order: null, photos: [], orderNo: '', scheduledAt: null } }
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderNo }),
        })
      } catch (err) {
        console.warn('[orders] mark-paid pre-render failed (webhook will catch it)', err)
      }
    }

    const orderRes = await fetch(
      `${baseUrl}/api/airtable/read-by-order-no?orderNo=${orderNo}`
    )
    if (!orderRes.ok) {
      return { props: { order: null, photos: [], orderNo, scheduledAt: null } }
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

    return { props: { order, photos, orderNo, scheduledAt } }
  } catch (error) {
    console.error('Error fetching order:', error)
    return { props: { order: null, photos: [], orderNo, scheduledAt: null } }
  }
}

export default OrderPage
