import { NextApiRequest, NextApiResponse } from 'next'
import { getLeiguflugTable } from '../../../utils/airtable'

/**
 * Has this order already submitted its charter-flight passenger list?
 * Drives whether /orders/{code}'s charter card shows the form or the
 * "thanks, we have your info" state.
 *
 * GET /api/charter/status?recordId=recXXXXXXXXXXXXXX
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
    const table = getLeiguflugTable()
    // Filter on the linked-record field — its formula representation is the
    // primary field of the linked Orders row, but ARRAYJOIN lets us match
    // by the order's record id via a roundabout. Simpler: filter by Email or
    // by the link's display value. For robustness we just pull a small page
    // and look for matches in JS.
    let rows: ReadonlyArray<any> = []
    try {
      rows = (await table
        .select({ maxRecords: 50, sort: [{ field: 'Flight date', direction: 'desc' }] })
        .firstPage()) as ReadonlyArray<any>
    } catch {
      rows = []
    }

    const linked = rows.filter((r: any) => {
      const linkedField = r.fields['Pöntunarnúmer'] as
        | Array<string>
        | undefined
      if (!Array.isArray(linkedField)) return false
      return linkedField.some((id) => id === recordId)
    })

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
