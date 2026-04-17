import { NextApiRequest, NextApiResponse } from 'next'
import { getTagNumbersTable, minifyItems } from '../../../utils/airtable'

/**
 * Fetches tag number records (with bag photos) linked to an order number.
 * Uses Airtable filterByFormula for server-side filtering.
 * GET /api/airtable/tag-numbers?orderNo=IYixC
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const orderNo =
    (req.query.orderNo as string) || (req.body?.orderNo as string)

  if (!orderNo) {
    return res.status(400).json({ message: 'orderNo is required' })
  }

  if (!/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.status(400).json({ message: 'invalid orderNo' })
  }

  try {
    const table = getTagNumbersTable()

    // Tag records have an 'Order No' field with the order number string
    const records = await table
      .select({
        filterByFormula: `{Order No} = '${orderNo}'`,
      })
      .all()

    const items = minifyItems(records)

    // Extract attachment URLs — try common field names
    const attachmentFieldNames = [
      'Attachments',
      'attachments',
      'Photos',
      'Images',
      'Mynd',
    ]
    const photos = items
      .map((record) => {
        for (const fieldName of attachmentFieldNames) {
          const attachments = record.fields[fieldName] as
            | Array<{
                url: string
                filename: string
                type: string
                thumbnails?: any
              }>
            | undefined
          if (attachments && attachments.length > 0) {
            return attachments.map((att) => ({
              url: att.url,
              filename: att.filename,
              type: att.type,
            }))
          }
        }
        return null
      })
      .filter(Boolean)
      .flat()

    res.status(200).json({ photos, count: photos.length })
  } catch (error: any) {
    console.error('Tag numbers error:', error)
    res.status(500).json({
      message: 'Error reading tag numbers',
      error: error?.message || String(error),
    })
  }
}
