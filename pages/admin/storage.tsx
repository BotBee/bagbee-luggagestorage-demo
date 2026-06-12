// @ts-nocheck — large interactive admin page, inline styles; not type-critical.
//
// BagBee staff STORAGE OPERATIONS dashboard (/admin/storage).
//
// One screen to run the BSÍ depot off the unified BSI Storage table:
//   • Today  — arriving / in storage / leaving, plus an attention list
//   • Upcoming — future bookings grouped by day
//   • Calendar — month grid with per-day in/out counts
//   • Search — find any active booking, filter by type/source/status
// Per booking: mark Dropped off (arrived) / Picked up (left) / Paid, assign a
// locker + colour sticker, and print bag labels (one per item, with a QR to the
// customer's manage page). A "New booking" form creates counter/phone bookings.
//
// Auth: same shared DISPATCH_ADMIN_KEY as /admin/dispatch, kept in localStorage
// under 'dispatch_admin_key' and sent as a Bearer token on every call.
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import toast, { Toaster } from 'react-hot-toast'

/* ── helpers ─────────────────────────────────────────────── */
const C = {
  green: '#1D3C34',
  green2: '#3D7165',
  yellow: '#F3AD3C',
  orange: '#E37F2F',
  red: '#b91c1c',
  redBg: '#fee2e2',
  bg: '#eef0f3',
  card: '#ffffff',
  line: '#e3e6ea',
  ink: '#0b0f1a',
  sub: '#6b7280',
  blue: '#2563eb',
}
const isoLocal = (d: Date) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return x.toISOString().slice(0, 10)
}
const TODAY = () => isoLocal(new Date())
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return isoLocal(d)
}
const fmtDay = (iso: string) => {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const SOURCE_COLORS: Record<string, string> = {
  'bagbee.is': '#1D3C34',
  'luggagelockers.is': '#7c3aed',
  'bikerent.is': '#0891b2',
  'BSI BikeRent': '#0891b2',
  'Cheap Luggage Storage': '#ca8a04',
  'BagBee website': '#1D3C34',
  Counter: '#475569',
}
const sourceColor = (r: string) => SOURCE_COLORS[r] || '#64748b'

const TYPE_OPTIONS = [
  'Short term storage',
  'Long term storage',
  'Long term + late check-out',
  'Put to luggage lockers',
  'Hotel Delivery',
  'Storage and Check-in',
  'Cruise day-storage',
]
const GREIDSLA = ['Kortafærsla', 'Cash', 'Krafa send', 'Dótel rukkar', 'FlyBus', 'Bókun.io']

/* ── component ───────────────────────────────────────────── */
export default function StorageOps() {
  const [adminKey, setAdminKey] = useState<string>('')
  const [keyInput, setKeyInput] = useState('')
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<'today' | 'upcoming' | 'calendar' | 'search'>('today')
  const [search, setSearch] = useState('')
  const [fType, setFType] = useState('')
  const [fSource, setFSource] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [calDay, setCalDay] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [labelFor, setLabelFor] = useState<any | null>(null)

  useEffect(() => {
    const k = (window.localStorage.getItem('dispatch_admin_key') || '').trim()
    if (k) setAdminKey(k)
  }, [])

  const fetchBookings = useCallback(
    async (range?: { from: string; to: string }) => {
      if (!adminKey) return
      setLoading(true)
      setErr(null)
      try {
        const qs = range ? `?from=${range.from}&to=${range.to}` : ''
        const r = await fetch(`/api/storage-ops/list${qs}`, {
          headers: { Authorization: `Bearer ${adminKey}` },
        })
        if (r.status === 401) {
          setErr('Invalid admin key.')
          setAdminKey('')
          window.localStorage.removeItem('dispatch_admin_key')
          return
        }
        const j = await r.json()
        if (!r.ok) throw new Error(j.message || 'Failed to load')
        setBookings(j.bookings || [])
      } catch (e: any) {
        setErr(e.message || 'Failed to load bookings')
      } finally {
        setLoading(false)
      }
    },
    [adminKey],
  )

  useEffect(() => {
    if (adminKey) fetchBookings()
  }, [adminKey, fetchBookings])

  const saveKey = () => {
    const k = keyInput.trim()
    if (!k) return
    window.localStorage.setItem('dispatch_admin_key', k)
    setAdminKey(k)
  }

  const patch = useCallback(
    async (id: string, updates: Record<string, unknown>) => {
      // optimistic
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)))
      try {
        const r = await fetch('/api/storage-ops/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminKey}` },
          body: JSON.stringify({ id, updates }),
        })
        if (!r.ok) throw new Error((await r.json()).message || 'Update failed')
      } catch (e: any) {
        toast.error(e.message || 'Update failed')
        fetchBookings()
      }
    },
    [adminKey, fetchBookings],
  )

  const today = TODAY()

  /* derived buckets */
  const active = useMemo(() => bookings.filter((b) => b.paymentStatus !== 'Cancelled'), [bookings])
  const arrivingToday = active.filter((b) => b.arrivalDate === today && !b.pickedUp)
  const leavingToday = active.filter((b) => b.departureDate === today && !b.pickedUp)
  const inStorage = active.filter((b) => b.droppedOff && !b.pickedUp)
  const overdue = active.filter((b) => b.departureDate && b.departureDate < today && !b.pickedUp)
  const unpaidSoon = active.filter(
    (b) => !b.paid && b.paymentStatus !== 'Paid' && b.arrivalDate && b.arrivalDate >= today && b.arrivalDate <= addDays(today, 3),
  )
  const bagsInStorage = inStorage.reduce((s, b) => s + (b.totalQty || b.luggage + b.backpacks || 0), 0)

  const upcoming = useMemo(() => {
    const list = active.filter((b) => b.arrivalDate && b.arrivalDate > today && !b.pickedUp)
    list.sort((a, b) => (a.arrivalDate < b.arrivalDate ? -1 : a.arrivalDate > b.arrivalDate ? 1 : 0))
    return list
  }, [active, today])

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    return active.filter((b) => {
      if (fType && b.type !== fType) return false
      if (fSource && b.reference !== fSource) return false
      if (fStatus === 'in') {
        if (!(b.droppedOff && !b.pickedUp)) return false
      } else if (fStatus === 'done') {
        if (!b.pickedUp) return false
      } else if (fStatus === 'unpaid') {
        if (b.paid || b.paymentStatus === 'Paid') return false
      } else if (fStatus === 'overdue') {
        if (!(b.departureDate && b.departureDate < today && !b.pickedUp)) return false
      }
      if (!q) return true
      return (
        (b.name || '').toLowerCase().includes(q) ||
        (b.bookingNumber || '').toLowerCase().includes(q) ||
        (b.email || '').toLowerCase().includes(q) ||
        (b.phone || '').toLowerCase().includes(q)
      )
    })
  }, [active, search, fType, fSource, fStatus, today])

  const sources = useMemo(() => Array.from(new Set(bookings.map((b) => b.reference).filter(Boolean))).sort(), [bookings])

  const openLabels = (ids: string[]) => {
    if (!ids.length) return toast.error('No bookings to print')
    window.open(`/admin/storage-label?ids=${ids.join(',')}`, '_blank')
  }

  /* ── key gate ── */
  if (!adminKey) {
    return (
      <div style={s.gate}>
        <div style={s.gateCard}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>BagBee · Storage Ops</div>
          <p style={{ color: C.sub, fontSize: 14, margin: '8px 0 16px' }}>Enter the staff admin key to continue.</p>
          <input
            style={s.input}
            type="password"
            placeholder="Admin key"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveKey()}
          />
          <button style={{ ...s.btnPrimary, width: '100%', marginTop: 12 }} onClick={saveKey}>
            Unlock
          </button>
          {err && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{err}</div>}
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <Head>
        <title>Storage Ops · BagBee</title>
      </Head>
      <Toaster position="top-right" />

      {/* header */}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 18, color: C.green }}>Storage Ops</span>
          <span style={{ fontSize: 13, color: C.sub }}>{fmtDay(today)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btnGhost} onClick={() => fetchBookings()} disabled={loading}>
            {loading ? '…' : '↻ Refresh'}
          </button>
          <button style={s.btnPrimary} onClick={() => setShowNew(true)}>
            + New booking
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={s.kpis}>
        <Kpi label="Arriving today" value={arrivingToday.length} color={C.green} onClick={() => setTab('today')} />
        <Kpi label="Leaving today" value={leavingToday.length} color={C.blue} onClick={() => setTab('today')} />
        <Kpi label="In storage now" value={inStorage.length} sub={`${bagsInStorage} bags`} color={C.green2} />
        <Kpi label="Overdue" value={overdue.length} color={overdue.length ? C.red : C.sub} alert={overdue.length > 0} onClick={() => { setTab('search'); setFStatus('overdue') }} />
        <Kpi label="Unpaid (≤3d)" value={unpaidSoon.length} color={unpaidSoon.length ? C.orange : C.sub} alert={unpaidSoon.length > 0} onClick={() => { setTab('search'); setFStatus('unpaid') }} />
      </div>

      {/* tabs */}
      <div style={s.tabs}>
        {(['today', 'upcoming', 'calendar', 'search'] as const).map((t) => (
          <button key={t} style={tab === t ? s.tabActive : s.tab} onClick={() => setTab(t)}>
            {t === 'today' ? 'Today' : t === 'upcoming' ? 'Upcoming' : t === 'calendar' ? 'Calendar' : 'Search'}
          </button>
        ))}
      </div>

      {err && <div style={s.errBar}>{err}</div>}

      {/* ── TODAY ── */}
      {tab === 'today' && (
        <div style={s.cols}>
          <Group title={`Arriving today (${arrivingToday.length})`} accent={C.green} action={arrivingToday.length ? { label: '🖨 Print all labels', onClick: () => openLabels(arrivingToday.map((b) => b.id)) } : undefined}>
            {arrivingToday.length === 0 && <Empty>No drop-offs today.</Empty>}
            {arrivingToday.map((b) => (
              <Card key={b.id} b={b} today={today} onPatch={patch} onLabel={setLabelFor} onPrint={(id) => openLabels([id])} />
            ))}
          </Group>
          <Group title={`Leaving today (${leavingToday.length})`} accent={C.blue}>
            {leavingToday.length === 0 && <Empty>No pick-ups today.</Empty>}
            {leavingToday.map((b) => (
              <Card key={b.id} b={b} today={today} onPatch={patch} onLabel={setLabelFor} onPrint={(id) => openLabels([id])} />
            ))}
          </Group>
          <Group title={`In storage now (${inStorage.length})`} accent={C.green2} sub={`${bagsInStorage} bags`}>
            {overdue.length > 0 && (
              <div style={s.attention}>⚠ {overdue.length} overdue (past pick-up, not collected)</div>
            )}
            {inStorage.length === 0 && <Empty>Nothing in storage.</Empty>}
            {inStorage
              .slice()
              .sort((a, b) => (a.departureDate < b.departureDate ? -1 : 1))
              .map((b) => (
                <Card key={b.id} b={b} today={today} onPatch={patch} onLabel={setLabelFor} onPrint={(id) => openLabels([id])} compact />
              ))}
          </Group>
        </div>
      )}

      {/* ── UPCOMING ── */}
      {tab === 'upcoming' && (
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {upcoming.length === 0 && <Empty>No upcoming bookings.</Empty>}
          {groupByDate(upcoming).map(([date, list]) => (
            <Group key={date} title={`${fmtDay(date)} · ${list.length}`} accent={C.green} action={{ label: '🖨 Labels', onClick: () => openLabels(list.map((b) => b.id)) }}>
              {list.map((b) => (
                <Card key={b.id} b={b} today={today} onPatch={patch} onLabel={setLabelFor} onPrint={(id) => openLabels([id])} />
              ))}
            </Group>
          ))}
        </div>
      )}

      {/* ── CALENDAR ── */}
      {tab === 'calendar' && (
        <Calendar
          calMonth={calMonth}
          setCalMonth={setCalMonth}
          bookings={active}
          calDay={calDay}
          setCalDay={setCalDay}
          today={today}
          onPatch={patch}
          onLabel={setLabelFor}
          onPrint={(id) => openLabels([id])}
        />
      )}

      {/* ── SEARCH ── */}
      {tab === 'search' && (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={s.filters}>
            <input style={{ ...s.input, flex: 2 }} placeholder="Search name, booking #, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select style={s.select} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="in">In storage</option>
              <option value="overdue">Overdue</option>
              <option value="unpaid">Unpaid</option>
              <option value="done">Picked up</option>
            </select>
            <select style={s.select} value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="">All types</option>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select style={s.select} value={fSource} onChange={(e) => setFSource(e.target.value)}>
              <option value="">All sources</option>
              {sources.map((sname) => (
                <option key={sname} value={sname}>{sname}</option>
              ))}
            </select>
          </div>
          <div style={{ color: C.sub, fontSize: 13, margin: '4px 2px 10px' }}>{searchResults.length} result{searchResults.length === 1 ? '' : 's'}</div>
          {searchResults.map((b) => (
            <Card key={b.id} b={b} today={today} onPatch={patch} onLabel={setLabelFor} onPrint={(id) => openLabels([id])} />
          ))}
        </div>
      )}

      {showNew && <NewBookingModal adminKey={adminKey} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); fetchBookings() }} />}
      {labelFor && <LabelModal b={labelFor} onClose={() => setLabelFor(null)} onPatch={patch} onPrint={(id) => openLabels([id])} />}
    </div>
  )
}

/* ── KPI ── */
function Kpi({ label, value, sub, color, onClick, alert }: any) {
  return (
    <div style={{ ...s.kpi, cursor: onClick ? 'pointer' : 'default', borderColor: alert ? color : C.line }} onClick={onClick}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: C.sub }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

/* ── Group wrapper ── */
function Group({ title, accent, sub, action, children }: any) {
  return (
    <div style={s.group}>
      <div style={s.groupHead}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: accent, display: 'inline-block' }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{title}</span>
          {sub && <span style={{ fontSize: 12, color: C.sub }}>· {sub}</span>}
        </div>
        {action && (
          <button style={s.btnTiny} onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </div>
  )
}
const Empty = ({ children }: any) => <div style={{ color: C.sub, fontSize: 13, padding: '8px 2px' }}>{children}</div>

/* ── Booking card ── */
function Card({ b, today, onPatch, onLabel, onPrint, compact }: any) {
  const isOverdue = b.departureDate && b.departureDate < today && !b.pickedUp
  return (
    <div style={{ ...s.card, borderColor: isOverdue ? C.red : C.line }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: C.ink }}>{b.name || '—'}</span>
            <span style={s.code}>#{b.bookingNumber}</span>
            <span style={{ ...s.badge, background: sourceColor(b.reference) }}>{b.reference || 'n/a'}</span>
            {b.fromBikeRent && <span style={{ ...s.badge, background: '#0891b2' }}>bike</span>}
          </div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>
            {b.type} · {b.totalQty || b.luggage + b.backpacks} item{(b.totalQty || b.luggage + b.backpacks) === 1 ? '' : 's'}
            {b.late ? ' · late pickup' : ''}
            {b.delivery ? ' · 🏨 hotel delivery' : ''}
          </div>
          <div style={{ fontSize: 13, color: C.ink, marginTop: 3 }}>
            <b>In:</b> {fmtDay(b.arrivalDate)} {b.arrivalTime} &nbsp;→&nbsp; <b style={{ color: isOverdue ? C.red : C.ink }}>Out:</b> {fmtDay(b.departureDate)} {b.departureTime}
            {isOverdue && <span style={{ color: C.red, fontWeight: 700 }}> · OVERDUE</span>}
          </div>
          {!compact && (
            <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>
              {b.phone && <a href={`tel:${b.phone}`} style={{ color: C.green2 }}>{b.phone}</a>}
              {b.email && <> · {b.email}</>}
              {b.lockerNumber && <> · 🔒 {b.lockerNumber}</>}
              {b.hotelName && <> · {b.hotelName}</>}
            </div>
          )}
          {b.comment && !compact && <div style={{ fontSize: 12, color: C.sub, marginTop: 4, fontStyle: 'italic' }}>“{b.comment}”</div>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, color: C.ink }}>{(b.totalAmount || 0).toLocaleString()} kr</div>
          <span style={{ ...s.payBadge, background: b.paid || b.paymentStatus === 'Paid' ? '#dcfce7' : '#fef3c7', color: b.paid || b.paymentStatus === 'Paid' ? '#166534' : '#92400e' }}>
            {b.paid || b.paymentStatus === 'Paid' ? 'Paid' : b.paymentStatus || 'Pending'}
          </span>
        </div>
      </div>
      <div style={s.cardActions}>
        <Toggle on={b.droppedOff} on1="✓ Dropped off" off="Mark dropped off" color={C.green} onClick={() => onPatch(b.id, { droppedOff: !b.droppedOff })} />
        <Toggle on={b.pickedUp} on1="✓ Picked up" off="Mark picked up" color={C.blue} onClick={() => onPatch(b.id, { pickedUp: !b.pickedUp })} />
        {!(b.paid || b.paymentStatus === 'Paid') && (
          <button style={s.actBtn} onClick={() => onPatch(b.id, { paid: true, paymentStatus: 'Paid' })}>Mark paid</button>
        )}
        <button style={s.actBtn} onClick={() => onLabel(b)}>🏷 Label</button>
        <button style={s.actBtn} onClick={() => onPrint(b.id)}>🖨 Print</button>
        <a style={{ ...s.actBtn, textDecoration: 'none' }} href={b.storagePageLink || `https://www.bagbee.is/storage/${b.id}`} target="_blank" rel="noreferrer">Manage ↗</a>
      </div>
    </div>
  )
}
const Toggle = ({ on, on1, off, color, onClick }: any) => (
  <button style={{ ...s.actBtn, background: on ? color : '#fff', color: on ? '#fff' : C.ink, borderColor: on ? color : C.line }} onClick={onClick}>
    {on ? on1 : off}
  </button>
)

/* ── Calendar ── */
function Calendar({ calMonth, setCalMonth, bookings, calDay, setCalDay, today, onPatch, onLabel, onPrint }: any) {
  const { y, m } = calMonth
  const first = new Date(y, m, 1)
  const startDow = (first.getDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const byDay: Record<string, { in: number; out: number }> = {}
  bookings.forEach((b: any) => {
    if (b.arrivalDate) (byDay[b.arrivalDate] = byDay[b.arrivalDate] || { in: 0, out: 0 }).in++
    if (b.departureDate) (byDay[b.departureDate] = byDay[b.departureDate] || { in: 0, out: 0 }).out++
  })
  const cells: (string | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  const prev = () => setCalMonth(m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })
  const next = () => setCalMonth(m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })
  const dayList = calDay ? bookings.filter((b: any) => b.arrivalDate === calDay || b.departureDate === calDay) : []

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button style={s.btnGhost} onClick={prev}>← Prev</button>
        <div style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>{MONTHS[m]} {y}</div>
        <button style={s.btnGhost} onClick={next}>Next →</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: C.sub, fontWeight: 600 }}>{d}</div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />
          const c = byDay[iso]
          const isToday = iso === today
          const sel = iso === calDay
          return (
            <button
              key={iso}
              onClick={() => setCalDay(sel ? null : iso)}
              style={{
                ...s.calCell,
                borderColor: sel ? C.green : isToday ? C.yellow : C.line,
                background: sel ? '#eef6f2' : '#fff',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? C.orange : C.ink }}>{Number(iso.slice(-2))}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                {c?.in ? <span style={{ ...s.calPill, background: '#dcfce7', color: '#166534' }}>↓{c.in}</span> : null}
                {c?.out ? <span style={{ ...s.calPill, background: '#dbeafe', color: '#1e40af' }}>↑{c.out}</span> : null}
              </div>
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>↓ drop-offs · ↑ pick-ups · click a day for details</div>
      {calDay && (
        <Group title={`${fmtDay(calDay)} · ${dayList.length} booking${dayList.length === 1 ? '' : 's'}`} accent={C.green} action={dayList.length ? { label: '🖨 Labels', onClick: () => onPrint && dayList.forEach && window.open(`/admin/storage-label?ids=${dayList.map((b: any) => b.id).join(',')}`, '_blank') } : undefined}>
          {dayList.map((b: any) => (
            <Card key={b.id} b={b} today={today} onPatch={onPatch} onLabel={onLabel} onPrint={onPrint} />
          ))}
        </Group>
      )}
    </div>
  )
}

/* ── Label / locker modal ── */
function LabelModal({ b, onClose, onPatch, onPrint }: any) {
  const [locker, setLocker] = useState(b.lockerNumber || '')
  const [sticker, setSticker] = useState(!!b.colorSticker)
  const save = () => {
    onPatch(b.id, { lockerNumber: locker, colorSticker: sticker })
    onClose()
  }
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Label · {b.name} <span style={s.code}>#{b.bookingNumber}</span></div>
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>{b.totalQty || b.luggage + b.backpacks} item(s) · {b.type}</div>
      <label style={s.lab}>Locker / shelf number</label>
      <input style={s.input} value={locker} onChange={(e) => setLocker(e.target.value)} placeholder="e.g. A12" />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0', fontSize: 14 }}>
        <input type="checkbox" checked={sticker} onChange={(e) => setSticker(e.target.checked)} /> Colour sticker applied
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...s.btnPrimary, flex: 1 }} onClick={save}>Save</button>
        <button style={{ ...s.btnGhost, flex: 1 }} onClick={() => onPrint(b.id)}>🖨 Print labels</button>
      </div>
    </Overlay>
  )
}

/* ── New booking modal ── */
function NewBookingModal({ adminKey, onClose, onCreated }: any) {
  const [f, setF] = useState<any>({
    name: '', email: '', phone: '', luggage: 1, backpacks: 0,
    arrivalDate: TODAY(), arrivalTime: '', departureDate: TODAY(), departureTime: '',
    late: false, delivery: false, deliveryAddress: '', hotelName: '',
    greidsla: 'Cash', paid: true, comment: '', reference: 'Counter', sendConfirmation: false,
  })
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }))
  const submit = async () => {
    if (!f.name.trim()) return toast.error('Name required')
    if (f.luggage + f.backpacks <= 0) return toast.error('At least one item')
    setBusy(true)
    try {
      const r = await fetch('/api/storage-ops/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify(f),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.message || 'Create failed')
      toast.success(`Booking #${j.bookingNumber} created · ${j.total.toLocaleString()} kr`)
      onCreated()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Overlay onClose={onClose} wide>
      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 12 }}>New booking</div>
      <div style={s.formGrid}>
        <Fld label="Full name *"><input style={s.input} value={f.name} onChange={(e) => set('name', e.target.value)} /></Fld>
        <Fld label="Phone"><input style={s.input} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Fld>
        <Fld label="Email"><input style={s.input} value={f.email} onChange={(e) => set('email', e.target.value)} /></Fld>
        <Fld label="Source"><input style={s.input} value={f.reference} onChange={(e) => set('reference', e.target.value)} /></Fld>
        <Fld label="Items (bags)"><input type="number" min={0} style={s.input} value={f.luggage} onChange={(e) => set('luggage', Number(e.target.value))} /></Fld>
        <Fld label="Backpacks"><input type="number" min={0} style={s.input} value={f.backpacks} onChange={(e) => set('backpacks', Number(e.target.value))} /></Fld>
        <Fld label="Drop-off date *"><input type="date" style={s.input} value={f.arrivalDate} onChange={(e) => set('arrivalDate', e.target.value)} /></Fld>
        <Fld label="Drop-off time"><input style={s.input} placeholder="10:00" value={f.arrivalTime} onChange={(e) => set('arrivalTime', e.target.value)} /></Fld>
        <Fld label="Pick-up date *"><input type="date" style={s.input} value={f.departureDate} onChange={(e) => set('departureDate', e.target.value)} /></Fld>
        <Fld label="Pick-up time"><input style={s.input} placeholder="15:00" value={f.departureTime} onChange={(e) => set('departureTime', e.target.value)} /></Fld>
        <Fld label="Payment method"><select style={s.input} value={f.greidsla} onChange={(e) => set('greidsla', e.target.value)}>{GREIDSLA.map((g) => <option key={g}>{g}</option>)}</select></Fld>
        <Fld label="Total (kr, blank = auto)"><input type="number" style={s.input} value={f.totalAmount ?? ''} onChange={(e) => set('totalAmount', e.target.value === '' ? undefined : Number(e.target.value))} /></Fld>
      </div>
      <div style={{ display: 'flex', gap: 18, margin: '12px 2px', flexWrap: 'wrap' }}>
        <label style={s.chk}><input type="checkbox" checked={f.late} onChange={(e) => set('late', e.target.checked)} /> Late check-out</label>
        <label style={s.chk}><input type="checkbox" checked={f.delivery} onChange={(e) => set('delivery', e.target.checked)} /> Hotel delivery</label>
        <label style={s.chk}><input type="checkbox" checked={f.paid} onChange={(e) => set('paid', e.target.checked)} /> Paid</label>
        <label style={s.chk}><input type="checkbox" checked={f.sendConfirmation} onChange={(e) => set('sendConfirmation', e.target.checked)} /> Email confirmation</label>
      </div>
      {f.delivery && (
        <div style={s.formGrid}>
          <Fld label="Hotel name"><input style={s.input} value={f.hotelName} onChange={(e) => set('hotelName', e.target.value)} /></Fld>
          <Fld label="Hotel address"><input style={s.input} value={f.deliveryAddress} onChange={(e) => set('deliveryAddress', e.target.value)} /></Fld>
        </div>
      )}
      <Fld label="Comment"><textarea style={{ ...s.input, minHeight: 54 }} value={f.comment} onChange={(e) => set('comment', e.target.value)} /></Fld>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button style={{ ...s.btnPrimary, flex: 1 }} disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create booking'}</button>
        <button style={{ ...s.btnGhost, flex: 1 }} onClick={onClose}>Cancel</button>
      </div>
    </Overlay>
  )
}
const Fld = ({ label, children }: any) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={s.lab}>{label}</span>
    {children}
  </label>
)
function Overlay({ children, onClose, wide }: any) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: wide ? 640 : 420 }} onClick={(e) => e.stopPropagation()}>
        <button style={s.close} onClick={onClose}>×</button>
        {children}
      </div>
    </div>
  )
}

/* ── utils ── */
function groupByDate(list: any[]): [string, any[]][] {
  const m: Record<string, any[]> = {}
  list.forEach((b) => {
    ;(m[b.arrivalDate] = m[b.arrivalDate] || []).push(b)
  })
  return Object.entries(m).sort(([a], [b]) => (a < b ? -1 : 1))
}

/* ── styles ── */
const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: C.bg, fontFamily: 'Poppins, system-ui, sans-serif', padding: '14px 16px 60px', color: C.ink },
  gate: { minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Poppins, system-ui, sans-serif' },
  gateCard: { background: '#fff', borderRadius: 16, padding: 28, width: 340, boxShadow: '0 10px 40px rgba(0,0,0,0.12)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1100, margin: '0 auto 12px' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, maxWidth: 1100, margin: '0 auto 14px' },
  kpi: { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 14px' },
  tabs: { display: 'flex', gap: 6, maxWidth: 1100, margin: '0 auto 14px', flexWrap: 'wrap' },
  tab: { padding: '8px 16px', borderRadius: 999, border: `1px solid ${C.line}`, background: '#fff', color: C.sub, fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  tabActive: { padding: '8px 16px', borderRadius: 999, border: `1px solid ${C.green}`, background: C.green, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  cols: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12, maxWidth: 1100, margin: '0 auto', alignItems: 'start' },
  group: { background: 'transparent' },
  groupHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 14px' },
  cardActions: { display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  code: { fontFamily: 'monospace', fontSize: 12, background: '#f1f5f9', padding: '1px 6px', borderRadius: 5, color: C.sub },
  badge: { fontSize: 10, fontWeight: 700, color: '#fff', padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: 0.3 },
  payBadge: { display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 },
  actBtn: { fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff', color: C.ink, cursor: 'pointer' },
  btnTiny: { fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 8, border: 'none', background: C.green, color: '#fff', cursor: 'pointer' },
  btnPrimary: { fontSize: 14, fontWeight: 700, padding: '9px 16px', borderRadius: 10, border: 'none', background: C.green, color: '#fff', cursor: 'pointer' },
  btnGhost: { fontSize: 14, fontWeight: 600, padding: '9px 14px', borderRadius: 10, border: `1px solid ${C.line}`, background: '#fff', color: C.ink, cursor: 'pointer' },
  input: { height: 42, border: `1px solid #c8cdd6`, borderRadius: 8, padding: '0 12px', fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  select: { height: 42, border: `1px solid #c8cdd6`, borderRadius: 8, padding: '0 10px', fontSize: 14, background: '#fff', cursor: 'pointer' },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
  attention: { background: C.redBg, color: C.red, fontSize: 12, fontWeight: 600, padding: '8px 10px', borderRadius: 8, marginBottom: 4 },
  errBar: { maxWidth: 1100, margin: '0 auto 12px', background: C.redBg, color: C.red, padding: '10px 14px', borderRadius: 8, fontSize: 14 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 1000, overflowY: 'auto' },
  modal: { background: '#fff', borderRadius: 16, padding: 22, width: '100%', position: 'relative' },
  close: { position: 'absolute', top: 12, right: 14, border: 'none', background: 'transparent', fontSize: 24, color: C.sub, cursor: 'pointer', lineHeight: 1 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  lab: { fontSize: 12, color: C.sub, fontWeight: 600 },
  chk: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 },
  calCell: { minHeight: 62, border: `1px solid ${C.line}`, borderRadius: 8, padding: 6, textAlign: 'left', cursor: 'pointer' },
  calPill: { fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4 },
}

export async function getServerSideProps() {
  return { props: {} }
}
