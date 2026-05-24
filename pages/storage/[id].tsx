// @ts-nocheck
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { NextSeo } from 'next-seo'
import styled from '@emotion/styled'
import { keyframes } from '@emotion/react'
import axios from 'axios'
import dayjs from 'dayjs'
import Logo from '../../public/icons/Logo'

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const Page = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #fff8ec 0%, #ffeacc 45%, #f7e0ff 100%);
  font-family: 'Poppins', sans-serif;
  padding-bottom: 80px;
`

const TopBar = styled.header`
  padding: 20px 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const Shell = styled.div`
  max-width: 720px;
  margin: 0 auto;
  padding: 0 24px;
`

const Card = styled.div<{ children?: React.ReactNode }>`
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 24px;
  padding: 36px;
  margin-bottom: 20px;
  box-shadow: 0 8px 40px -16px rgba(29, 60, 52, 0.2);
  animation: ${fadeIn} 0.5s ease both;
`

const StatusBadge = styled.span<{ status: string }>`
  display: inline-block;
  padding: 4px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  background: ${({ status }) =>
    status === 'Paid' ? '#dcfce7' :
    status === 'Refunded' ? '#dbeafe' :
    status === 'Cancelled' ? '#f3f4f6' :
    status === 'Failed' ? '#fee2e2' : '#fef9c3'};
  color: ${({ status }) =>
    status === 'Paid' ? '#15803d' :
    status === 'Refunded' ? '#1d4ed8' :
    status === 'Cancelled' ? '#6b7280' :
    status === 'Failed' ? '#dc2626' : '#92400e'};
`

const PageTitle = styled.h1`
  font-size: 26px;
  font-weight: 700;
  color: #000929;
  margin: 0 0 4px;
`

const Sub = styled.p`
  color: #6b7280;
  font-size: 14px;
  margin: 0 0 24px;
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  @media (max-width: 480px) { grid-template-columns: 1fr; }
`

const FieldBox = styled.div`
  background: #f9fafb;
  border-radius: 12px;
  padding: 14px 16px;
`

const FieldLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #9aa1ad;
  margin-bottom: 4px;
`

const FieldValue = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: #12141d;
`

const SectionTitle = styled.h2`
  font-size: 17px;
  font-weight: 700;
  color: #1d3c34;
  margin: 0 0 16px;
`

const ActionRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 8px;
`

const Btn = styled.button<{ danger?: boolean }>`
  padding: 12px 24px;
  border-radius: 12px;
  border: none;
  font-family: inherit;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  background: ${({ danger }) => (danger ? '#fee2e2' : '#1d3c34')};
  color: ${({ danger }) => (danger ? '#dc2626' : '#fff')};
  &:hover { opacity: 0.85; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`

const Notice = styled.div<{ type?: 'warn' | 'info' }>`
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 13px;
  background: ${({ type }) => (type === 'warn' ? '#fef9c3' : '#eff6ff')};
  color: ${({ type }) => (type === 'warn' ? '#92400e' : '#1e40af')};
  border: 1px solid ${({ type }) => (type === 'warn' ? '#fde68a' : '#bfdbfe')};
  margin-bottom: 16px;
`

type BookingFields = Record<string, unknown>

const fmt = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

export default function StorageBookingPage() {
  const router = useRouter()
  const { id } = router.query as { id: string }

  const [fields, setFields] = useState<BookingFields | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    axios
      .get(`/api/storage/${id}`)
      .then((r) => { setFields(r.data.fields); setLoading(false) })
      .catch(() => { setError('Booking not found.'); setLoading(false) })
  }, [id])

  const canCancel = (): boolean => {
    if (!fields) return false
    const payStatus = fields['Payment Status'] as string
    if (payStatus === 'Cancelled' || payStatus === 'Refunded') return false
    const dropoff = fields['ArrivalDate'] as string
    if (!dropoff) return true
    const hoursUntil = dayjs(dropoff).diff(dayjs(), 'hour')
    return hoursUntil > 12
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel this booking? A full refund will be issued if payment was made.')) return
    setCancelling(true)
    try {
      const payStatus = fields?.['Payment Status'] as string
      if (payStatus === 'Paid') {
        await axios.post('/api/storage/refund', { bookingId: id })
      }
      await axios.patch(`/api/storage/${id}`, { 'Payment Status': 'Cancelled' })
      setFields((f) => ({ ...f, 'Payment Status': 'Cancelled' }))
      setCancelled(true)
    } catch {
      alert('Could not cancel. Please contact bagbee@bagbee.is.')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <Page>
        <TopBar><Link href='/' aria-label='BagBee home'><Logo /></Link></TopBar>
        <Shell><Card><Sub>Loading your booking…</Sub></Card></Shell>
      </Page>
    )
  }

  if (error || !fields) {
    return (
      <Page>
        <TopBar><Link href='/' aria-label='BagBee home'><Logo /></Link></TopBar>
        <Shell>
          <Card><>
            <PageTitle>Booking not found</PageTitle>
            <Sub>{error || 'This link may be expired or incorrect.'}</Sub>
            <Btn onClick={() => router.push('/luggagestorage')}>Make a new booking</Btn>
          </></Card>
        </Shell>
      </Page>
    )
  }

  const payStatus = fmt(fields['Payment Status'])
  const dropoffDate = fmt(fields['ArrivalDate'])
  const pickupDate = fmt(fields['Departure date'])

  return (
    <Page>
      <NextSeo title={`Storage booking — BagBee`} noindex />
      <TopBar>
        <Link href='/' aria-label='BagBee home'><Logo /></Link>
        <Link href='/luggagestorage' style={{ fontSize: 14, color: '#1d3c34', fontWeight: 500 }}>
          New booking
        </Link>
      </TopBar>

      <Shell>
        <Card><>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <PageTitle>Your storage booking</PageTitle>
            <StatusBadge status={payStatus}>{payStatus}</StatusBadge>
          </div>
          <Sub>
            {fields['Name'] ? `${fields['Name']} · ` : ''}
            Booking reference: <code style={{ fontSize: 12 }}>{id}</code>
          </Sub>

          {cancelled && (
            <Notice type='info'>
              Your booking has been cancelled. A refund has been issued and should appear within 5–10 business days.
            </Notice>
          )}

          {!canCancel() && payStatus !== 'Cancelled' && payStatus !== 'Refunded' && (
            <Notice type='warn'>
              Cancellations are accepted up to 12 hours before drop-off. For help, email{' '}
              <a href='mailto:bagbee@bagbee.is'>bagbee@bagbee.is</a>.
            </Notice>
          )}

          <Grid>
            <FieldBox>
              <FieldLabel>Drop-off date</FieldLabel>
              <FieldValue>
                {dropoffDate !== '—' ? dayjs(dropoffDate).format('DD MMM YYYY') : '—'}
              </FieldValue>
            </FieldBox>
            <FieldBox>
              <FieldLabel>Check-in time</FieldLabel>
              <FieldValue>{fmt(fields['Arrival time'])}</FieldValue>
            </FieldBox>
            <FieldBox>
              <FieldLabel>Pick-up date</FieldLabel>
              <FieldValue>
                {pickupDate !== '—' ? dayjs(pickupDate).format('DD MMM YYYY') : '—'}
              </FieldValue>
            </FieldBox>
            <FieldBox>
              <FieldLabel>Check-out time</FieldLabel>
              <FieldValue>{fmt(fields['Departure time'])}</FieldValue>
            </FieldBox>
            <FieldBox>
              <FieldLabel>Luggage items</FieldLabel>
              <FieldValue>{fmt(fields['Luggage'])}</FieldValue>
            </FieldBox>
            <FieldBox>
              <FieldLabel>Backpacks / purses</FieldLabel>
              <FieldValue>{fmt(fields['Backpack / Purse (ISK 1000 pr. item)'])}</FieldValue>
            </FieldBox>
            <FieldBox>
              <FieldLabel>Storage type</FieldLabel>
              <FieldValue>{fmt(fields['Type of storage'])}</FieldValue>
            </FieldBox>
            <FieldBox>
              <FieldLabel>Total paid</FieldLabel>
              <FieldValue>
                {fields['Total Amount ISK'] ? `${Number(fields['Total Amount ISK']).toLocaleString()} kr` : '—'}
              </FieldValue>
            </FieldBox>
          </Grid>

          {fields['Delivery Service'] && (
            <div style={{ marginTop: 16 }}>
              <SectionTitle>Hotel delivery</SectionTitle>
              <Grid>
                {fields['Hotel or Cruise ship name'] && (
                  <FieldBox>
                    <FieldLabel>Hotel</FieldLabel>
                    <FieldValue>{fmt(fields['Hotel or Cruise ship name'])}</FieldValue>
                  </FieldBox>
                )}
                {fields['Delivery Address'] && (
                  <FieldBox>
                    <FieldLabel>Address</FieldLabel>
                    <FieldValue>{fmt(fields['Delivery Address'])}</FieldValue>
                  </FieldBox>
                )}
              </Grid>
            </div>
          )}
        </></Card>

        {!cancelled && payStatus !== 'Cancelled' && payStatus !== 'Refunded' && (
          <Card><>
            <SectionTitle>Manage booking</SectionTitle>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 16px' }}>
              Need to change your dates or number of bags? Contact us and we&apos;ll update it for you.
            </p>
            <ActionRow>
              <Btn as='a' href={`mailto:bagbee@bagbee.is?subject=Change booking ${id}`}>
                Request a change
              </Btn>
              {canCancel() && (
                <Btn danger onClick={handleCancel} disabled={cancelling}>
                  {cancelling ? 'Cancelling…' : 'Cancel booking'}
                </Btn>
              )}
            </ActionRow>
          </></Card>
        )}
      </Shell>
    </Page>
  )
}
