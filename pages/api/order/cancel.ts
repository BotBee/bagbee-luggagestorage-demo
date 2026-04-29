import https from 'https'
import { NextApiRequest, NextApiResponse } from 'next'
import { getOrdersLookupTable } from '../../../utils/airtable'
import { generateRandomString, sign } from '../../../common/rapyd-helper'
import getAppConfig from '../../../modules/config'

/**
 * Customer-facing order cancellation.
 *
 * Flow:
 *  1. Look up the order by `Pöntunarnúmer (fx)`.
 *  2. Refuse cancellation if status is `In progress`, `Delivered`, or already
 *     `Cancelled` — at that point the driver has already started moving bags
 *     around and refunds need human review.
 *  3. Collect every Rapyd payment ID for the order (new multiline
 *     `Rapyd Payment IDs` field, falling back to singular `Rapyd Payment ID`
 *     for older orders that predate the multiline field).
 *  4. Refund each payment via Rapyd's `POST /v1/refunds`. Track per-payment
 *     success/failure. If any refund fails, mark the record
 *     `Refund Status = 'Refund Failed'` so BagBee staff can follow up manually.
 *  5. Set `Update Order (add bags, send order confirmation etc)` to
 *     `['Cancel & Refund']` which the `Order Status` formula reads and
 *     resolves to `"Cancelled"` — no need to write a single-select directly.
 *
 * Auth model: the `orderNo` is the customer-facing 5-char identifier already
 * embedded in the order URL. Anyone who knows that URL can cancel; that matches
 * the existing auth model for other customer actions on the order page
 * (adding bags, buying Fast-Track, tipping). There's no separate API key.
 */

const {
  publicRuntimeConfig: { rapydBaseUrl, rapydAccessKey },
} = getAppConfig()

type RefundResult = {
  paymentId: string
  success: boolean
  error?: string
}

async function refundOne(paymentId: string, orderNo: string): Promise<RefundResult> {
  try {
    const path = '/v1/refunds'
    const body = {
      payment: paymentId,
      reason: `Customer cancelled order ${orderNo}`,
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
        idempotency: `${paymentId}-${Date.now()}`,
      },
    }

    await new Promise<void>((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = ''
        response.on('data', (chunk) => (data += chunk))
        response.on('end', () => {
          if (response.statusCode === 200) resolve()
          else reject(new Error(`Rapyd ${response.statusCode}: ${data}`))
        })
      })
      request.on('error', reject)
      request.write(JSON.stringify(body))
      request.end()
    })

    return { paymentId, success: true }
  } catch (err: any) {
    return { paymentId, success: false, error: err?.message || String(err) }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { orderNo } = req.body as { orderNo?: string }
  if (!orderNo || !/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.status(400).json({ message: 'orderNo is required' })
  }

  try {
    const table = getOrdersLookupTable()
    const records = await table
      .select({
        filterByFormula: `{Pöntunarnúmer (fx)} = '${orderNo}'`,
        maxRecords: 1,
      })
      .firstPage()

    if (records.length === 0) {
      return res.status(404).json({ message: 'Order not found' })
    }
    const record = records[0]

    // Disallow cancellation if the order is already in motion.
    const rawStatus: any = record.fields['Order Status']
    const statusName =
      typeof rawStatus === 'string'
        ? rawStatus
        : rawStatus && typeof rawStatus === 'object' && 'name' in rawStatus
          ? String((rawStatus as any).name)
          : ''
    const blocked = ['In progress', 'In Progress', 'Delivered', 'Cancelled']
    if (blocked.includes(statusName)) {
      return res.status(409).json({
        message: `Cannot cancel order with status "${statusName}"`,
        status: statusName,
      })
    }

    // Collect every payment ID. Prefer the new multiline list; fall back to
    // the legacy singular field for orders that paid before it existed.
    const multiline = String(record.fields['Rapyd Payment IDs'] || '').trim()
    const legacy = String(record.fields['Rapyd Payment ID'] || '').trim()
    const paymentIds = Array.from(
      new Set(
        (multiline ? multiline.split('\n') : [legacy])
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    )

    // Refund each payment (parallel — Rapyd doesn't rate-limit this and they
    // target different transactions).
    const results: RefundResult[] =
      paymentIds.length === 0
        ? []
        : await Promise.all(paymentIds.map((id) => refundOne(id, orderNo)))

    const allOk = results.every((r) => r.success)

    // Flip Airtable state regardless of refund outcome:
    //  - `Update Order` = ['Cancel & Refund'] → formula → Order Status = Cancelled
    //  - `Refund Status` singleSelect choices: Refund Requested / Refunded / Refund Failed
    //    (no Partial / Not Applicable options exist, so we collapse:
    //      all ok → Refunded, any fail → Refund Failed,
    //      no payments → leave Refund Status unchanged since there's nothing
    //      to refund and "Refund Failed" would be misleading.)
    const refundStatus =
      paymentIds.length === 0 ? null : allOk ? 'Refunded' : 'Refund Failed'

    // Clear Update Order first so the automation retriggers even if it was
    // already set to Cancel & Refund (matches the pattern in
    // pages/api/order/payment-success.ts — see commit 1d1632d).
    await table.update(record.id, {
      'Update Order (add bags, send order confirmation etc)': [],
    })
    await table.update(record.id, {
      'Update Order (add bags, send order confirmation etc)': ['Cancel & Refund'],
      ...(refundStatus ? { 'Refund Status': refundStatus } : {}),
    })

    return res.status(200).json({
      success: allOk,
      refundStatus,
      refunds: results,
      paymentCount: paymentIds.length,
    })
  } catch (err: any) {
    console.error('[api][order][cancel] error', err)
    return res
      .status(500)
      .json({ message: 'Cancellation failed', error: err?.message || String(err) })
  }
}
