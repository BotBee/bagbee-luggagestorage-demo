import { NextApiRequest, NextApiResponse } from 'next'
import { getLeiguflugTable, getOrdersLookupTable } from '../../../utils/airtable'

/**
 * Has this order already submitted its charter-flight passenger list?
 * Drives whether /orders/{code}'s charter card shows the form or the
 * "thanks, we have your info" state.
 *
 * GET /api/charter/status?recordId=recXXXXXXXXXXXXXX
 *
 * Lookup strategy: pull the latest 200 Leiguflug records and check
 * every field on each row to see if any string array contains the
 * order's recordId. This is robust to the linked-record field being
 * named anything (Pöntunarnúmer / Pöntun / Order / etc.) — we don't
 * have to guess. Earlier sort+filter version sorted by `Flight date`
 * desc + maxRecords:50 + assumed the field was named `Pöntunarnúmer`,
 * and missed records when either of those assumptions was wrong
 * (e.g. when the new row had no Flight date set yet, it sorted to
 * the bottom and fell off the first 50). Reported by user 2026-05-04.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const recordId = (req.query.recordId as string) || ''
  if (!/^rec[A-Za-z0-9]{14}$/.test(recordId)) {
    return res.status(400).json({ message: 'recordId is required' })
  }

  try {
    // Look up the order's numeric Order ID so we can match Leiguflug rows
    // by the text `order number` column too. This is the redundant path:
    // even if the `Pöntunarnúmer` linked-record write silently drops, the
    // text field gives us a deterministic match.
    let orderNumberStr = ''
    try {
      const orderRecord = await getOrdersLookupTable().find(recordId)
      const orderId = orderRecord.fields['Order ID']
      if (typeof orderId === 'number' || typeof orderId === 'string') {
        orderNumberStr = String(orderId)
      }
    } catch {
      // Fall through — we'll still try the linked-record scan below.
    }

    const table = getLeiguflugTable()
    let rows: ReadonlyArray<any> = []
    try {
      rows = (await table
        .select({ maxRecords: 200 })
        .firstPage()) as ReadonlyArray<any>
    } catch {
      rows = []
    }

    const matchesOrder = (r: any): boolean => {
      const fields = r?.fields || {}
      // Path 1: linked-record field — any string array containing recordId.
      for (const value of Object.values(fields)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === 'string' && item === recordId) return true
          }
        }
      }
      // Path 2: text `order number` field matches the order's Order ID.
      if (orderNumberStr) {
        const orderNumberField = fields['order number']
        if (
          typeof orderNumberField === 'string' &&
          orderNumberField.trim() === orderNumberStr
        ) {
          return true
        }
        if (
          typeof orderNumberField === 'number' &&
          String(orderNumberField) === orderNumberStr
        ) {
          return true
        }
      }
      return false
    }

    const linked = rows.filter(matchesOrder)

    if (linked.length === 0) {
      return res.status(200).json({ submitted: false })
    }

    const r = linked[0]
    const passengers: string[] = []
    for (let i = 1; i <= 10; i++) {
      const v = r.fields[`Passenger ${i}`]
      if (typeof v === 'string' && v.trim()) passengers.push(v.trim())
    }
    return res.status(200).json({
      submitted: true,
      passengerCount: passengers.length,
      passengers,
    })
  } catch (error: any) {
    console.error('[api][charter][status] error', error)
    // Soft-fail: pretend not-submitted so the customer can still send. Worst
    // case they send twice and BagBee de-duplicates manually.
    return res.status(200).json({ submitted: false, error: error?.message })
  }
}
