import styled from '@emotion/styled'
import { GetServerSideProps } from 'next'
import { useEffect, useMemo, useState } from 'react'
import PartnerLayout from '../../../components/partners/PartnerLayout'
import { PARTNERS, verifyPartner } from '../../../utils/partnerAuth'
import {
  computeKpis,
  Kpis,
  listPartnerOrders,
  OrderSummary,
} from '../../../utils/partnerOrders'

type Props = {
  partnerDisplayName: string
  initialOrders: OrderSummary[]
  initialKpis: Kpis
}

// Sort by pickup date ascending (soonest first) — the dispatcher's natural
// reading order. Live (non-cancelled/delivered) orders float first; past /
// cancelled / delivered fall to the bottom.
const sortDispatcherOrder = (a: OrderSummary, b: OrderSummary) => {
  const aTerminal = a.status === 'Cancelled' || a.status === 'Delivered'
  const bTerminal = b.status === 'Cancelled' || b.status === 'Delivered'
  if (aTerminal !== bTerminal) return aTerminal ? 1 : -1
  const at = a.pickupDate ? Date.parse(a.pickupDate) : Number.POSITIVE_INFINITY
  const bt = b.pickupDate ? Date.parse(b.pickupDate) : Number.POSITIVE_INFINITY
  return at - bt
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const partner = verifyPartner(ctx.req)
  if (partner !== 'iceland-travel') {
    return {
      redirect: { destination: '/partners/iceland-travel/login', permanent: false },
    }
  }
  try {
    const orders = await listPartnerOrders('iceland-travel')
    orders.sort(sortDispatcherOrder)
    const kpis = computeKpis(orders)
    return {
      props: {
        partnerDisplayName: PARTNERS[partner].displayName,
        initialOrders: orders,
        initialKpis: kpis,
      },
    }
  } catch (err) {
    console.error('[dashboard SSR] failed', err)
    return {
      props: {
        partnerDisplayName: PARTNERS[partner].displayName,
        initialOrders: [],
        initialKpis: computeKpis([]),
      },
    }
  }
}

const Hero = styled.section`
  margin-bottom: 24px;
`

const HeroTitle = styled.h1`
  font-family: 'Poppins', sans-serif;
  font-size: 30px;
  font-weight: 700;
  color: #000929;
  margin: 0 0 4px;
  letter-spacing: -0.5px;
`

const HeroSub = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #696f79;
  margin: 0;
`

const KpiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin: 22px 0 32px;
`

const KpiCard = styled.div<{ accent?: string }>`
  background: white;
  border-radius: 18px;
  padding: 18px 20px;
  border: 1px solid #ecedf0;
  position: relative;
  overflow: hidden;
  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: ${({ accent }) => accent || '#3d7165'};
  }
`

const KpiLabel = styled.div`
  font-family: 'Poppins', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: #696f79;
  letter-spacing: 0.4px;
  text-transform: uppercase;
`

const KpiValue = styled.div`
  font-family: 'Poppins', sans-serif;
  font-size: 32px;
  font-weight: 700;
  color: #000929;
  margin-top: 6px;
  letter-spacing: -0.5px;
  line-height: 1.05;
`

const KpiSub = styled.div`
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  color: #696f79;
  margin-top: 4px;
`

const SectionHead = styled.div`
  display: flex;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 12px;
`

const SectionTitle = styled.h2`
  font-family: 'Poppins', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: #000929;
  margin: 0;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`

const Search = styled.input`
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  padding: 9px 12px 9px 36px;
  width: 260px;
  border-radius: 10px;
  border: 1px solid #d9dde2;
  outline: none;
  background: white url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' stroke='%23696f79' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E")
    10px center / 16px 16px no-repeat;
  &:focus { border-color: #3d7165; }
`

const Pill = styled('button', {
  shouldForwardProp: (prop) => prop !== 'isActive',
})<{ isActive: boolean }>`
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 500;
  padding: 7px 13px;
  border-radius: 999px;
  border: 1px solid ${({ isActive }) => (isActive ? '#3d7165' : '#d9dde2')};
  background: ${({ isActive }) => (isActive ? '#3d7165' : 'white')};
  color: ${({ isActive }) => (isActive ? 'white' : '#000929')};
  cursor: pointer;
  &:hover { border-color: #3d7165; }
`

const TableCard = styled.div`
  background: white;
  border-radius: 18px;
  border: 1px solid #ecedf0;
  overflow: hidden;
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-family: 'Poppins', sans-serif;
`

const Th = styled.th`
  text-align: left;
  padding: 13px 18px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #696f79;
  background: #f7f8fa;
  border-bottom: 1px solid #ecedf0;
  white-space: nowrap;
`

const Td = styled.td`
  padding: 14px 18px;
  font-size: 13px;
  color: #000929;
  border-bottom: 1px solid #f1f2f4;
  vertical-align: top;
`

const Row = styled.tr`
  transition: background 0.1s;
  &:hover { background: #fafbfc; cursor: pointer; }
`

const Badge = styled.span<{ bg: string }>`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  background: ${({ bg }) => bg};
  color: white;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  white-space: nowrap;
`

const Bag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  background: #f0f4f3;
  color: #2d5d52;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
`

const Driver = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
`

const DriverName = styled.span`
  font-weight: 600;
  color: #000929;
`

const PhoneLink = styled.a`
  color: #3d7165;
  text-decoration: none;
  font-size: 11px;
  &:hover { text-decoration: underline; }
`

const Unassigned = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: #b45309;
  background: #fef3c7;
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
`

const TrackLink = styled.a`
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  color: #2d7ff9;
  font-size: 12px;
  text-decoration: none;
  &:hover { text-decoration: underline; }
`

const Muted = styled.span`
  color: #696f79;
  font-size: 11px;
`

const Empty = styled.div`
  padding: 60px 20px;
  text-align: center;
  font-family: 'Poppins', sans-serif;
`

const EmptyTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: #000929;
`

const EmptySub = styled.div`
  font-size: 13px;
  color: #696f79;
  margin-top: 4px;
`

// Locale-free formatters (avoid hydration mismatches from Intl ICU drift).
const MONTHS_SHORT = [
  'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec',
]
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const fmtDateShort = (s: string | null) => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${dd} ${MONTHS_SHORT[d.getUTCMonth()]}`
}

const fmtDateWeekday = (s: string | null) => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return DAYS_SHORT[d.getUTCDay()]
}

// Pickup & Delivery deliveries are local-to-local (no airline / no flight).
const isLocalTransfer = (serviceType: string | null): boolean =>
  serviceType === 'Pickup & Delivery' ||
  serviceType === 'Delivery from storage' ||
  serviceType === 'BSI to Hotel Delivery'

type StatusFilter =
  | 'upcoming'
  | 'today'
  | 'unassigned'
  | 'inProgress'
  | 'delivered'
  | 'cancelled'
  | 'all'

const isToday = (s: string | null) => {
  if (!s) return false
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  )
}

const matchesFilter = (filter: StatusFilter, o: OrderSummary): boolean => {
  if (filter === 'all') return true
  if (filter === 'cancelled') return o.status === 'Cancelled'
  if (filter === 'delivered') return o.status === 'Delivered'
  if (filter === 'inProgress') return o.status === 'In Progress'
  if (filter === 'today') {
    return isToday(o.pickupDate) && o.status !== 'Cancelled' && o.status !== 'Delivered'
  }
  if (filter === 'unassigned') {
    return !o.driverName && o.status !== 'Cancelled' && o.status !== 'Delivered'
  }
  // 'upcoming' = future (or today) live orders
  if (filter === 'upcoming') {
    if (o.status === 'Cancelled' || o.status === 'Delivered') return false
    if (!o.pickupDate) return true
    const t = Date.parse(o.pickupDate)
    if (!Number.isFinite(t)) return true
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return t >= start.getTime()
  }
  return true
}

export default function PartnerDashboard({
  partnerDisplayName,
  initialOrders,
  initialKpis,
}: Props) {
  const [orders, setOrders] = useState<OrderSummary[]>(initialOrders)
  const [kpis, setKpis] = useState<Kpis>(initialKpis)
  const [filter, setFilter] = useState<StatusFilter>('upcoming')
  const [query, setQuery] = useState('')

  // Client-only today string — avoids hydration mismatch on locale formatting.
  const [today, setToday] = useState<string>('')
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    )
  }, [])

  // Background refresh so dispatcher status changes show up automatically.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/partners/iceland-travel/orders')
        if (!res.ok) return
        const data = (await res.json()) as { orders: OrderSummary[]; kpis: Kpis }
        setOrders(data.orders.slice().sort(sortDispatcherOrder))
        setKpis(data.kpis)
      } catch {
        /* ignore */
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders.filter((o) => {
      if (!matchesFilter(filter, o)) return false
      if (!q) return true
      // Reference number is what Iceland Travel staff actually search by,
      // so it gets first priority. Other fields are a fallback so the box
      // still works for ad-hoc lookups (driver, flight, pickup spot).
      const ref = (o.reference || '').toLowerCase()
      if (ref && ref.includes(q)) return true
      const hay = [
        o.driverName,
        o.serviceType,
        o.pickupAddress,
        o.deliveryAddress,
        o.flightNumber,
        o.airline,
        o.comment,
        o.destinationCode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [orders, filter, query])

  return (
    <PartnerLayout partnerDisplayName={partnerDisplayName}>
      <Hero>
        <HeroTitle>Welcome back, {partnerDisplayName}</HeroTitle>
        <HeroSub>
          {today ? `${today} · ` : ''}dispatcher view for your bookings with BagBee
        </HeroSub>
      </Hero>

      <KpiGrid>
        <KpiCard accent="#3d7165">
          <KpiLabel>Upcoming pickups</KpiLabel>
          <KpiValue>{kpis.next7dCount}</KpiValue>
          <KpiSub>
            in the next 7 days · {kpis.upcomingTotal} future orders total
          </KpiSub>
        </KpiCard>
        <KpiCard accent="#fcb400">
          <KpiLabel>Today</KpiLabel>
          <KpiValue>{kpis.todayCount}</KpiValue>
          <KpiSub>
            {kpis.todayBags} bag{kpis.todayBags === 1 ? '' : 's'} scheduled today
          </KpiSub>
        </KpiCard>
        <KpiCard accent="#2d7ff9">
          <KpiLabel>In progress</KpiLabel>
          <KpiValue>{kpis.inProgress}</KpiValue>
          <KpiSub>orders being run right now</KpiSub>
        </KpiCard>
      </KpiGrid>

      <SectionHead>
        <SectionTitle>Orders</SectionTitle>
        <Toolbar>
          <Search
            placeholder="Search by your reference number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {(
            [
              ['upcoming', 'Upcoming'],
              ['today', 'Today'],
              ['inProgress', 'In progress'],
              ['delivered', 'Delivered'],
              ['cancelled', 'Cancelled'],
              ['all', 'All'],
            ] as Array<[StatusFilter, string]>
          ).map(([key, label]) => (
            <Pill key={key} isActive={filter === key} onClick={() => setFilter(key)}>
              {label}
            </Pill>
          ))}
        </Toolbar>
      </SectionHead>

      <TableCard>
        {visible.length === 0 ? (
          <Empty>
            <EmptyTitle>No orders match this view</EmptyTitle>
            <EmptySub>Try a different filter or search term.</EmptySub>
          </Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Ref #</Th>
                <Th>Pickup</Th>
                <Th>Service</Th>
                <Th>From</Th>
                <Th>To</Th>
                <Th>Bags</Th>
                <Th>Driver</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => {
                const total = o.bagsRegular + o.bagsOdd
                const local = isLocalTransfer(o.serviceType)
                const goingTo = local
                  ? o.deliveryAddress || '—'
                  : `${o.airline || ''} ${o.flightNumber || ''}`.trim() ||
                    o.destinationCode ||
                    '—'
                return (
                  <Row
                    key={o.id}
                    onClick={() => {
                      window.location.href = `/partners/iceland-travel/orders/${o.id}`
                    }}
                  >
                    <Td>
                      {o.reference ? (
                        <div style={{ fontWeight: 600 }}>{o.reference}</div>
                      ) : (
                        <span style={{ color: '#a3a4a7', fontSize: 12 }}>—</span>
                      )}
                    </Td>
                    <Td>
                      <div style={{ fontWeight: 600 }}>{fmtDateShort(o.pickupDate)}</div>
                      <div style={{ color: '#696f79', fontSize: 11, marginTop: 2 }}>
                        {fmtDateWeekday(o.pickupDate)} · {o.timeWindow || '—'}
                      </div>
                    </Td>
                    <Td>{o.serviceType || '—'}</Td>
                    <Td>
                      <div>{o.pickupAddress || '—'}</div>
                      {o.timeWindow && (
                        <div style={{ color: '#696f79', fontSize: 11, marginTop: 2 }}>
                          {o.timeWindow}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <div>{goingTo}</div>
                      {/* Same-day is the default for Iceland Travel orders;
                          only the time window is worth surfacing here. If
                          a delivery date differs from pickup it's a
                          multi-day order — show that date alongside. */}
                      {local &&
                        (() => {
                          const parts: string[] = []
                          if (
                            o.deliveryDate &&
                            o.deliveryDate !== o.pickupDate
                          ) {
                            parts.push(fmtDateShort(o.deliveryDate))
                          }
                          if (o.deliveryTimeWindow) parts.push(o.deliveryTimeWindow)
                          if (parts.length === 0) return null
                          return (
                            <div
                              style={{
                                color: '#696f79',
                                fontSize: 11,
                                marginTop: 2,
                              }}
                            >
                              {parts.join(' · ')}
                            </div>
                          )
                        })()}
                    </Td>
                    <Td>
                      <Bag>
                        <span aria-hidden>🧳</span> {total}
                        {o.bagsOdd > 0 ? ` (${o.bagsOdd} odd)` : ''}
                      </Bag>
                    </Td>
                    <Td>
                      {o.driverName ? (
                        <Driver onClick={(e) => e.stopPropagation()}>
                          <DriverName>{o.driverName}</DriverName>
                          {o.driverPhone ? (
                            <PhoneLink href={`tel:${o.driverPhone}`}>
                              📞 {o.driverPhone}
                            </PhoneLink>
                          ) : (
                            <Muted>no phone on file</Muted>
                          )}
                        </Driver>
                      ) : (
                        <Unassigned>Awaiting</Unassigned>
                      )}
                    </Td>
                    <Td>
                      {o.status ? (
                        <Badge bg={o.statusColor || '#6b7280'}>{o.status}</Badge>
                      ) : (
                        '—'
                      )}
                      {o.optimoTrackingLink && (
                        <TrackLink
                          href={o.optimoTrackingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Open OptimoRoute tracking"
                        >
                          🗺️ Track
                        </TrackLink>
                      )}
                    </Td>
                  </Row>
                )
              })}
            </tbody>
          </Table>
        )}
      </TableCard>
    </PartnerLayout>
  )
}
