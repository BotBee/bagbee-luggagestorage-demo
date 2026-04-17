import styled from '@emotion/styled'
import { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import { NextSeo } from 'next-seo'
import Header from '../../components/header/Header'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/router'
import TimeRangeSlider from '../../components/time-range-slider/TimeRangeSlider'
import { getMorningConstraints, getSliderConstraints } from '../../common/postalCodeConstraints'
import en from '../../common/locales/en'
import is from '../../common/locales/is'

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

// --- Types ---
type Photo = { url: string; filename: string; type: string }
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

  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)

  // Edit state
  const [editBags, setEditBags] = useState<number>(0)
  const [editOddSize, setEditOddSize] = useState<number>(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editSubmitted, setEditSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')

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
        <Header />
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
  // Normalize "In progress" → "In Progress" to match our type
  const status = (
    String(rawStatus).toLowerCase() === 'in progress'
      ? 'In Progress'
      : rawStatus
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
  const mapsEmbedUrl = `https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${encodedAddress}`

  const totalBags = (fields['Töskufjöldi_no'] || 0) + (fields['Töskufjöldi_no_yfirstærð'] || 0)

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

  const startEditing = () => {
    setEditBags(originalBags || 1)
    setEditOddSize(originalOddSize)
    setEditTimeWindow(originalTimeWindow)
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
            address: undefined, // TODO: add address editing if needed
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

  return (
    <>
      <NextSeo title={`BagBee | Order #${orderNo}`} />
      <Header />
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

        <OrderTitle>{t.orderLabel} #{orderNo}</OrderTitle>
        <OrderSubtitle>BagBee {serviceType}</OrderSubtitle>

        {/* Status Progress Bar */}
        <Section>
          <ProgressContainer>
            {ALL_STATUSES.map((s, i) => {
              const completed = i < statusIndex
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
                  <ProgressLabel active={active}>{s}</ProgressLabel>
                </ProgressStep>
              )
            })}
          </ProgressContainer>
        </Section>

        {/* Order Details */}
        <Section>
          <SectionTitle>{t.orderDetailsTitle}</SectionTitle>
          <StatusCard>
            <StatusBadge bgColor={statusColor}>
              {t.status[status as OrderStatus] || status}
            </StatusBadge>
            <DetailGrid>
              <DetailRow>
                <DetailLabel>{t.service}</DetailLabel>
                <DetailValue>{serviceType}</DetailValue>
              </DetailRow>
              <DetailRow>
                <DetailLabel>{t.flight}</DetailLabel>
                <DetailValue>{fields['Flugnúmer'] || 'N/A'}</DetailValue>
              </DetailRow>
              <DetailRow>
                <DetailLabel>{t.flightDate}</DetailLabel>
                <DetailValue>{formatDate(fields['Dagsetning flugs'])}</DetailValue>
              </DetailRow>
              <DetailRow>
                <DetailLabel>{t.pickupDate}</DetailLabel>
                <DetailValue>{formatDate(fields['Dagsetning pick-up'])}</DetailValue>
              </DetailRow>
              <DetailRow>
                <DetailLabel>{t.airline}</DetailLabel>
                <DetailValue>{fields['Flugfélag'] || 'N/A'}</DetailValue>
              </DetailRow>
              <DetailRow>
                <DetailLabel>{t.bags}</DetailLabel>
                <DetailValue>
                  {fields['Töskufjöldi_no'] || 0} {t.standardSuffix}
                  {fields['Töskufjöldi_no_yfirstærð'] > 0 &&
                    ` + ${fields['Töskufjöldi_no_yfirstærð']} ${t.oddSizeSuffix}`}
                  {` (${totalBags} ${t.totalSuffix})`}
                </DetailValue>
              </DetailRow>
              {fields['Tímasetning'] && (
                <DetailRow>
                  <DetailLabel>{isArrival ? t.deliveryWindow : t.pickupWindow}</DetailLabel>
                  <DetailValue>{fields['Tímasetning']}</DetailValue>
                </DetailRow>
              )}
              <DetailRow>
                <DetailLabel>{t.customer}</DetailLabel>
                <DetailValue>{fields['Nafn viðskiptavinar'] || 'N/A'}</DetailValue>
              </DetailRow>
              <DetailRow>
                <DetailLabel>{t.phone}</DetailLabel>
                <DetailValue>{fields['Símanúmer'] || 'N/A'}</DetailValue>
              </DetailRow>
            </DetailGrid>

            {/* Edit button for Confirmed orders */}
            {isConfirmed && !isEditing && !editSubmitted && (
              <SubmitButton onClick={startEditing} style={{ marginTop: 20 }}>
                {t.editOrder}
              </SubmitButton>
            )}
          </StatusCard>
        </Section>

        {/* Edit Mode */}
        {isConfirmed && isEditing && (
          <EditSection>
            <EditTitle>{t.updateYourOrder}</EditTitle>

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

        {/* Bag Photos — only show when Delivered */}
        {isDelivered && (
          <Section>
            <SectionTitle>{t.yourBagsTitle}</SectionTitle>
            {photos && photos.length > 0 ? (
              <PhotoGrid>
                {photos.map((photo: Photo, i: number) => (
                  <PhotoCard key={i} onClick={() => setLightboxPhoto(photo.url)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={`Bag ${i + 1}`} />
                  </PhotoCard>
                ))}
              </PhotoGrid>
            ) : (
              <p style={{ fontFamily: 'Poppins', fontSize: 14, color: '#a3a4a7', fontStyle: 'italic' }}>
                {t.noBagPhotos}
              </p>
            )}
          </Section>
        )}
      </PageContainer>

      {lightboxPhoto && (
        <LightboxOverlay onClick={() => setLightboxPhoto(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxPhoto} alt='Bag photo' />
        </LightboxOverlay>
      )}
    </>
  )
}

export const getServerSideProps: GetServerSideProps<OrderPageProps> = async ({
  params,
}) => {
  const orderNo = params?.orderNo as string
  if (!orderNo) {
    return { props: { order: null, photos: [], orderNo: '', scheduledAt: null } }
  }

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

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
