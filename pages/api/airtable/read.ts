import { NextApiRequest, NextApiResponse } from 'next'
import { getTable, minifyItems } from '../../../utils/airtable'

/**
 * This handler finds a record by record ID in our Airtable instance.
 * Currently there's not a faster way to get a record by id than to fetch all records and filter the results by id.
 * https://community.airtable.com/t5/development-apis/fastest-way-to-retrieve-a-specific-record-by-id/td-p/118621
 *
 * TODO: We need to change this method as soon as the Airtable SDK offers an option for this.
 * @param req The request object from our client
 * @param res Airtable record
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const recordId = req.body['Record ID'] as number

  if (!recordId) {
    res.status(500).json({ message: 'Order ID must be a string' })
  }
  try {
    const table = getTable()
    const records = await table.select({}).all()
    const record = minifyItems(records).find(
      x => x.fields['Record ID'] === recordId
    )

    res.status(200).json(record)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'error in reading results' })
  }
}
