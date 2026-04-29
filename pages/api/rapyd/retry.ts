import { NextApiRequest, NextApiResponse } from 'next'
import { getFastTrackTable, getTable } from '../../../utils/airtable'

/**
 * Spin up a fresh Rapyd checkout against an Airtable order that the customer
 * already created (but didn't successfully pay). Triggered from
 * /payment/cancel when the customer hits "Retry payment".
 *
 * The order itself is unchanged — same recordId, same amount, same currency.
 * Only a new Rapyd checkout (with its own redirect_url) is minted. When the
 * customer pays, the existing webhook flow flips Greitt → true on the same
 * record, so we don't end up with a duplicate order.
 *
 * Safety: only operates on orders where Greitt is still false. If the order
 * was somehow already paid (e.g. the webhook fired between cancel and retry)
 * we return 409 so the client can route them to /payment/success instead.
 */

type TableType = 'baggage' | 'fast-track'

const isValidTableType = (v: unknown): v is TableType =>
  v === 'baggage' || v === 'fast-track'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { recordId, tableType, locale } = req.body ?? {}

  if (typeof recordId !== 'string' || !/^rec[A-Za-z0-9]{14}$/.test(recordId)) {
    return res.status(400).json({ message: 'recordId is required' })
  }
  const safeTableType: TableType = isValidTableType(tableType) ? tableType : 'baggage'
  const safeLocale = locale === 'en' ? 'en' : 'is'

  try {
    const table = safeTableType === 'fast-track' ? getFastTrackTable() : getTable()
    const record = await table.find(recordId)

    // Read amount + currency. Baggage has Upphæð + Gengi; fast-track has
    // Upphæð and is always ISK (no Gengi field on that table).
    const amountField = record.fields['Upphæð']
    const amount = typeof amountField === 'number' ? amountField : Number(amountField)
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error('[api][rapyd][retry] invalid amount on record', recordId, amountField)
      return res.status(400).json({ message: 'Order has no valid amount to charge.' })
    }

    const currencyField = safeTableType === 'baggage' ? record.fields['Gengi'] : 'ISK'
    const currency = typeof currencyField === 'string' && currencyField ? currencyField : 'ISK'

    // If the order was already paid, bail out — no point creating another
    // checkout. Tell the client so it can route to the success page instead.
    const paidFieldName = safeTableType === 'baggage' ? 'Greitt' : 'Greiddi'
    const alreadyPaid = record.fields[paidFieldName] === true
    if (alreadyPaid) {
      return res.status(409).json({ message: 'Order is already paid', alreadyPaid: true })
    }

    // Build the same complete/error URLs as common/mapper.ts so success and
    // cancel pages behave identically on the retry round-trip.
    const host = req.headers.host || process.env.VERCEL_URL || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`

    const rapydPayload = {
      amount,
      currency,
      country: 'IS',
      language: 'EN',
      merchant_reference_id: 'bagbee',
      complete_payment_url: `${baseUrl}/${safeLocale}/payment/success?recordId=${recordId}`,
      error_payment_url: `${baseUrl}/${safeLocale}/payment/cancel?recordId=${recordId}&type=${safeTableType}`,
      metadata: {
        recordId,
        tableType: safeTableType,
      },
    }

    const rapydRes = await fetch(`${baseUrl}/api/rapyd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rapydPayload),
    })
    const rapydResult = await rapydRes.json()

    const redirectUrl = rapydResult?.body?.data?.redirect_url
    if (!redirectUrl) {
      console.error('[api][rapyd][retry] Rapyd did not return a redirect_url', rapydResult)
      return res.status(502).json({ message: 'Failed to create payment link' })
    }

    return res.status(200).json({ redirectUrl })
  } catch (error: any) {
    // Airtable's NOT_FOUND surfaces as a 404 from the SDK
    if (error?.statusCode === 404 || error?.error === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Order not found' })
    }
    console.error('[api][rapyd][retry] error', error)
    return res.status(500).json({ message: 'Failed to retry payment' })
  }
}
