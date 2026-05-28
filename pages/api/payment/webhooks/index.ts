import { NextApiRequest, NextApiResponse } from 'next'
import { getFastTrackTable, getTable, minifyItems } from '../../../../utils/airtable'
import { sign } from '../../../../common/rapyd-helper'
import { Readable } from 'stream'

export const config = {
  api: {
    bodyParser: false,
  },
}

async function buffer(readable: Readable) {
  const chunks = []
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      console.warn('[api][payment][webhooks] method not allowed', req.method)
      return res.status(405).json({ message: 'Method not allowed' })
    }

    console.log('[api][payment][webhooks] webhook triggered')
    const buf = await buffer(req)
    const rawRequest = buf.toString('utf8')
    const request = JSON.parse(rawRequest)

    const rapydSecret = process.env.RAPYD_SECRET_KEY
    const rapydAccessKey = process.env.RAPYD_ACCESS_KEY
    if (!rapydSecret || !rapydAccessKey) {
      console.log('[api][payment][webhooks] Rapyd secret or access key is missing')
      return res.status(500).json({ message: 'Internal server error' })
    }

    const signature = sign(
      '', // no method for webhooks
      new URL(req.url || '', `https://${req.headers.host}`).toString(),
      String(req.headers['salt']),
      Number(req.headers['timestamp']),
      request,
    )

    console.log('[api][payment][webhooks] signature', signature)

    if (req.headers['signature'] !== signature) {
      console.log('[api][payment][webhooks] Invalid signature')
      return res.status(400).json({ message: 'Invalid signature' })
    }

    if (request.type === 'PAYMENT_COMPLETED') {
      console.log('[api][payment][webhooks] metadata:', request.data.metadata)
      console.log('[api][payment][webhooks] payment id:', request.data.id)
      try {
        await UpdatePaidStatus(
          request.data.metadata.recordId,
          request.data.metadata.tableType,
          request.data.id,
        )
      } catch (error) {
        console.error('[api][payment][webhooks] Error updating paid status', error)
        return res.status(500).json({ message: 'Error updating paid status' })
      }
    } else {
      console.log('[api][payment][webhooks] Invalid request type', request.type)
      return res.status(400).json({ message: 'Invalid request type' })
    }

    return res.status(200).json({ message: 'Payment success' })
  } catch (error) {
    console.error('[api][payment][webhooks] Error processing payment', error)
    return res.status(500).json({ message: 'Error processing payment' })
  }
}

const UpdatePaidStatus = async (
  recordId: string,
  tableType: 'baggage' | 'fast-track',
  paymentId?: string,
) => {
  if (!recordId) {
    console.log('[api][payment][webhooks] record is missing')
    return
  }
  const table = tableType === 'baggage' ? getTable() : getFastTrackTable()
  const records = await table.select().all()
  const record = minifyItems(records).find((x) => x.id === recordId)
  if (!record) {
    console.error(`[api][payment][webhooks] Record with id ${recordId} not found`)
    return
  }
  // update paid status and store Rapyd payment ID for refund tracking
  if (tableType === 'baggage') {
    await table.update(record.id, {
      Greiðslustaða: 'Greitt',
      Greitt: true,
      ...(paymentId ? { 'Rapyd Payment ID': paymentId } : {}),
    })
  } else if (tableType === 'fast-track') {
    await table.update(record.id, {
      Greiddi: true,
      ...(paymentId ? { 'Rapyd Payment ID': paymentId } : {}),
    })
  }
  console.log('[api][payment][webhooks] updating paid status for record', recordId, 'paymentId', paymentId)
}
