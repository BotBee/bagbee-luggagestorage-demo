import https from 'https'
import Airtable, { FieldSet } from 'airtable'
import { NextApiRequest, NextApiResponse } from 'next'
import { generateRandomString, sign } from '../../../../common/rapyd-helper'
import getAppConfig from '../../../../modules/config'
import { calcBikerentPrice } from '../../../../utils/bikerentPricing'
import { deriveStorageType } from '../../../../utils/storagePricing'
import { partialRefund } from '../../../../utils/rapydRefund'
import { notifyBookingEvent } from '../../../../utils/notifyConfirmation'

// BikeRent rows live in the writable BSI Storage table (Reference='bikerent.is').
const BSI_BIKERENT_TABLE_ID = 'tblMJtxJiHFDi3TTk'
const SITE_URL = 'https://www.bagbee.is'

// Bike-box booking mapped onto BSI Storage fields: Luggage = bike boxes/bags,
// Backpack = folded boxes; drop-off → Arrival, pick-up → Departure.
const F = {
  dropoffDate: 'ArrivalDate',
  pickupDate: 'Departure date',
  dropoffTime: 'Arrival time',
  pickupTime: 'Departure time',
  hardBoxes: 'Luggage',
  foldedBoxes: 'Backpack / Purse (ISK 1000 pr. item)',
  lateCheckout: 'Late check-out (ISK 500 pr. bag)',
  note: 'Athugasemd',
  totalAmount: 'Total Amount ISK',
  paymentStatus: 'Payment Status',
  paymentId: 'Rapyd Payment ID',
  pendingTopupCheckoutId: 'Pending Top-up Checkout ID',
} as const

type EditInput = {
  hardBoxes?: number
  foldedBoxes?: number
  dropoffDate?: string
  dropoffTime?: string
  pickupDate?: string
  pickupTime?: string
  lateCheckout?: boolean
}

type Merged = Required<Omit<EditInput, 'lateCheckout'>> & { lateCheckout: boolean }

/** Parse "10:00 AM" / "10:00" → minutes since midnight; null if unparseable. */
const parseTimeToMinutes = (t?: string): number | null => {
  if (!t) return null
  const trimmed = t.trim()
  const ampm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(trimmed)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = parseInt(ampm[2], 10)
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0
    return h * 60 + m
  }
  const h24 = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (h24) {
    const h = parseInt(h24[1], 10)
    const m = parseInt(h24[2], 10)
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return h * 60 + m
  }
  return null
}

const dropoffMillis = (date?: string, time?: string): number | null => {
  if (!date) return null
  const mins = parseTimeToMinutes(time) ?? 0
  const ms = new Date(date).getTime()
  if (isNaN(ms)) return null
  return ms + mins * 60_000
}

const buildCalcNote = (merged: Merged): string => {
  const p = calcBikerentPrice({
    dropoffDate: merged.dropoffDate,
    pickupDate: merged.pickupDate,
    hardBoxes: merged.hardBoxes,
    foldedBoxes: merged.foldedBoxes,
    dropoffTime: merged.dropoffTime,
  })
  return [
    `Base fee: ${p.base.toLocaleString()} kr`,
    `Bike boxes/bags: ${merged.hardBoxes} × 1000 kr × ${p.days} day(s) = ${p.hardCost.toLocaleString()} kr`,
    `Folded boxes: ${merged.foldedBoxes} × 5000 kr = ${p.foldedCost.toLocaleString()} kr`,
    ...(p.afterHoursCost > 0
      ? [`After-hours drop-off (${merged.dropoffTime}): ${p.afterHoursCost.toLocaleString()} kr`]
      : []),
    `Total: ${p.total.toLocaleString()} kr`,
  ].join('\n')
}

const createTopupCheckout = (
  amount: number,
  bookingId: string,
  topup: Merged,
  newTotal: number,
  rapydBaseUrl: string,
  rapydAccessKey: string,
): Promise<any> => {
  const path = '/v1/checkout'
  const body = {
    amount,
    currency: 'ISK',
    country: 'IS',
    language: 'EN',
    complete_payment_url: `${SITE_URL}/bikerent/payment-success?bookingId=${bookingId}&kind=topup`,
    error_payment_url: `${SITE_URL}/bikerent/payment-cancel?bookingId=${bookingId}`,
    // Apple Pay / wallets follow complete_checkout_url (inline completion).
    complete_checkout_url: `${SITE_URL}/bikerent/payment-success?bookingId=${bookingId}&kind=topup`,
    cancel_checkout_url: `${SITE_URL}/bikerent/payment-cancel?bookingId=${bookingId}`,
    merchant_reference_id: `bagbee-bikerent-${bookingId}-topup-${Date.now()}`,
    metadata: {
      bookingId,
      tableType: 'bikerent',
      kind: 'topup',
      topup: JSON.stringify(topup),
      newTotal: String(newTotal),
    },
  }
  const salt = generateRandomString(8)
  const timestamp = Math.round(Date.now() / 1000)
  const signature = sign('POST', path, salt, timestamp, body)

  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body)
    const req = https.request(
      {
        hostname: rapydBaseUrl,
        port: 443,
        path,
        method: 'POST',
        headers: {
          'content-Type': 'application/json',
          salt,
          timestamp,
          signature,
          access_key: rapydAccessKey,
          idempotency: `${bookingId}-bikerent-topup-${Date.now()}`,
        },
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (res.statusCode !== 200) return reject(parsed)
            resolve(parsed)
          } catch {
            reject(new Error(`Rapyd non-JSON ${res.statusCode}: ${data.slice(0, 200)}`))
          }
        })
      },
    )
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

/**
 * Apply merged inputs to the BikeRent record. Exported so the webhook +
 * confirm-payment paths can apply a parked edit after a top-up clears.
 */
export const applyBikerentEdit = async (
  table: any,
  bookingId: string,
  merged: Merged,
  newTotal: number,
): Promise<void> => {
  await table.update(bookingId, {
    [F.dropoffDate]: merged.dropoffDate,
    [F.pickupDate]: merged.pickupDate,
    [F.dropoffTime]: merged.dropoffTime,
    [F.pickupTime]: merged.pickupTime,
    [F.hardBoxes]: merged.hardBoxes,
    [F.foldedBoxes]: merged.foldedBoxes,
    [F.lateCheckout]: merged.lateCheckout,
    [F.note]: buildCalcNote(merged),
    [F.totalAmount]: newTotal,
    'Type of storage': deriveStorageType({
      arrivalDate: merged.dropoffDate,
      departureDate: merged.pickupDate,
      late: merged.lateCheckout,
    }),
  } as FieldSet)
  // Send the "your booking has been updated" email (covers immediate edits and
  // edits applied after a top-up payment).
  await notifyBookingEvent(bookingId, 'updated')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { id } = req.query as { id?: string }
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Missing booking id' })
  }

  const {
    publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
  } = getAppConfig()

  const incoming = (req.body || {}) as EditInput

  try {
    Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
    const table = Airtable.base(airtableBaseId)(BSI_BIKERENT_TABLE_ID)

    let record
    try {
      record = await table.find(id)
    } catch {
      return res.status(404).json({ message: 'Booking not found' })
    }
    const f = record.fields as Record<string, any>

    // 1. Only paid bookings can be edited
    if (f[F.paymentStatus] !== 'Paid') {
      return res.status(409).json({ message: 'Only paid bookings can be edited' })
    }

    // 2. 12-hour cutoff before current drop-off
    const currentDropoff = dropoffMillis(f[F.dropoffDate] as string, f[F.dropoffTime] as string)
    if (currentDropoff !== null) {
      const hoursUntil = (currentDropoff - Date.now()) / (1000 * 60 * 60)
      if (hoursUntil < 24) {
        return res.status(409).json({ message: 'Edits closed within 24 hours of drop-off' })
      }
    }

    // 3. Merge incoming over existing (?? keeps a valid 0 / false)
    const merged: Merged = {
      hardBoxes: incoming.hardBoxes ?? (Number(f[F.hardBoxes]) || 0),
      foldedBoxes: incoming.foldedBoxes ?? (Number(f[F.foldedBoxes]) || 0),
      dropoffDate: incoming.dropoffDate ?? (f[F.dropoffDate] as string),
      dropoffTime: incoming.dropoffTime ?? (f[F.dropoffTime] as string),
      pickupDate: incoming.pickupDate ?? (f[F.pickupDate] as string),
      pickupTime: incoming.pickupTime ?? (f[F.pickupTime] as string),
      lateCheckout: incoming.lateCheckout ?? !!f[F.lateCheckout],
    }

    // 4. Sanity checks
    if (merged.hardBoxes < 0 || merged.foldedBoxes < 0) {
      return res.status(400).json({ message: 'Box counts cannot be negative' })
    }
    if (merged.hardBoxes + merged.foldedBoxes === 0) {
      return res.status(400).json({ message: 'At least one box required' })
    }
    const newDropoff = dropoffMillis(merged.dropoffDate, merged.dropoffTime)
    if (newDropoff !== null && newDropoff < Date.now()) {
      return res.status(400).json({ message: 'New drop-off time must be in the future' })
    }
    if (new Date(merged.pickupDate).getTime() < new Date(merged.dropoffDate).getTime()) {
      return res.status(400).json({ message: 'Pick-up date must be on or after drop-off' })
    }

    // 5. Price diff
    const oldTotal = Number(f[F.totalAmount]) || 0
    const newTotal = calcBikerentPrice({
      dropoffDate: merged.dropoffDate,
      pickupDate: merged.pickupDate,
      hardBoxes: merged.hardBoxes,
      foldedBoxes: merged.foldedBoxes,
      dropoffTime: merged.dropoffTime,
    }).total
    const diff = newTotal - oldTotal

    if (diff === 0) {
      await applyBikerentEdit(table, id, merged, newTotal)
      return res.status(200).json({ status: 'updated', newTotal, diff: 0 })
    }

    if (diff < 0) {
      const paymentIdRaw = f[F.paymentId] as string | undefined
      if (!paymentIdRaw) {
        console.warn('[BikeRent edit] Reducing paid booking with no payment ID:', id)
        await applyBikerentEdit(table, id, merged, newTotal)
        return res.status(200).json({
          status: 'updated',
          newTotal,
          diff,
          warning: 'Refund needs manual processing — payment ID missing',
        })
      }
      try {
        await partialRefund(paymentIdRaw, Math.abs(diff), rapydBaseUrl as string, rapydAccessKey as string)
      } catch (err) {
        console.error('[BikeRent edit] Partial refund failed:', err)
        return res.status(502).json({ message: 'Refund failed — booking unchanged' })
      }
      await applyBikerentEdit(table, id, merged, newTotal)
      return res.status(200).json({ status: 'updated', newTotal, diff, refunded: Math.abs(diff) })
    }

    // diff > 0 — top-up checkout; edit applied by webhook/confirm once paid.
    let checkout
    try {
      checkout = await createTopupCheckout(
        diff,
        id,
        merged,
        newTotal,
        rapydBaseUrl as string,
        rapydAccessKey as string,
      )
    } catch (err) {
      console.error('[BikeRent edit] Top-up checkout creation failed:', err)
      return res.status(502).json({ message: 'Could not create payment session' })
    }

    const redirectUrl: string | undefined = checkout.data?.redirect_url
    const topupCheckoutId: string | undefined = checkout.data?.id
    if (!redirectUrl) {
      return res.status(502).json({ message: 'Rapyd did not return a payment URL' })
    }
    if (topupCheckoutId) {
      try {
        await table.update(id, { [F.pendingTopupCheckoutId]: topupCheckoutId } as FieldSet)
      } catch (err) {
        console.warn('[BikeRent edit] Could not store pending topup checkout id:', err)
      }
    }

    return res.status(200).json({ status: 'pending_payment', diff, newTotal, redirectUrl })
  } catch (err) {
    console.error('[BikeRent edit] Failed:', err)
    return res.status(500).json({ message: 'Edit failed' })
  }
}
