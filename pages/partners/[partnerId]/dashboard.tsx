import styled from '@emotion/styled'
import { GetServerSideProps } from 'next'
import { useEffect, useMemo, useState } from 'react'
import PartnerLayout from '../../../components/partners/PartnerLayout'
import { PARTNERS, PartnerId, isPartnerId, verifySession } from '../../../utils/partnerAuth'
import {
  computeKpis,
  Kpis,
  listPartnerOrders,
  OrderSummary,
} from '../../../utils/partnerOrders'

type Props = {
  partnerId: PartnerId
  partnerDisplayName: string
  // Email of the signed-in staffer (from the verified session cookie). The
  // "My orders" filter and new-order-form autofill both default to this;
  // users can override on the dashboard if they're booking on behalf of a
  // colleague. Legacy shared-password sessions get a "legacy@…" tag which
  // the UI treats as "not signed in as a specific person".
  sessionEmail: string
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
  const partnerSlug = ctx.params?.partnerId
  if (!isPartnerId(partnerSlug)) return { notFound: true }
  const partnerId = partnerSlug
  const session = verifySession(ctx.req)
  if (!session || session.partnerId !== partnerId) {
    return {
      redirect: { destination: `/partners/${partnerId}/login`, permanent: false },
    }
  }
  // Legacy shared-password sessions are tagged `legacy@<partner>.local`
  // (see setPartnerCookie). Surface empty string for those so the UI doesn't
  // pre-populate the "My orders" email box with a synthetic address.
  const sessionEmail = session.email.startsWith('legacy@')
    ? ''
    : session.email
  try {
    const orders = await listPartnerOrders(partnerId)
    orders.sort(sortDispatcherOrder)
    const kpis = computeKpis(orders)
    return {
      props: {
        partnerId,
        partnerDisplayName: PARTNERS[partnerId].displayName,
        sessionEmail,
        initialOrders: orders,
        initialKpis: kpis,
      },
    }
  } catch (err) {
    console.error('[dashboard SSR] failed', err)
    return {
      props: {
        partnerId,
        partnerDisplayName: PARTNERS[partnerId].displayName,
        sessionEmail,
        initialOrders: [],
        initialKpis: computeKpis([]),
      },
    }
  }
}

const KpiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin: 0 0 24px;
  @media (max-width: 720px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
`

const KpiCard = styled.div`
  background: white;
  border-radius: 10px;
  padding: 14px 16px;
  border: 1px solid #ecedf0;
  @media (max-width: 720px) {
    padding: 10px 10px;
  }
`

const KpiLabel = styled.div`
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: #696f79;
  @media (max-width: 720px) {
    font-size: 11px;
  }
`

const KpiValue = styled.div`
  font-family: 'Poppins', sans-serif;
  font-size: 24px;
  font-weight: 600;
  color: #000929;
  margin-top: 4px;
  line-height: 1.1;
  @media (max-width: 720px) {
    font-size: 20px;
  }
`

const KpiSub = styled.div`
  font-family: 'Poppins', sans-serif;
  font-size: 11px;
  color: #a3a4a7;
  margin-top: 2px;
  @media (max-width: 720px) {
    font-size: 10px;
  }
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
  width: 240px;
  border-radius: 10px;
  border: 1px solid #d9dde2;
  outline: none;
  background: white url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' stroke='%23696f79' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E")
    10px center / 16px 16px no-repeat;
  &:focus { border-color: #3d7165; }
  @media (max-width: 720px) {
    width: 100%;
  }
`

const StaffEmailBox = styled.div`
  display: flex;
  align-items: center;
  @media (max-width: 720px) {
    width: 100%;
  }
`

const StaffEmailInput = styled.input`
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  padding: 9px 12px;
  width: 220px;
  border-radius: 10px;
  border: 1px solid #d9dde2;
  background: white;
  outline: none;
  &:focus { border-color: #3d7165; }
  @media (max-width: 720px) {
    width: 100%;
  }
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

// Below 720px we collapse the table into a card-per-row layout. Each row
// becomes a stacked card; each cell is prefixed with its column label via
// the `data-label` attribute. The Status / Bags cells get a flex-row at
// the bottom so the badge + bag count sit side-by-side.
const MOBILE_BREAKPOINT = '720px'

const TableCard = styled.div`
  background: white;
  border-radius: 10px;
  border: 1px solid #ecedf0;
  overflow: hidden;
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-family: 'Poppins', sans-serif;
  @media (max-width: ${MOBILE_BREAKPOINT}) {
    display: block;
    & thead {
      display: none;
    }
    & tbody {
      display: block;
    }
  }
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
  @media (max-width: ${MOBILE_BREAKPOINT}) {
    padding: 0;
    border: none;
    display: block;
    /* Hide the auto-injected label by default; specific cells re-enable. */
    &::before {
      content: attr(data-label);
      display: block;
      font-size: 10px;
      font-weight: 600;
      color: #a3a4a7;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
    }
    /* Compact, label-less cells where the value is self-explanatory. */
    &[data-label='Ref #']::before,
    &[data-label='Service']::before,
    &[data-label='Pickup']::before,
    &[data-label='Bags']::before,
    &[data-label='Status']::before {
      display: none;
    }
    &[data-label='Ref #'] {
      font-size: 16px;
      font-weight: 700;
    }
    &[data-label='Status'] {
      justify-self: end;
      text-align: right;
    }
    &[data-label='Service'] {
      color: #696f79;
      font-size: 12px;
    }
  }
`

const Row = styled.tr`
  transition: background 0.1s;
  &:hover { background: #fafbfc; cursor: pointer; }
  @media (max-width: ${MOBILE_BREAKPOINT}) {
    display: grid;
    grid-template-columns: 1fr auto;
    /* DOM order: Ref / Pickup / Service / From / To / Bags / Driver / Status.
       We name areas so each cell drops into a logical spot regardless of
       DOM order: identifier strip on top, then schedule, locations, dispatch. */
    grid-template-areas:
      'ref status'
      'pickup pickup'
      'service service'
      'from to'
      'driver bags';
    column-gap: 16px;
    row-gap: 10px;
    align-items: start;
    padding: 16px 18px;
    border-bottom: 1px solid #f1f2f4;
    &:last-child {
      border-bottom: none;
    }
    & > td[data-label='Ref #'] { grid-area: ref; }
    & > td[data-label='Pickup'] { grid-area: pickup; }
    & > td[data-label='Service'] { grid-area: service; }
    & > td[data-label='From'] { grid-area: from; }
    & > td[data-label='To'] { grid-area: to; }
    & > td[data-label='Bags'] { grid-area: bags; justify-self: end; }
    & > td[data-label='Driver'] { grid-area: driver; }
    & > td[data-label='Status'] { grid-area: status; }
  }
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
// Iceland Travel uses dd/mm/yyyy — keep displays consistent across staff
// devices regardless of OS locale.
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const fmtDateShort = (s: string | null) => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getUTCFullYear()}`
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

// localStorage key that holds the staffer's email for this browser. The
// portal still uses a shared partner password (single Iceland Travel
// session) — this is purely a per-browser tag the staffer types once so
// the dashboard can filter to "my orders" and the new-order form can
// autofill their contact email.
const STAFF_EMAIL_KEY = 'bb_partner_staff_email'

export default function PartnerDashboard({
  partnerId,
  partnerDisplayName,
  sessionEmail,
  initialOrders,
  initialKpis,
}: Props) {
  const [orders, setOrders] = useState<OrderSummary[]>(initialOrders)
  const [kpis, setKpis] = useState<Kpis>(initialKpis)
  const [filter, setFilter] = useState<StatusFilter>('upcoming')
  const [query, setQuery] = useState('')
  // Default to the verified session email (set by the email-code login).
  // If there's no session email (legacy password login), fall back to the
  // browser-local tag in localStorage. The user can still type a different
  // email into the input to override either.
  const [staffEmail, setStaffEmail] = useState(sessionEmail)
  const [mineOnly, setMineOnly] = useState(false)

  // For legacy sessions only: load the staffer email from localStorage on
  // mount. New email-code logins already populate staffEmail from
  // sessionEmail at first render, so we don't overwrite that here.
  useEffect(() => {
    if (sessionEmail) return
    try {
      const saved = window.localStorage.getItem(STAFF_EMAIL_KEY)
      if (saved) setStaffEmail(saved)
    } catch {
      /* localStorage blocked — silently ignore */
    }
  }, [sessionEmail])

  const persistStaffEmail = (val: string) => {
    setStaffEmail(val)
    try {
      if (val.trim()) {
        window.localStorage.setItem(STAFF_EMAIL_KEY, val.trim())
      } else {
        window.localStorage.removeItem(STAFF_EMAIL_KEY)
      }
    } catch {
      /* localStorage blocked — silently ignore */
    }
  }

  // Background refresh so dispatcher status changes show up automatically.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/partners/${partnerId}/orders`)
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
    const myEmail = staffEmail.trim().toLowerCase()
    return orders.filter((o) => {
      if (!matchesFilter(filter, o)) return false
      if (mineOnly && myEmail) {
        const ordEmail = (o.email || '').trim().toLowerCase()
        if (ordEmail !== myEmail) return false
      }
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
  }, [orders, filter, query, mineOnly, staffEmail])

  return (
    <PartnerLayout partnerId={partnerId} partnerDisplayName={partnerDisplayName}>
      <KpiGrid>
        <KpiCard>
          <KpiLabel>Next 7 days</KpiLabel>
          <KpiValue>{kpis.next7dCount}</KpiValue>
          <KpiSub>{kpis.upcomingTotal} future orders</KpiSub>
        </KpiCard>
        <KpiCard>
          <KpiLabel>Today</KpiLabel>
          <KpiValue>{kpis.todayCount}</KpiValue>
          <KpiSub>
            {kpis.todayBags} bag{kpis.todayBags === 1 ? '' : 's'}
          </KpiSub>
        </KpiCard>
        <KpiCard>
          <KpiLabel>In progress</KpiLabel>
          <KpiValue>{kpis.inProgress}</KpiValue>
          <KpiSub>currently running</KpiSub>
        </KpiCard>
      </KpiGrid>

      <SectionHead>
        <SectionTitle>Orders</SectionTitle>
        <Toolbar>
          {/* For session-authenticated users the login email IS the source
              of truth — no input box needed. The text-entry box only shows
              for legacy shared-password sessions (sessionEmail empty) so
              those users can still self-tag for "My projects". */}
          {!sessionEmail && (
            <StaffEmailBox>
              <StaffEmailInput
                type="email"
                placeholder="Your email (for My projects)"
                value={staffEmail}
                onChange={(e) => persistStaffEmail(e.target.value)}
                spellCheck={false}
                autoCapitalize="off"
              />
            </StaffEmailBox>
          )}
          <Search
            placeholder="Search by your reference number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Pill
            isActive={mineOnly}
            onClick={() => setMineOnly((v) => !v)}
            disabled={!staffEmail.trim()}
            title={
              staffEmail.trim()
                ? `Show only bookings under ${staffEmail}`
                : 'Type your email first'
            }
          >
            My projects
          </Pill>
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
                <Th>Date of service</Th>
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
                      window.location.href = `/partners/${partnerId}/orders/${o.id}`
                    }}
                  >
                    <Td data-label="Ref #">
                      {o.reference ? (
                        <div style={{ fontWeight: 600 }}>{o.reference}</div>
                      ) : (
                        <span style={{ color: '#a3a4a7', fontSize: 12 }}>—</span>
                      )}
                    </Td>
                    <Td data-label="Pickup">
                      <div style={{ fontWeight: 600 }}>{fmtDateShort(o.pickupDate)}</div>
                      <div style={{ color: '#696f79', fontSize: 11, marginTop: 2 }}>
                        {fmtDateWeekday(o.pickupDate)} · {o.timeWindow || '—'}
                      </div>
                    </Td>
                    <Td data-label="Service">{o.serviceType || '—'}</Td>
                    <Td data-label="From">
                      <div>{o.pickupAddress || '—'}</div>
                      {o.timeWindow && (
                        <div style={{ color: '#696f79', fontSize: 11, marginTop: 2 }}>
                          {o.timeWindow}
                        </div>
                      )}
                    </Td>
                    <Td data-label="To">
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
                    <Td data-label="Bags">
                      <Bag>
                        {total} bag{total === 1 ? '' : 's'}
                        {o.bagsOdd > 0 ? ` (${o.bagsOdd} odd)` : ''}
                      </Bag>
                    </Td>
                    <Td data-label="Driver">
                      {o.driverName ? (
                        <Driver onClick={(e) => e.stopPropagation()}>
                          <DriverName>{o.driverName}</DriverName>
                          {o.driverPhone ? (
                            <PhoneLink href={`tel:${o.driverPhone}`}>
                              {o.driverPhone}
                            </PhoneLink>
                          ) : (
                            <Muted>no phone on file</Muted>
                          )}
                        </Driver>
                      ) : (
                        <Unassigned>Unassigned</Unassigned>
                      )}
                    </Td>
                    <Td data-label="Status">
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
                          Track
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
