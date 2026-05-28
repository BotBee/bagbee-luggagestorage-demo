import { NextApiRequest, NextApiResponse } from 'next'
import { AirtableOrder } from '../../../common/types'
import { getMinifiedItem, getTable } from '../../../utils/airtable'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const item = req.body
  try {
    const table = getTable()
    const newRecord = await table.create([{ fields: item as AirtableOrder }])
    res.status(200).json(getMinifiedItem(newRecord[0]))
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error })
  }
}
