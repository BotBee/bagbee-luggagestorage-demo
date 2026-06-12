import Airtable, { FieldSet, Table } from 'airtable'
import { NextApiRequest, NextApiResponse } from 'next'
import getAppConfig from '../../../modules/config'
import { findBookingRecord } from '../../../utils/resolveBooking'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'

const getStorageTable = (): Table<FieldSet> => {
  const {
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
  } = getAppConfig()
  Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
  return Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)
}

/**
 * Public endpoint hit by the customer-facing order page.
 *
 *   GET   → returns the booking record (read-only, used to render the page).
 *   PATCH → narrowly scoped: only `Payment Status: 'Cancelled'` is accepted,
 *           and only when the current status is `Pending` or `Paid`.
 *           Anything else is rejected.
 *
 * Marking a booking *paid* is intentionally NOT possible here — that path
 * runs through `/api/storage/confirm-payment` (which verifies with Rapyd)
 * or the Rapyd webhook. This prevents a stranger who guesses a record ID
 * from flipping bookings to Paid, zeroing the amount, etc.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string }

  if (!id || typeof id !== 'string') return res.status(400).json({ message: 'Missing id' })

  const table = getStorageTable()

  if (req.method === 'GET') {
    try {
      // Accept the short Booking Number (RIGHT(RECORD_ID(),5)) or a full rec id.
      const record = await findBookingRecord(table, id)
      if (!record) return res.status(404).json({ message: 'Booking not found' })
      return res.status(200).json({ id: record.id, fields: record.fields })
    } catch {
      return res.status(404).json({ message: 'Booking not found' })
    }
  }

  if (req.method === 'PATCH') {
    try {
      const body = (req.body || {}) as Record<string, unknown>
      const keys = Object.keys(body)

      // 1. Reject any field other than `Payment Status`
      if (keys.length === 0 || keys.some((k) => k !== 'Payment Status')) {
        return res
          .status(400)
          .json({ message: 'Only Payment Status updates are allowed' })
      }

      // 2. The only status transition the browser may request is → Cancelled
      const newStatus = body['Payment Status']
      if (newStatus !== 'Cancelled') {
        return res.status(400).json({ message: 'Invalid status transition' })
      }

      // 3. Guard against downgrading already-finalised bookings
      let current
      try {
        current = await table.find(id)
      } catch {
        return res.status(404).json({ message: 'Booking not found' })
      }
      const currentStatus = current.fields['Payment Status'] as string | undefined

      if (currentStatus === 'Refunded') {
        return res.status(409).json({ message: 'Booking already refunded' })
      }
      if (currentStatus === 'Cancelled') {
        // Idempotent no-op
        return res.status(200).json({ id: current.id, fields: current.fields })
      }
      // `Pending` and `Paid` are the only states from which a cancel is allowed.
      if (currentStatus !== 'Pending' && currentStatus !== 'Paid') {
        return res
          .status(409)
          .json({ message: `Cannot cancel from status "${currentStatus ?? 'unknown'}"` })
      }

      const updated = await table.update(id, { 'Payment Status': 'Cancelled' } as FieldSet)
      return res.status(200).json({ id: updated.id, fields: updated.fields })
    } catch (err) {
      console.error('[Storage PATCH] Failed:', err)
      return res.status(500).json({ message: 'Update failed' })
    }
  }

  return res.status(405).end()
}
