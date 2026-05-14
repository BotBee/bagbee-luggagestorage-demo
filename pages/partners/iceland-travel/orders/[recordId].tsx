import styled from '@emotion/styled'
import { GetServerSideProps } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import PartnerLayout from '../../../../components/partners/PartnerLayout'
import OrderTrackingMap from '../../../../components/partners/OrderTrackingMap'
import DriverMessageBar from '../../../../components/partners/DriverMessageBar'
import { PARTNERS, verifyPartner } from '../../../../utils/partnerAuth'
import {
  EditableField,
  getPartnerOrder,
  OrderSummary,
} from '../../../../utils/partnerOrders'

type Props = {
  partnerDisplayName: string
  order: OrderSummary
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const partner = verifyPartner(ctx.req)
  if (partner !== 'iceland-travel') {
    return {
      redirect: { destination: '/partners/iceland-travel/login', permanent: false },
    }
  }
  const recordId = ctx.params?.recordId
  if (typeof recordId !== 'string') return { notFound: true }
  const order = await getPartnerOrder(partner, recordId)
  if (!order) return { notFound: true }
  return {
    props: {
      partnerDisplayName: PARTNERS[partner].displayName,
      order,
    },
  }
}

const Crumb = styled.div`
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  color: #696f79;
  margin-bottom: 18px;
  a {
    color: #3d7165;
    text-decoration: none;
    font-weight: 500;
    &:hover { text-decoration: underline; }
  }
`

const Head = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 22px;
`

const Title = styled.h1`
  font-family: 'Poppins', sans-serif;
  font-size: 28px;
  font-weight: 700;
  color: #000929;
  margin: 0 0 4px;
  letter-spacing: -0.5px;
`

const Sub = styled.div`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #696f79;
`

const Badge = styled.span<{ bg: string }>`
  display: inline-block;
  padding: 6px 14px;
  border-radius: 999px;
  background: ${({ bg }) => bg};
  color: white;
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 600;
`

const Layout = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`

const Card = styled.section`
  background: white;
  border-radius: 18px;
  border: 1px solid #ecedf0;
  padding: 22px;
`

const CardTitle = styled.h2`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: #000929;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  margin: 0 0 14px;
`

const Field = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
  /* Narrow viewports (phones) — stack the two fields so neither input is
     squished. Matches the layout grid's 900px breakpoint above. */
  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`

const Label = styled.label`
  display: block;
  font-family: 'Poppins', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: #696f79;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 6px;
`

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #d9dde2;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  outline: none;
  &:focus { border-color: #3d7165; }
`

const Textarea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #d9dde2;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  min-height: 140px;
  outline: none;
  resize: vertical;
  &:focus { border-color: #3d7165; }
`

const Select = styled.select`
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #d9dde2;
  background: white;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  outline: none;
  &:focus { border-color: #3d7165; }
`

const KV = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 9px 0;
  border-bottom: 1px solid #f1f2f4;
  &:last-child { border-bottom: none; }
`

const KVLabel = styled.span`
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  color: #696f79;
`

const KVValue = styled.span`
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #000929;
  text-align: right;
`

const ButtonBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
`

const SaveButton = styled.button`
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 600;
  padding: 11px 22px;
  background: #3d7165;
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  &:hover:enabled { background: #345f55; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`

const ResetButton = styled.button`
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 500;
  padding: 11px 22px;
  background: white;
  color: #000929;
  border: 1px solid #d9dde2;
  border-radius: 10px;
  cursor: pointer;
  &:hover:enabled { background: #f5f6fa; }
`

const Toast = styled.div<{ kind: 'ok' | 'err' }>`
  margin-top: 14px;
  padding: 11px 14px;
  border-radius: 10px;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  background: ${({ kind }) => (kind === 'ok' ? '#e7f6ec' : '#fdecea')};
  color: ${({ kind }) => (kind === 'ok' ? '#176c2c' : '#b3261e')};
`

// The three service types Iceland Travel actually uses through this portal.
// Legacy values stamped on historical orders (Arrival service, Pickup, etc.)
// will still render as the current value but can't be selected from the list.
const SERVICE_OPTIONS = [
  'Pickup & Delivery',
  'Check-in service',
  'BSI to Hotel Delivery',
]

const MONTHS_SHORT = [
  'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec',
]

const fmtDate = (s: string | null) => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${dd} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

type FormState = Record<EditableField, string>

const orderToForm = (o: OrderSummary): FormState => ({
  reference: o.reference || '',
  email: o.email || '',
  phone: o.phone || '',
  serviceType: o.serviceType || '',
  flightDate: o.flightDate || '',
  pickupDate: o.pickupDate || '',
  timeWindow: o.timeWindow || '',
  pickupAddress: o.pickupAddress || '',
  // Coord overrides aren't rendered as inputs — they're only edited by
  // dragging the map pin. But FormState needs all EditableField keys so
  // the diff helper sees them as no-op when not changed.
  pickupLatOverride: o.pickupLatOverride != null ? String(o.pickupLatOverride) : '',
  pickupLngOverride: o.pickupLngOverride != null ? String(o.pickupLngOverride) : '',
  deliveryAddress: o.deliveryAddress || '',
  deliveryDate: o.deliveryDate || '',
  deliveryTimeWindow: o.deliveryTimeWindow || '',
  flightNumber: o.flightNumber || '',
  airline: o.airline || '',
  comment: o.comment || '',
  // contactName is part of the EditableField union (so PATCH accepts it)
  // but it's not rendered as a form input — the standalone `actor` input
  // handles edits and is merged into the PATCH payload on save. Including
  // it here keeps FormState's keys aligned with EditableField and never
  // shows up in `diff` results (baseline === form for this field).
  contactName: o.contactName || '',
  bagsRegular: String(o.bagsRegular),
  bagsOdd: String(o.bagsOdd),
})

// Local-to-local services don't involve an airline; flight fields are hidden.
const isLocalTransfer = (serviceType: string | null): boolean =>
  serviceType === 'Pickup & Delivery' ||
  serviceType === 'Delivery from storage' ||
  serviceType === 'BSI to Hotel Delivery'

// Status values where the partner needs the big live-tracking map up top.
// Pre-planning (Pending/Confirmed) and terminal states (Delivered/Cancelled)
// get a small sidebar map instead.
const isLiveTrackingStage = (status: string | null): boolean =>
  status === 'Planned' || status === 'In Progress'

const diff = (
  before: FormState,
  after: FormState
): Partial<Record<EditableField, string | number>> => {
  const out: Partial<Record<EditableField, string | number>> = {}
  ;(Object.keys(after) as EditableField[]).forEach((key) => {
    // Compare trimmed strings so cosmetic whitespace drift (Airtable
    // sometimes stores "Parliament " with a trailing space; the input
    // renders / round-trips as "Parliament") doesn't show up as a save.
    // The Save N button was counting these as real changes and the
    // server changelog was logging "Parliament → Parliament" entries.
    const a = String(after[key] ?? '').trim()
    const b = String(before[key] ?? '').trim()
    if (a === b) return
    if (key === 'bagsRegular' || key === 'bagsOdd') {
      const n = Number(after[key])
      if (Number.isFinite(n) && n >= 0) out[key] = Math.floor(n)
    } else {
      // Persist the trimmed value so Airtable stops accumulating stray
      // whitespace each time the order is saved.
      out[key] = a
    }
  })
  return out
}

export default function PartnerOrderPage({ partnerDisplayName, order }: Props) {
  const [original, setOriginal] = useState(order)
  const [form, setForm] = useState<FormState>(() => orderToForm(order))
  const [actor, setActor] = useState(order.contactName || '')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  useEffect(() => {
    setOriginal(order)
    setForm(orderToForm(order))
    setActor(order.contactName || '')
  }, [order])

  const baseline = orderToForm(original)
  const changes = diff(baseline, form)
  const hasChanges = Object.keys(changes).length > 0

  // Track whether the contact-name input has been edited since this order
  // was loaded. If yes, we PATCH the dedicated `contactName` column too so
  // the staffer's name persists across orders rather than only living in
  // the comment changelog.
  const contactChanged = actor.trim() !== (original.contactName || '').trim()
  const hasAnyEdit = hasChanges || contactChanged

  const onSave = async () => {
    if (!hasAnyEdit || saving) return
    setSaving(true)
    setToast(null)
    try {
      const res = await fetch(
        `/api/partners/iceland-travel/orders/${order.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            changes: contactChanged
              ? { ...changes, contactName: actor.trim() || null }
              : changes,
            actor: actor.trim() || undefined,
          }),
        }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || 'Save failed')
      }
      const body = (await res.json()) as { order: OrderSummary }
      setOriginal(body.order)
      setForm(orderToForm(body.order))
      setToast({
        kind: 'ok',
        msg: 'Changes saved — BagBee has been notified.',
      })
    } catch (err) {
      setToast({
        kind: 'err',
        msg: err instanceof Error ? err.message : 'Save failed',
      })
    } finally {
      setSaving(false)
    }
  }

  const onReset = () => setForm(baseline)

  const totalBags = (Number(form.bagsRegular) || 0) + (Number(form.bagsOdd) || 0)

  return (
    <PartnerLayout partnerDisplayName={partnerDisplayName}>
      <Crumb>
        <Link href="/partners/iceland-travel/dashboard">← All orders</Link>
      </Crumb>
      <Head>
        <div>
          <Title>
            {original.reference
              ? `Ref ${original.reference}`
              : original.orderNoShort}
          </Title>
          <Sub>
            {original.orderNoShort} · {original.serviceType || 'Service unknown'}
          </Sub>
        </div>
        {original.status && (
          <Badge bg={original.statusColor || '#6b7280'}>{original.status}</Badge>
        )}
      </Head>

      {/*
        Map sizing rule: once dispatch marks an order as Planned or In
        Progress, the project-manager needs the live driver position front
        and centre — render the map full-width above the form. Before that
        (Pending / Confirmed) and after (Delivered / Cancelled) the map is
        a secondary reference; it lives compactly in the sidebar.
      */}
      {isLiveTrackingStage(original.status) && (
        <div style={{ marginBottom: 20 }}>
          <OrderTrackingMap orderId={original.id} />
        </div>
      )}

      <Layout>
        <Card>
          <CardTitle>Edit booking</CardTitle>

          <Field>
            <div>
              <Label>Your reference number</Label>
              <Input
                placeholder="e.g. JKT-37012"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Input
                value={original.status || '—'}
                readOnly
                style={{ background: '#f7f8fa', color: '#696f79' }}
              />
            </div>
          </Field>

          <Field>
            <div>
              <Label>Service</Label>
              <Select
                value={form.serviceType}
                onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
              >
                <option value="">—</option>
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                {/* If the order has a legacy service type that's no longer in
                    SERVICE_OPTIONS, keep it visible so the partner can see it
                    without us silently switching it to "—". */}
                {form.serviceType &&
                  !SERVICE_OPTIONS.includes(form.serviceType) && (
                    <option value={form.serviceType}>
                      {form.serviceType} (legacy)
                    </option>
                  )}
              </Select>
            </div>
            <div>
              <Label>Pickup date</Label>
              <Input
                type="date"
                value={form.pickupDate}
                onChange={(e) => setForm({ ...form, pickupDate: e.target.value })}
              />
            </div>
          </Field>

          <Field>
            <div>
              <Label>Time window</Label>
              <Input
                placeholder="e.g. 09:00 - 11:00"
                value={form.timeWindow}
                onChange={(e) => setForm({ ...form, timeWindow: e.target.value })}
              />
            </div>
            <div>
              <Label>Pickup address / hotel</Label>
              <Input
                value={form.pickupAddress}
                onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })}
              />
            </div>
          </Field>

          {isLocalTransfer(form.serviceType) ? (
            <>
              <Field>
                <div>
                  <Label>Delivery address</Label>
                  <Input
                    value={form.deliveryAddress}
                    placeholder="Where the bags should be dropped off"
                    onChange={(e) =>
                      setForm({ ...form, deliveryAddress: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Delivery time window</Label>
                  <Input
                    placeholder="e.g. 11:00 - 13:00"
                    value={form.deliveryTimeWindow}
                    onChange={(e) =>
                      setForm({ ...form, deliveryTimeWindow: e.target.value })
                    }
                  />
                </div>
              </Field>
              <Field>
                <div>
                  <Label>Delivery date (leave empty for same day)</Label>
                  <Input
                    type="date"
                    value={form.deliveryDate}
                    onChange={(e) =>
                      setForm({ ...form, deliveryDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Bags (regular / odd-size)</Label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input
                      type="number"
                      min={0}
                      value={form.bagsRegular}
                      onChange={(e) =>
                        setForm({ ...form, bagsRegular: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      value={form.bagsOdd}
                      onChange={(e) => setForm({ ...form, bagsOdd: e.target.value })}
                    />
                  </div>
                </div>
              </Field>
            </>
          ) : (
            <>
              <Field>
                <div>
                  <Label>Flight date</Label>
                  <Input
                    type="date"
                    value={form.flightDate}
                    onChange={(e) => setForm({ ...form, flightDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Flight number</Label>
                  <Input
                    placeholder="FI615"
                    value={form.flightNumber}
                    onChange={(e) =>
                      setForm({ ...form, flightNumber: e.target.value })
                    }
                  />
                </div>
              </Field>
              <Field>
                <div>
                  <Label>Airline</Label>
                  <Input
                    value={form.airline}
                    onChange={(e) => setForm({ ...form, airline: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Bags (regular / odd-size)</Label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input
                      type="number"
                      min={0}
                      value={form.bagsRegular}
                      onChange={(e) =>
                        setForm({ ...form, bagsRegular: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      value={form.bagsOdd}
                      onChange={(e) => setForm({ ...form, bagsOdd: e.target.value })}
                    />
                  </div>
                </div>
              </Field>
            </>
          )}

          <Field>
            <div>
              <Label>Contact email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Contact phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </Field>

          <Label>Notes for BagBee ops</Label>
          <Textarea
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
          />

          <div style={{ marginTop: 14 }}>
            <Label>Your name (saved on the order + recorded with each change)</Label>
            <Input
              placeholder="e.g. Karólína K."
              value={actor}
              onChange={(e) => setActor(e.target.value)}
            />
          </div>

          <ButtonBar>
            <ResetButton onClick={onReset} disabled={!hasChanges || saving}>
              Reset
            </ResetButton>
            <SaveButton onClick={onSave} disabled={!hasAnyEdit || saving}>
              {(() => {
                if (saving) return 'Saving…'
                const n = Object.keys(changes).length + (contactChanged ? 1 : 0)
                if (n === 0) return 'No changes'
                return `Save ${n} change${n === 1 ? '' : 's'}`
              })()}
            </SaveButton>
          </ButtonBar>
          {toast && <Toast kind={toast.kind}>{toast.msg}</Toast>}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {!isLiveTrackingStage(original.status) && (
            <OrderTrackingMap orderId={original.id} compact />
          )}
          <Card>
            <CardTitle>Driver</CardTitle>
            {original.driverName ? (
              <>
                <KV>
                  <KVLabel>Assigned to</KVLabel>
                  <KVValue>{original.driverName}</KVValue>
                </KV>
                {original.driverPhone ? (
                  <>
                    <KV>
                      <KVLabel>Phone</KVLabel>
                      <KVValue>
                        <a
                          href={`tel:${original.driverPhone}`}
                          style={{
                            color: '#3d7165',
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                        >
                          {original.driverPhone}
                        </a>
                      </KVValue>
                    </KV>
                    <DriverMessageBar
                      driverPhone={original.driverPhone}
                      driverName={original.driverName}
                    />
                  </>
                ) : (
                  <KV>
                    <KVLabel>Phone</KVLabel>
                    <KVValue style={{ color: '#a3a4a7' }}>not on file</KVValue>
                  </KV>
                )}
                {/* Shift line intentionally hidden — it's an internal BagBee
                    concept that doesn't help the partner project manager. */}
                {original.optimoTrackingLink && (
                  <a
                    href={original.optimoTrackingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      marginTop: 12,
                      padding: '9px 14px',
                      borderRadius: 10,
                      background: '#2d7ff9',
                      color: 'white',
                      textDecoration: 'none',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Open OptimoRoute tracking
                  </a>
                )}
              </>
            ) : (
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: 12,
                  fontFamily: 'Poppins, sans-serif',
                  lineHeight: 1.5,
                }}
              >
                No driver assigned yet.
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>Trip summary</CardTitle>
            <KV>
              <KVLabel>Order #</KVLabel>
              <KVValue>{original.orderNoInt || original.orderNoShort}</KVValue>
            </KV>
            <KV>
              <KVLabel>Total bags</KVLabel>
              <KVValue>{totalBags}</KVValue>
            </KV>
            <KV>
              <KVLabel>Pickup</KVLabel>
              <KVValue>
                {fmtDate(original.pickupDate)} · {original.timeWindow || '—'}
              </KVValue>
            </KV>
            {isLocalTransfer(original.serviceType) ? (
              <KV>
                <KVLabel>Delivery</KVLabel>
                <KVValue>
                  {original.deliveryDate
                    ? fmtDate(original.deliveryDate)
                    : 'Same day'}{' '}
                  · {original.deliveryTimeWindow || '—'}
                </KVValue>
              </KV>
            ) : (
              <>
                <KV>
                  <KVLabel>Flight</KVLabel>
                  <KVValue>
                    {original.airline || '—'} {original.flightNumber || ''}
                  </KVValue>
                </KV>
                <KV>
                  <KVLabel>Flight date</KVLabel>
                  <KVValue>{fmtDate(original.flightDate)}</KVValue>
                </KV>
              </>
            )}
            <KV>
              <KVLabel>Status</KVLabel>
              <KVValue>{original.status || '—'}</KVValue>
            </KV>
          </Card>

        </div>
      </Layout>
    </PartnerLayout>
  )
}
