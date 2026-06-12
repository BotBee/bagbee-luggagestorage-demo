import { NextApiRequest, NextApiResponse } from 'next'
import { getOrdersLookupTable } from '../../../utils/airtable'
import {
  verifyRedirectParams,
  TIP_SIGNED_FIELDS,
} from '../../../utils/paymentRedirectSig'

/**
 * Called by Rapyd after a successful tip payment.
 * Adds the tip amount to the order's Tip Amount field (summing with any prior tip)
 * and redirects the customer back to the order page with a success banner.
 *
 * Signature requirement: the callback URL is built by /api/tip/create,
 * which HMAC-signs orderNo + amount + recordId. Without a matching `sig`
 * and unexpired `exp` we refuse — otherwise anyone could write arbitrary
 * tip amounts to any order without paying. See utils/paymentRedirectSig.ts.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { orderNo, amount, recordId, exp, sig } = req.query as Record<
    string,
    string
  >

  if (!orderNo) {
    return res.redirect(`/orders?error=true`)
  }
  if (!/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.redirect(`/orders/${orderNo}?tip_error=true`)
  }

  const verdict = verifyRedirectParams(
    'tip',
    TIP_SIGNED_FIELDS,
    { orderNo, amount, recordId },
    exp,
    sig
  )
  if (!verdict.ok) {
    console.warn('[tip] rejected payment-success callback', {
      orderNo,
      reason: verdict.reason,
    })
    return res.redirect(`/orders/${orderNo}?tip_error=true`)
  }

  const tipAmount = Number(amount)
  if (!Number.isFinite(tipAmount) || tipAmount <= 0) {
    return res.redirect(`/orders/${orderNo}?tip_error=true`)
  }

  try {
    const table = getOrdersLookupTable()

    // Prefer the record ID passed from create.ts so we don't need to re-query
    let targetId = recordId
    let existingTip = 0

    if (targetId) {
      try {
        const rec = await table.find(targetId)
        existingTip = Number(rec.fields['Tip Amount'] || 0)
      } catch {
        targetId = ''
      }
    }

    if (!targetId) {
      const records = await table
        .select({
          filterByFormula: `{Pöntunarnúmer (fx)} = '${orderNo}'`,
          maxRecords: 1,
        })
        .firstPage()
      if (records.length === 0) {
        return res.redirect(`/orders/${orderNo}?tip_error=true`)
      }
      targetId = records[0].id
      existingTip = Number(records[0].fields['Tip Amount'] || 0)
    }

    await table.update(targetId, {
      'Tip Amount': existingTip + Math.round(tipAmount),
    })

    res.redirect(`/orders/${orderNo}?tip_paid=true`)
  } catch (error) {
    console.error('Tip payment-success error:', error)
    res.redirect(`/orders/${orderNo}?tip_error=true`)
  }
}
