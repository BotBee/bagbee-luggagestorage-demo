import { NextApiRequest, NextApiResponse } from 'next'
import { getTable, minifyItems } from '../../../utils/airtable'

// This handler updates a specific records paid status to true. It should only be called by a Rapyd webhook.
// Can we send in an auth bearer token via the webhook and verify it here to secure this endpoint?
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const recordId = req.body as string

  try {
    const table = getTable()
    const records = await table.select().all()
    const record = minifyItems(records).find(
      (x) => x.fields['Record ID'] === recordId
    )
    // update paid status by recordId
    await table.update(record!.id, { Greiðslustaða: 'Greitt', Greitt: true })
    res.status(200).json(record)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'error in updating results' })
  }
}
