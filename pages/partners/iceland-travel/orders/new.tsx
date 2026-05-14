import styled from '@emotion/styled'
import { GetServerSideProps } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import PartnerLayout from '../../../../components/partners/PartnerLayout'
import { PARTNERS, verifyPartner } from '../../../../utils/partnerAuth'
import { OrderSummary } from '../../../../utils/partnerOrders'

type Props = { partnerDisplayName: string }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const partner = verifyPartner(ctx.req)
  if (partner !== 'iceland-travel') {
    return {
      redirect: { destination: '/partners/iceland-travel/login', permanent: false },
    }
  }
  return { props: { partnerDisplayName: PARTNERS[partner].displayName } }
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

const inputStyles = `
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #d9dde2;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  outline: none;
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

const TIME_WINDOWS = [
  '08:00 - 09:00',
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '09:00 - 12:00',
  '17:00 - 18:00',
  '18:00 - 19:00',
  '19:00 - 20:00',
  '20:00 - 21:00',
  '21:00 - 22:00',
  '19:00 - 22:00',
]

const todayYmd = () => new Date().toISOString().slice(0, 10)

type Form = {
  customerName: string
  contactName: string
  reference: string
  email: string
  phone: string
  serviceType: string
  flightDate: string
  pickupDate: string
  timeWindow: string
  pickupAddress: string
  hotelName: string
  deliveryAddress: string
  airline: string
  flightNumber: string
  destinationCode: string
  bagsRegular: string
  bagsOdd: string
  estimatedAmount: string
  comment: string
}

const initial: Form = {
  customerName: '',
  contactName: '',
  reference: '',
  email: 'karolina.k@icelandtravel.is',
  phone: '',
  serviceType: 'Pickup & Delivery',
  flightDate: '',
  pickupDate: '',
  timeWindow: '',
  pickupAddress: '',
  hotelName: '',
  deliveryAddress: '',
  airline: '',
  flightNumber: '',
  destinationCode: '',
  bagsRegular: '',
  bagsOdd: '0',
  estimatedAmount: '',
  comment: '',
}

export default function NewPartnerOrder({ partnerDisplayName }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<Form>(initial)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const setField = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  // Pickup date defaults to one day before flight date when flight is set
  // and pickup is still blank.
  const onFlightDateChange = (v: string) => {
    setForm((f) => {
      const next = { ...f, flightDate: v }
      if (!f.pickupDate && v) {
        const d = new Date(`${v}T00:00:00Z`)
        d.setUTCDate(d.getUTCDate() - 1)
        next.pickupDate = d.toISOString().slice(0, 10)
      }
      return next
    })
  }

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
        flightDate: form.flightDate,
        pickupDate: form.pickupDate,
        timeWindow: form.timeWindow.trim(),
        pickupAddress: form.pickupAddress.trim(),
        hotelName: form.hotelName.trim() || undefined,
        deliveryAddress: form.deliveryAddress.trim() || undefined,
        airline: form.airline.trim() || undefined,
        flightNumber: form.flightNumber.trim() || undefined,
        destinationCode: form.destinationCode.trim() || undefined,
        bagsRegular: Number(form.bagsRegular) || 0,
        bagsOdd: Number(form.bagsOdd) || 0,
        estimatedAmount:
          form.estimatedAmount.trim() === '' ? undefined : Number(form.estimatedAmount),
        comment: form.comment.trim() || undefined,
        language: 'is' as const,
      }
      const res = await fetch('/api/partners/iceland-travel/orders', {
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
        msg: `Order #${
          body.order.orderNoInt || body.order.orderNoShort
        } created — BagBee notified.`,
      })
      setTimeout(() => {
        router.push(`/partners/iceland-travel/orders/${body.order.id}`)
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
    <PartnerLayout partnerDisplayName={partnerDisplayName}>
      <Crumb>
        <Link href="/partners/iceland-travel/dashboard">← Back to dashboard</Link>
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
                <Select
                  required
                  value={form.timeWindow}
                  onChange={(e) => setField('timeWindow', e.target.value)}
                >
                  <option value="">Choose…</option>
                  {TIME_WINDOWS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>

            <Field>
              <div>
                <Label>Flight date *</Label>
                <Input
                  required
                  type="date"
                  min={todayYmd()}
                  value={form.flightDate}
                  onChange={(e) => onFlightDateChange(e.target.value)}
                />
              </div>
              <div>
                <Label>Pickup date *</Label>
                <Input
                  required
                  type="date"
                  min={todayYmd()}
                  value={form.pickupDate}
                  onChange={(e) => setField('pickupDate', e.target.value)}
                />
              </div>
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
                <Label>Airline</Label>
                <Input
                  placeholder="Icelandair"
                  value={form.airline}
                  onChange={(e) => setField('airline', e.target.value)}
                />
              </div>
              <div>
                <Label>Flight number</Label>
                <Input
                  placeholder="FI615"
                  value={form.flightNumber}
                  onChange={(e) => setField('flightNumber', e.target.value)}
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

            <Field>
              <div>
                <Label>Destination IATA</Label>
                <Input
                  placeholder="LHR / JFK …"
                  value={form.destinationCode}
                  onChange={(e) => setField('destinationCode', e.target.value)}
                />
              </div>
              <div>
                <Label>Estimated amount (ISK)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="(optional — ops will confirm)"
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
