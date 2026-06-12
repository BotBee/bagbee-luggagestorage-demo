import { NextApiRequest, NextApiResponse } from 'next'
import { getLeiguflugTable, getOrdersLookupTable } from '../../../utils/airtable'

/**
 * Save the passenger names that BagBee needs in order to check in everyone
 * in a charter-flight party. Replaces the legacy email→Fillout-form flow.
 *
 * Triggered by the inline card on /orders/{code} when the order's flight
 * number matches the charter pattern (FI1XXX, e.g. FI1080).
 *
 * Body: { recordId: string, passengers: string[] }
 *   recordId    — the Nýtt/óflokkað order record ID this submission belongs to
 *   passengers  — full names, position 0 is the primary booker
 *
 * The Leiguflug table has Passenger 1, Passenger 2, Passenger 3, ... fields
 * (one column per passenger). We fan the array out into those columns.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { recordId, passengers } = req.body ?? {}

  if (typeof recordId !== 'string' || !/^rec[A-Za-z0-9]{14}$/.test(recordId)) {
    return res.status(400).json({ message: 'recordId is required' })
  }
  if (!Array.isArray(passengers) || passengers.length === 0) {
    return res.status(400).json({ message: 'at least one passenger is required' })
  }
  const cleaned: string[] = passengers
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter((p) => p.length > 0)
  if (cleaned.length === 0) {
    return res.status(400).json({ message: 'passenger names cannot all be empty' })
  }
  if (cleaned.length > 10) {
    return res.status(400).json({ message: 'too many passengers' })
  }

  try {
    // Pull the order so we can copy email + flight info onto the new
    // Leiguflug record (lookups will fill in the rest via the linked field,
    // but we want the email plain on the row for the BagBee inbox view).
    const ordersTable = getOrdersLookupTable()
    const orderRecord = await ordersTable.find(recordId)
    const email =
      (orderRecord.fields['Tölvupóstfang'] as string | undefined) ||
      (orderRecord.fields['Pickup e-mail address'] as string | undefined) ||
      ''
    const flightDate = orderRecord.fields['Dagsetning flugs'] as
      | string
      | undefined
    const flightNumber = (orderRecord.fields['Flugnúmer'] as
      | string
      | undefined) || ''
    const orderId = orderRecord.fields['Order ID']
    const orderNumberStr =
      typeof orderId === 'number' || typeof orderId === 'string'
        ? String(orderId)
        : ''

    const leiguflugTable = getLeiguflugTable()

    // Fan passengers[] out into Passenger 1, Passenger 2, ... columns.
    // The visible Leiguflug schema has Passenger 1 / 2 / 3 — anything beyond
    // 3 will fail to write if those columns don't exist; the cap above
    // (10) is generous and we'll catch the Airtable error if it does.
    // Airtable's TS types don't know about the Leiguflug fields — we keep
    // the shape loose and let the Airtable API itself return an error if a
    // field name doesn't exist (e.g. on first deploy if 'Pöntunarnúmer'
    // isn't the right linked-record field name).
    const fields: { [key: string]: any } = {
      Email: email,
    }
    if (flightDate) fields['Flight date'] = flightDate
    if (flightNumber) fields['FlightNumber'] = flightNumber
    if (orderNumberStr) fields['order number'] = orderNumberStr
    cleaned.forEach((name, i) => {
      fields[`Passenger ${i + 1}`] = name
    })

    // Linked-record back to Orders. The Fast Track table uses 'Pöntunarnúmer'
    // for the same purpose, and existing Leiguflug rows show numeric Order IDs
    // there (the linked Orders row's primary field). If Airtable returns
    // "unknown field name" on this key the column has been renamed — check
    // the table schema and update.
    fields['Pöntunarnúmer'] = [recordId]

    const created = await leiguflugTable.create([{ fields }] as any)

    return res.status(200).json({
      id: (created as any)[0].id,
      passengerCount: cleaned.length,
    })
  } catch (error: any) {
    console.error('[api][charter][passengers] error', error)
    // Pass the Airtable error message back so the UI can surface it (e.g.
    // unknown field name on first-deploy field-mapping verification).
    return res.status(500).json({
      message: 'Failed to save passenger info',
      error: error?.message || String(error),
    })
  }
}
