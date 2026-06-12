/**
 * POST /api/kef/[id]/edit — change dates / windows / return location on a paid
 * KEF bike-box order (box count is fixed; to change it, cancel + rebook).
 *
 *   diff > 0  → Rapyd top-up checkout; applied on payment (webhook → applyKefEdit)
 *   diff <= 0 → applied immediately; partial refund when diff < 0
 *
 * Applying re-checks capacity, reassigns lockers, updates every per-box row, and
 * re-syncs the PINs (revoke + clear → the cron re-issues for the new window).
 * Edits close 24h before the current drop-off.
 */
import https from 'https'
import { NextApiRequest, NextApiResponse } from 'next'
import { generateRandomString, sign } from '../../../../common/rapyd-helper'
import getAppConfig from '../../../../modules/config'
import { partialRefund } from '../../../../utils/rapydRefund'
import { calcKefPrice } from '../../../../utils/kefPricing'
import {
  assignLockers,
  findKefBooking,
  isoDateTime,
  loadOrderRows,
  revokePinsForRows,
  updateKefRows,
  PIN_RESET_FIELDS,
  type WindowReq,
} from '../../../../utils/kefBooking'
import { FLD } from '../../../../utils/kefLockersAirtable'

const SITE_URL = 'https://www.bagbee.is'

export type KefEditPayload = {
  dropoffDate: string
  dropoffTime: string
  dropoffHours: number
  returnLocation: 'kef' | 'bsi'
  pickupDate: string
  pickupTime: string
  pickupHours: number
  newTotal: number
}

const windows = (e: KefEditPayload): { dropoff: WindowReq; pickup: WindowReq | null; isKef: boolean } => {
  const isKef = e.returnLocation !== 'bsi'
  const ds = Date.parse(isoDateTime(e.dropoffDate, e.dropoffTime))
  const dropoff = { start: ds, end: ds + Math.max(3, e.dropoffHours) * 3600000 }
  let pickup: WindowReq | null = null
  if (isKef && e.pickupDate && e.pickupTime) {
    const ps = Date.parse(isoDateTime(e.pickupDate, e.pickupTime))
    pickup = { start: ps, end: ps + Math.max(3, e.pickupHours) * 3600000 }
  }
  return { dropoff, pickup, isKef }
}

/** Apply an edit to every row of an order: reassign lockers, update windows,
 *  re-sync PINs. Exported so the webhook can call it after a top-up payment. */
export async function applyKefEdit(leadId: string, edit: KefEditPayload): Promise<void> {
  const lead = await findKefBooking(leadId)
  if (!lead) throw new Error('KEF edit: lead booking not found')
  const lf = lead.fields as Record<string, any>
  const checkoutId = lf[FLD.bookings.rapydCheckoutId] as string | undefined
  const rows = checkoutId ? await loadOrderRows(checkoutId) : [lead]
  const boxes = rows.length
  const { dropoff, pickup, isKef } = windows(edit)

  const assigned = await assignLockers({ boxes, dropoff, pickup, excludeCheckoutId: checkoutId })
  if ('error' in assigned) throw new Error('KEF edit: capacity changed, cannot apply')

  await revokePinsForRows(rows)
  const perBox = Math.round(edit.newTotal / boxes)

  await Promise.all(
    rows.map((r, i) => {
      const a = assigned.assignments[i]
      const fields: Record<string, any> = {
        [FLD.bookings.checkInDatetime]: new Date(dropoff.start).toISOString(),
        [FLD.bookings.checkInWindowEnd]: new Date(dropoff.end).toISOString(),
        [FLD.bookings.lockerIn]: [a.lockerIn],
        [FLD.bookings.returnLocation]: isKef ? 'KEF airport' : 'BSÍ terminal',
        [FLD.bookings.amount]: perBox,
        ...PIN_RESET_FIELDS,
      }
      if (pickup && a.lockerOut) {
        fields[FLD.bookings.checkOutDatetime] = new Date(pickup.start).toISOString()
        fields[FLD.bookings.checkOutWindowEnd] = new Date(pickup.end).toISOString()
        fields[FLD.bookings.lockerOut] = [a.lockerOut]
      } else {
        fields[FLD.bookings.checkOutDatetime] = null
        fields[FLD.bookings.checkOutWindowEnd] = null
        fields[FLD.bookings.lockerOut] = []
      }
      return updateKefRows([r.id], fields)
    }),
  )
}

const createTopup = (
  amount: number,
  leadId: string,
  edit: KefEditPayload,
  rapydBaseUrl: string,
  rapydAccessKey: string,
): Promise<any> => {
  const path = '/v1/checkout'
  const success = `${SITE_URL}/kef/payment-success?bookingId=${leadId}`
  const cancel = `${SITE_URL}/kef/${leadId}`
  const body = {
    amount,
    currency: 'ISK',
    country: 'IS',
    language: 'EN',
    complete_payment_url: success,
    error_payment_url: cancel,
    complete_checkout_url: success,
    cancel_checkout_url: cancel,
    merchant_reference_id: `bagbee-kef-${leadId}-topup-${Date.now()}`,
    metadata: { bookingId: leadId, tableType: 'kef', kind: 'topup', edit: JSON.stringify(edit) },
  }
  const salt = generateRandomString(8)
  const timestamp = Math.round(Date.now() / 1000)
  const signature = sign('POST', path, salt, timestamp, body)
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body)
    const r = https.request(
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
          idempotency: `${leadId}-kef-topup-${Date.now()}`,
        },
      },
      (resp) => {
        let data = ''
        resp.on('data', (c) => (data += c))
        resp.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (resp.statusCode !== 200) return reject(parsed)
            resolve(parsed)
          } catch {
            reject(new Error(`Rapyd non-JSON ${resp.statusCode}`))
          }
        })
      },
    )
    r.on('error', reject)
    r.write(bodyStr)
    r.end()
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { id } = req.query as { id?: string }
  if (!id || typeof id !== 'string') return res.status(400).json({ message: 'Missing booking id' })

  const {
    publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
  } = getAppConfig()
  const inB = (req.body || {}) as Partial<KefEditPayload>

  try {
    const lead = await findKefBooking(id)
    if (!lead) return res.status(404).json({ message: 'Booking not found' })
    const lf = lead.fields as Record<string, any>
    if (lf[FLD.bookings.paymentStatus] !== 'Paid') {
      return res.status(409).json({ message: 'Only paid bookings can be edited' })
    }
    // 24h cutoff on the current drop-off.
    const curMs = Date.parse(String(lf[FLD.bookings.checkInDatetime] || ''))
    if (!isNaN(curMs) && (curMs - Date.now()) / 3_600_000 < 24) {
      return res.status(409).json({ message: 'Edits close 24 hours before drop-off' })
    }

    const checkoutId = lf[FLD.bookings.rapydCheckoutId] as string | undefined
    const rows = checkoutId ? await loadOrderRows(checkoutId) : [lead]
    const boxes = rows.length
    const oldTotal = rows.reduce((s, r) => s + (Number((r.fields as any)[FLD.bookings.amount]) || 0), 0)

    const isKef = inB.returnLocation !== 'bsi'
    if (!inB.dropoffDate || !inB.dropoffTime || !inB.pickupDate) {
      return res.status(400).json({ message: 'Missing dates/times' })
    }
    if (isKef && !inB.pickupTime) {
      return res.status(400).json({ message: 'Pick-up time required for an airport return' })
    }

    const newTotal = calcKefPrice({
      boxes,
      dropoffDate: inB.dropoffDate,
      pickupDate: inB.pickupDate,
      returnLocation: isKef ? 'kef' : 'bsi',
      dropoffWindowHours: Number(inB.dropoffHours) || 3,
      pickupWindowHours: Number(inB.pickupHours) || 3,
    }).total

    const edit: KefEditPayload = {
      dropoffDate: inB.dropoffDate,
      dropoffTime: inB.dropoffTime,
      dropoffHours: Math.max(3, Number(inB.dropoffHours) || 3),
      returnLocation: isKef ? 'kef' : 'bsi',
      pickupDate: inB.pickupDate,
      pickupTime: inB.pickupTime || '',
      pickupHours: Math.max(3, Number(inB.pickupHours) || 3),
      newTotal,
    }

    // Re-check capacity for the new windows (excluding this order).
    const { dropoff, pickup } = windows(edit)
    if (!dropoff.start || isNaN(dropoff.start)) {
      return res.status(400).json({ message: 'Invalid drop-off time' })
    }
    const cap = await assignLockers({ boxes, dropoff, pickup, excludeCheckoutId: checkoutId })
    if ('error' in cap) {
      return res.status(409).json({
        message: 'Those times are no longer available — please choose another slot.',
      })
    }

    const diff = newTotal - oldTotal

    if (diff > 0) {
      const checkout = await createTopup(
        diff,
        lead.id,
        edit,
        rapydBaseUrl as string,
        rapydAccessKey as string,
      )
      const redirectUrl: string | undefined = checkout.data?.redirect_url
      if (!redirectUrl) return res.status(500).json({ message: 'Failed to create payment link' })
      return res.status(200).json({ status: 'topup', diff, redirectUrl })
    }

    // diff <= 0 → apply now, refund the difference if cheaper.
    await applyKefEdit(lead.id, edit)
    if (diff < 0) {
      const paymentId = lf[FLD.bookings.rapydPaymentId] as string | undefined
      if (paymentId) {
        try {
          await partialRefund(paymentId, Math.abs(diff), rapydBaseUrl as string, rapydAccessKey as string)
        } catch (err) {
          console.error('[KEF edit] partial refund failed:', err)
          return res.status(200).json({
            status: 'updated',
            diff,
            warning: 'Saved — refund needs manual processing',
          })
        }
      }
    }
    return res.status(200).json({ status: 'updated', diff, refunded: diff < 0 ? Math.abs(diff) : 0 })
  } catch (err) {
    console.error('[KEF edit] failed:', err)
    return res.status(500).json({ message: (err as Error).message || 'Edit failed' })
  }
}
