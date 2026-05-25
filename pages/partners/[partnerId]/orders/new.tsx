import styled from '@emotion/styled'
import { GetServerSideProps } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import PartnerLayout from '../../../../components/partners/PartnerLayout'
import { PARTNERS, PartnerId, isPartnerId, verifySession } from '../../../../utils/partnerAuth'
import { OrderSummary } from '../../../../utils/partnerOrders'
import { hasTentativePricing } from '../../../../utils/partnerPricing'

type Props = { partnerId: PartnerId; partnerDisplayName: string; sessionEmail: string }

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
  const sessionEmail = session.email.startsWith('legacy@') ? '' : session.email
  return {
    props: {
      partnerId,
      partnerDisplayName: PARTNERS[partnerId].displayName,
      sessionEmail,
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

const Title = styled.h1`
  font-family: 'Poppins', sans-serif;
  font-size: 28px;
  font-weight: 700;
  color: #000929;
  margin: 0 0 4px;
  letter-spacing: -0.5px;
`

const Sub = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #696f79;
  margin: 0 0 22px;
`

const Layout = styled.div`
  max-width: 760px;
`

const Card = styled.section`
  background: white;
  border-radius: 10px;
  border: 1px solid #ecedf0;
  padding: 22px;
  @media (max-width: 720px) {
    padding: 16px;
    border-radius: 8px;
  }
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
  /* See order detail page — needed so <input type="date"> on iOS doesn't
     blow past the 1fr column. */
  & > div {
    min-width: 0;
  }
  @media (max-width: 720px) {
    grid-template-columns: 1fr;
    gap: 10px;
    margin-bottom: 10px;
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

// Force a fixed visual height + white background across text + date inputs
// so iOS-Safari date inputs line up cleanly when stacked on phones. See
// the longer comment in pages/.../orders/[recordId].tsx for context.
const inputStyles = `
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  height: 42px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #d9dde2;
  background: white;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  &::-webkit-date-and-time-value {
    text-align: left;
  }
  &::-webkit-calendar-picker-indicator {
    opacity: 0.55;
  }
  &:focus { border-color: #3d7165; }
`

const Input = styled.input`${inputStyles}`
const Select = styled.select`
  ${inputStyles}
  background: white;
`
const Textarea = styled.textarea`
  ${inputStyles}
  min-height: 110px;
  resize: vertical;
`

const Submit = styled.button`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 600;
  padding: 12px 24px;
  background: #3d7165;
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  margin-top: 6px;
  &:hover:enabled { background: #345f55; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
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

const SERVICE_OPTIONS = [
  'Pickup & Delivery',
  'Check-in service',
  'BSI to Hotel Delivery',
]

const todayYmd = () => new Date().toISOString().slice(0, 10)

// -------- Price quote types (mirror utils/partnerPricing.ts) --------
//
// Kept inline rather than re-exported from the server module so this
// page doesn't bundle Airtable / nodemailer on the client.
type LineItem = { label: string; amountIsk: number }
type QuoteResult =
  | {
      kind: 'priced'
      totalIsk: number
      subtotalIsk: number
      pax: number
      pricelistRowId: string
      pricelistRowName: string
      lineItems: LineItem[]
    }
  | { kind: 'out-of-pricelist'; reason: string }

const fmtIsk = (n: number): string =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ISK'

// -------- Quote-card styled components --------

const QuoteCard = styled.div<{ kind: 'priced' | 'manual' }>`
  margin: 6px 0 18px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid
    ${({ kind }) => (kind === 'priced' ? '#3d7165' : '#e0c878')};
  background: ${({ kind }) => (kind === 'priced' ? '#f1f7f5' : '#fff8e6')};
  font-family: 'Poppins', sans-serif;
`

const QuoteHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
`

const QuoteTotal = styled.div`
  font-size: 22px;
  font-weight: 700;
  color: #000929;
  letter-spacing: -0.3px;
`

const QuoteCaption = styled.div`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #696f79;
`

const QuoteLineList = styled.div`
  margin-top: 10px;
  border-top: 1px dashed #d9dde2;
  padding-top: 8px;
  display: grid;
  gap: 4px;
`

const QuoteLine = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #696f79;
`

const QuoteReason = styled.div`
  font-size: 13px;
  color: #6f5a14;
  line-height: 1.5;
`

// Shown when the Date of Service is in a future calendar year — current
// pricelist may not still apply by then. Style intentionally subtle (no
// gradient / no icon / no shouting) so it's informative rather than
// alarming. Sits directly under the quote card.
const FuturePricingNotice = styled.div`
  margin: -10px 0 18px;
  padding: 10px 14px;
  background: #f7f8fa;
  border-left: 3px solid #a3a4a7;
  border-radius: 6px;
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  color: #5b626c;
  line-height: 1.5;
`

type Form = {
  customerName: string
  contactName: string
  reference: string
  email: string
  phone: string
  serviceType: string
  pickupDate: string
  timeWindow: string
  pickupAddress: string
  hotelName: string
  deliveryAddress: string
  flightNumber: string
  bagsRegular: string
  bagsOdd: string
  estimatedAmount: string
  comment: string
}

// Must mirror the localStorage key the dashboard writes to. Kept in sync
// by hand because pages/ files don't share a constants module.
const STAFF_EMAIL_KEY = 'bb_partner_staff_email'

const initial: Form = {
  customerName: '',
  contactName: '',
  reference: '',
  email: '',
  phone: '',
  serviceType: 'Pickup & Delivery',
  pickupDate: '',
  timeWindow: '',
  pickupAddress: '',
  hotelName: '',
  deliveryAddress: '',
  flightNumber: '',
  bagsRegular: '',
  bagsOdd: '0',
  estimatedAmount: '',
  comment: '',
}

export default function NewPartnerOrder({ partnerId, partnerDisplayName, sessionEmail }: Props) {
  const router = useRouter()
  // Seed the contact-email field with the verified session email so the
  // form renders pre-filled on first paint — no localStorage flash.
  const [form, setForm] = useState<Form>(() =>
    sessionEmail ? { ...initial, email: sessionEmail } : initial,
  )
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [quote, setQuote] = useState<QuoteResult | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  // Monotonic counter — each effect run bumps it and stamps its own
  // fetch. When the response resolves we compare against the current
  // counter; if a newer effect has fired since (because the user typed
  // more), we discard the stale response instead of clobbering state.
  // This eliminates "first quote sticks, later changes ignored" races
  // that AbortController alone can miss (e.g. when the response arrived
  // milliseconds before the abort was processed).
  const quoteReqIdRef = useRef(0)

  // Live price preview. Re-runs whenever any input that the price depends
  // on changes — service, bags, or time window. 200ms debounce keeps a
  // typing burst from hammering Airtable while still feeling instant.
  useEffect(() => {
    const totalBags =
      (Number(form.bagsRegular) || 0) + (Number(form.bagsOdd) || 0)
    if (!form.serviceType || totalBags <= 0) {
      setQuote(null)
      setQuoteLoading(false)
      return
    }
    const myReqId = ++quoteReqIdRef.current
    setQuoteLoading(true)
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          serviceType: form.serviceType,
          bagsRegular: String(Number(form.bagsRegular) || 0),
          bagsOdd: String(Number(form.bagsOdd) || 0),
          timeWindow: form.timeWindow,
          // Pickup + delivery addresses drive which pricelist tier
          // applies (BSI to Hotel vs Capital area vs out-of-pricelist).
          pickupAddress: form.pickupAddress,
          deliveryAddress: form.deliveryAddress,
          // Cache-buster so neither the browser nor any intermediate CDN
          // can serve a stale response if the URL params happen to repeat
          // within a session (Vercel caches GETs aggressively by default).
          _: String(Date.now()),
        })
        const res = await fetch(
          `/api/partners/${partnerId}/quote?${params.toString()}`,
          { cache: 'no-store' },
        )
        if (myReqId !== quoteReqIdRef.current) return // stale; newer one in flight
        if (!res.ok) {
          setQuote(null)
          setQuoteLoading(false)
          return
        }
        const data = (await res.json()) as { quote: QuoteResult }
        if (myReqId !== quoteReqIdRef.current) return
        setQuote(data.quote)
        setQuoteLoading(false)
      } catch {
        if (myReqId === quoteReqIdRef.current) setQuoteLoading(false)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [
    form.serviceType,
    form.bagsRegular,
    form.bagsOdd,
    form.timeWindow,
    form.pickupAddress,
    form.deliveryAddress,
  ])

  // Fallback for legacy shared-password sessions only: pick up the email
  // tag from localStorage if no sessionEmail came from SSR.
  useEffect(() => {
    if (sessionEmail) return
    try {
      const saved = window.localStorage.getItem(STAFF_EMAIL_KEY)
      if (saved) {
        setForm((f) => (f.email ? f : { ...f, email: saved }))
      }
    } catch {
      /* localStorage blocked — silently ignore */
    }
  }, [sessionEmail])

  const setField = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setToast(null)
    try {
      const payload = {
        customerName: form.customerName.trim(),
        contactName: form.contactName.trim() || undefined,
        reference: form.reference.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim(),
        serviceType: form.serviceType,
        // Iceland Travel doesn't track flight info on the partner side —
        // ops adds it later when (if) it matters. We default flightDate
        // to pickupDate so back-end validation that still expects a flight
        // date doesn't trip.
        flightDate: form.pickupDate,
        pickupDate: form.pickupDate,
        timeWindow: form.timeWindow.trim(),
        pickupAddress: form.pickupAddress.trim(),
        hotelName: form.hotelName.trim() || undefined,
        deliveryAddress: form.deliveryAddress.trim() || undefined,
        flightNumber: form.flightNumber.trim() || undefined,
        bagsRegular: Number(form.bagsRegular) || 0,
        bagsOdd: Number(form.bagsOdd) || 0,
        // Estimated amount priority:
        //   1. Manual override in the form, if the PM typed one
        //   2. Auto-quote from the pricelist, if it returned a price
        //   3. Otherwise undefined → ops fills it in after manual quote
        estimatedAmount:
          form.estimatedAmount.trim() !== ''
            ? Number(form.estimatedAmount)
            : quote && quote.kind === 'priced'
            ? quote.totalIsk
            : undefined,
        comment: form.comment.trim() || undefined,
        language: 'is' as const,
      }
      const res = await fetch(`/api/partners/${partnerId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || 'Failed to create order')
      }
      const body = (await res.json()) as { order: OrderSummary }
      setToast({
        kind: 'ok',
        msg: `Order #${body.order.orderNoShort} created — BagBee notified.`,
      })
      setTimeout(() => {
        router.push(`/partners/${partnerId}/orders/${body.order.id}`)
      }, 800)
    } catch (err) {
      setToast({
        kind: 'err',
        msg: err instanceof Error ? err.message : 'Failed to create order',
      })
      setSaving(false)
    }
  }

  return (
    <PartnerLayout partnerId={partnerId} partnerDisplayName={partnerDisplayName}>
      <Crumb>
        <Link href={`/partners/${partnerId}/dashboard`}>← Back to dashboard</Link>
      </Crumb>
      <Title>New booking</Title>
      <Sub>
        Invoice-business · BagBee will bill {partnerDisplayName} after the service is
        delivered. No payment required at submission.
      </Sub>

      <Layout>
        <Card>
          <CardTitle>Booking details</CardTitle>
          <form onSubmit={onSubmit}>
            <Field>
              <div>
                <Label>Your reference number *</Label>
                <Input
                  required
                  placeholder="e.g. JKT-37012"
                  value={form.reference}
                  onChange={(e) => setField('reference', e.target.value)}
                />
              </div>
              <div>
                <Label>Group / passenger name</Label>
                <Input
                  placeholder="e.g. Smith group"
                  value={form.customerName}
                  onChange={(e) => setField('customerName', e.target.value)}
                />
              </div>
            </Field>

            <Field>
              <div>
                <Label>Your name (contact)</Label>
                <Input
                  placeholder="Karólína K."
                  value={form.contactName}
                  onChange={(e) => setField('contactName', e.target.value)}
                />
              </div>
              <div></div>
            </Field>

            <Field>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input
                  required
                  placeholder="+354 …"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                />
              </div>
            </Field>

            <Field>
              <div>
                <Label>Service *</Label>
                <Select
                  required
                  value={form.serviceType}
                  onChange={(e) => setField('serviceType', e.target.value)}
                >
                  {SERVICE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Time window *</Label>
                <Input
                  required
                  placeholder="e.g. 11:30 - 12:00"
                  value={form.timeWindow}
                  onChange={(e) => setField('timeWindow', e.target.value)}
                />
              </div>
            </Field>

            <Field>
              <div>
                <Label>Date of service *</Label>
                <Input
                  required
                  type="date"
                  min={todayYmd()}
                  value={form.pickupDate}
                  onChange={(e) => setField('pickupDate', e.target.value)}
                />
              </div>
              <div></div>
            </Field>

            <Field>
              <div>
                <Label>Pickup address / hotel *</Label>
                <Input
                  required
                  placeholder="Hilton Reykjavik Nordica"
                  value={form.pickupAddress}
                  onChange={(e) => setField('pickupAddress', e.target.value)}
                />
              </div>
              <div>
                <Label>Delivery destination</Label>
                <Input
                  placeholder="KEF / hotel / venue"
                  value={form.deliveryAddress}
                  onChange={(e) => setField('deliveryAddress', e.target.value)}
                />
              </div>
            </Field>

            <Field>
              <div>
                <Label>Bags (regular) *</Label>
                <Input
                  type="number"
                  min={0}
                  required
                  value={form.bagsRegular}
                  onChange={(e) => setField('bagsRegular', e.target.value)}
                />
              </div>
              <div>
                <Label>Bags (odd-size)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.bagsOdd}
                  onChange={(e) => setField('bagsOdd', e.target.value)}
                />
              </div>
            </Field>

            {/* Live price preview. Appears once the form has enough info
                to calculate (service + bags). Shows either the priced
                breakdown from the Iceland Travel pricelist, or a friendly
                "we'll send an offer" message when the request is outside
                pricelist scope. Stays visible during recalcs (with an
                "Updating…" indicator) so the user always sees the most
                recent quote rather than a flash of nothing. */}
            {quote && quote.kind === 'priced' && (
              <QuoteCard kind="priced" style={{ opacity: quoteLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                <QuoteHeader>
                  <div>
                    <QuoteCaption>
                      Estimated price {quoteLoading && '· updating…'}
                    </QuoteCaption>
                    <QuoteTotal>{fmtIsk(quote.totalIsk)}</QuoteTotal>
                  </div>
                  <QuoteCaption>
                    {quote.pax} pax · {quote.pricelistRowName.replace(/^IT - /, '')}
                  </QuoteCaption>
                </QuoteHeader>
                <QuoteLineList>
                  {quote.lineItems.map((li, i) => (
                    <QuoteLine key={i}>
                      <span>{li.label}</span>
                      <span>{fmtIsk(li.amountIsk)}</span>
                    </QuoteLine>
                  ))}
                </QuoteLineList>
              </QuoteCard>
            )}
            {quote && quote.kind === 'out-of-pricelist' && (
              <QuoteCard kind="manual" style={{ opacity: quoteLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                <QuoteCaption>
                  We'll quote {quoteLoading && '· updating…'}
                </QuoteCaption>
                <QuoteReason style={{ marginTop: 6 }}>
                  {quote.reason} You can submit the booking anyway — Runar
                  will send a quote by email before confirming.
                </QuoteReason>
              </QuoteCard>
            )}
            {quoteLoading && !quote && (
              <QuoteCard kind="manual">
                <QuoteCaption>Calculating price…</QuoteCaption>
              </QuoteCard>
            )}

            {/* Forward-year disclaimer — appears regardless of whether the
                quote came back priced or "We'll quote", because future-year
                prices are tentative either way. Driven purely off the
                pickupDate value (no server roundtrip needed). */}
            {hasTentativePricing(form.pickupDate) && (
              <FuturePricingNotice>
                Heads up — this booking is for a future calendar year. The
                quoted price is provisional and may be revised before delivery
                if our pricelist is updated in the meantime.
              </FuturePricingNotice>
            )}

            <Field>
              <div>
                <Label>Flight number</Label>
                <Input
                  placeholder="(optional)"
                  value={form.flightNumber}
                  onChange={(e) => setField('flightNumber', e.target.value)}
                />
              </div>
              <div>
                <Label>Override estimated amount (ISK)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder={
                    quote && quote.kind === 'priced'
                      ? `Auto: ${quote.totalIsk}`
                      : '(optional — ops will confirm)'
                  }
                  value={form.estimatedAmount}
                  onChange={(e) => setField('estimatedAmount', e.target.value)}
                />
              </div>
            </Field>

            <Label>Notes</Label>
            <Textarea
              placeholder="Anything BagBee should know — guide name, signage, etc."
              value={form.comment}
              onChange={(e) => setField('comment', e.target.value)}
            />

            <Submit type="submit" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit booking'}
            </Submit>
            {toast && <Toast kind={toast.kind}>{toast.msg}</Toast>}
          </form>
        </Card>

      </Layout>
    </PartnerLayout>
  )
}
