import Airtable, { FieldSet, Table } from 'airtable'
import { NextApiRequest, NextApiResponse } from 'next'
import getAppConfig from '../../../modules/config'
import { findBookingRecord } from '../../../utils/resolveBooking'

// BikeRent rows live in the writable BSI Storage table (Reference='bikerent.is').
const BSI_BIKERENT_TABLE_ID = 'tblMJtxJiHFDi3TTk'

const getBikerentTable = (): Table<FieldSet> => {
  const {
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
  } = getAppConfig()
  Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
  return Airtable.base(airtableBaseId)(BSI_BIKERENT_TABLE_ID)
}

/**
 * GET → returns the BikeRent booking record, used by the customer-facing
 * /bikerent/[id] manage page. Marking paid / refunding is intentionally NOT
 * possible here — those run through confirm-payment (verifies with Rapyd), the
 * Rapyd webhook, or the cancel/edit endpoints.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string }
  if (!id || typeof id !== 'string') return res.status(400).json({ message: 'Missing id' })

  if (req.method !== 'GET') return res.status(405).end()

  try {
    const table = getBikerentTable()
    // Accept the short Booking Number (RIGHT(RECORD_ID(),5)) or a full rec id.
    const record = await findBookingRecord(table, id)
    if (!record) return res.status(404).json({ message: 'Booking not found' })
    return res.status(200).json({ id: record.id, fields: record.fields })
  } catch {
    return res.status(404).json({ message: 'Booking not found' })
  }
}
