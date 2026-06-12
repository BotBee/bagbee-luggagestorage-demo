/**
 * Staff dashboard — create a new BSI Storage booking by hand (walk-in / counter
 * / phone booking). No Rapyd checkout: staff record how it was paid via the
 * Greiðsla (payment method) field. Type of storage + total are derived from the
 * inputs (total can be overridden). By default NO confirmation email is sent
 * (Confirmation Email Sent pre-set true so neither the poller nor Make fire);
 * pass sendConfirmation:true to email the customer the normal confirmation.
 * Always sets Reconcile alert sent so counter bookings never trip the unconfirmed
 * -payment alert.
 *
 * Guarded by the shared DISPATCH_ADMIN_KEY.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import type { FieldSet } from 'airtable'
import { requireAdmin } from '../../../utils/dispatch/auth'
import { getStorageTable, GREIDSLA_OPTIONS, PAYMENT_STATUS_OPTIONS } from '../../../utils/storageOps'
import { calcStoragePrice, deriveStorageType } from '../../../utils/storagePricing'
import { notifyConfirmationEmail } from '../../../utils/notifyConfirmation'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })
  if (!requireAdmin(req, res)) return

  const b = req.body as Record<string, any>
  const name = String(b.name || '').trim()
  const arrivalDate = String(b.arrivalDate || '').slice(0, 10)
  const departureDate = String(b.departureDate || '').slice(0, 10)
  const luggage = Number(b.luggage) || 0
  const backpacks = Number(b.backpacks) || 0

  if (!name) return res.status(400).json({ message: 'Name is required' })
  if (!arrivalDate || !departureDate) return res.status(400).json({ message: 'Drop-off and pick-up dates are required' })
  if (luggage + backpacks <= 0) return res.status(400).json({ message: 'At least one item is required' })

  const late = b.late === true
  const delivery = b.delivery === true
  const inputs = { arrivalDate, departureDate, luggage, backpacks, late, delivery }
  const storageType = deriveStorageType(inputs)
  const computed = calcStoragePrice(inputs).total
  const total = Number.isFinite(Number(b.totalAmount)) && Number(b.totalAmount) >= 0 ? Number(b.totalAmount) : computed

  const greidsla = GREIDSLA_OPTIONS.includes(b.greidsla) ? b.greidsla : undefined
  const paymentStatus = PAYMENT_STATUS_OPTIONS.includes(b.paymentStatus) ? b.paymentStatus : b.paid === true ? 'Paid' : 'Pending'
  const sendConfirmation = b.sendConfirmation === true

  const fields: Record<string, unknown> = {
    Name: name,
    Email: String(b.email || ''),
    PhoneNumber: String(b.phone || ''),
    Luggage: luggage,
    'Backpack / Purse (ISK 1000 pr. item)': backpacks,
    ArrivalDate: arrivalDate,
    'Arrival time': String(b.arrivalTime || ''),
    'Departure date': departureDate,
    'Departure time': String(b.departureTime || ''),
    'Late check-out (ISK 500 pr. bag)': late,
    'Delivery Service': delivery,
    'Total Amount ISK': total,
    'Type of storage': storageType,
    Reference: String(b.reference || 'Counter'),
    'Paid?': b.paid === true,
    'Payment Status': paymentStatus,
    Athugasemd: String(b.comment || ''),
    // Counter bookings never trip the unconfirmed-payment reconciliation alert.
    'Reconcile alert sent': true,
    // Suppress the auto-confirmation unless explicitly requested.
    'Confirmation Email Sent': !sendConfirmation,
  }
  if (greidsla) fields['Greiðsla'] = greidsla
  if (delivery && b.deliveryAddress) fields['Delivery Address'] = String(b.deliveryAddress)
  if (b.hotelName) fields['Hotel or Cruise ship name'] = String(b.hotelName)

  try {
    const table = getStorageTable()
    const created = await table.create([{ fields: fields as FieldSet }])
    const rec = created[0]
    const bookingNumber = rec.id.slice(-5)

    if (sendConfirmation && fields.Email) {
      try {
        await notifyConfirmationEmail(rec.id)
      } catch (e) {
        console.error('[storage-ops/create] confirmation ping failed:', e)
      }
    }

    return res.status(200).json({ ok: true, id: rec.id, bookingNumber, total, storageType })
  } catch (err) {
    console.error('[storage-ops/create] failed:', err)
    return res.status(500).json({ message: (err as Error).message || 'Create failed' })
  }
}
