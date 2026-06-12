import https from 'https'
import { NextApiRequest, NextApiResponse } from 'next'
import { generateRandomString, sign } from '../../../common/rapyd-helper'
import { getOrdersLookupTable, getFastTrackTable } from '../../../utils/airtable'
import getAppConfig from '../../../modules/config'

const {
  publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
} = getAppConfig()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  // Authenticate request
  const authKey = req.headers['x-refund-key']
  if (!authKey || authKey !== process.env.REFUND_API_KEY) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const { paymentId, orderNo, recordId, tableType, reason } = req.body

  if (!paymentId) {
    return res.status(400).json({ message: 'paymentId is required' })
  }

  // Resolve which Airtable row to flip Refund Status on. The bag-orders cancel
  // flow passes `orderNo` (the 5-char Pöntunarnúmer fx). Airtable automations
  // for Fast-Track pass `recordId` directly, because the Fast Track table
  // doesn't have a Fast-Track-unique order number — `order number` there is
  // the parent N/Ó order's, and one parent can have multiple Fast-Track rows.
  const isFastTrack = tableType === 'fast-track'
  const lookupTable = () => (isFastTrack ? getFastTrackTable() : getOrdersLookupTable())
  const findTargetRecord = async () => {
    const table = lookupTable()
    if (recordId && /^rec[a-zA-Z0-9]+$/.test(recordId)) {
      try {
        return await table.find(recordId)
      } catch {
        return null
      }
    }
    if (orderNo) {
      const filterField = isFastTrack ? 'order number' : 'Pöntunarnúmer (fx)'
      const records = await table
        .select({
          filterByFormula: `{${filterField}} = '${orderNo}'`,
          maxRecords: 1,
        })
        .firstPage()
      return records[0] || null
    }
    return null
  }

  try {
    // Call Rapyd POST /v1/refunds
    const path = '/v1/refunds'
    const body = {
      payment: paymentId,
      reason: reason || `Refund for order ${orderNo || 'unknown'}`,
    }

    const salt = generateRandomString(8)
    const timestamp = Math.round(new Date().getTime() / 1000)
    const signature = sign('post', path, salt, timestamp, body)

    const options = {
      hostname: rapydBaseUrl,
      port: 443,
      path,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        salt,
        timestamp,
        signature,
        access_key: rapydAccessKey,
        idempotency: new Date().getTime().toString(),
      },
    }

    const result: any = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = ''
        response.on('data', (chunk) => (data += chunk))
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (response.statusCode === 200) resolve(parsed)
            else reject({ statusCode: response.statusCode, ...parsed })
          } catch {
            reject({ statusCode: response.statusCode, raw: data })
          }
        })
      })
      request.on('error', reject)
      request.write(JSON.stringify(body))
      request.end()
    })

    // Update Airtable refund status
    try {
      const record = await findTargetRecord()
      if (record) {
        await lookupTable().update(record.id, { 'Refund Status': 'Refunded' })
      }
    } catch (airtableError) {
      console.error('[api][rapyd][refund] Airtable update error:', airtableError)
      // Refund succeeded but Airtable update failed — still return success
    }

    res.status(200).json({ success: true, refund: result })
  } catch (error: any) {
    console.error('[api][rapyd][refund] Rapyd refund error:', error)

    // Try to mark as failed in Airtable
    try {
      const record = await findTargetRecord()
      if (record) {
        await lookupTable().update(record.id, { 'Refund Status': 'Refund Failed' })
      }
    } catch {
      // ignore secondary failure
    }

    res.status(500).json({ success: false, message: 'Refund failed', error: error?.message || error })
  }
}
