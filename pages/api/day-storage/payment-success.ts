import { NextApiRequest, NextApiResponse } from 'next'
import Airtable, { FieldSet, Table } from 'airtable'
import { getTable } from '../../../utils/airtable'
import getAppConfig from '../../../modules/config'
import { notifyConfirmationEmail } from '../../../utils/notifyConfirmation'
import {
  verifyRedirectParams,
  DAY_STORAGE_SIGNED_FIELDS,
} from '../../../utils/paymentRedirectSig'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'

const getStorageTable = (): Table<FieldSet> => {
  const {
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
  } = getAppConfig()
  Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
  return Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)
}

/**
 * Rapyd redirect target after a successful day-storage payment. Optimistically
 * marks BOTH records paid so the order page shows success immediately even if
 * the PAYMENT_COMPLETED webhook is delayed; the webhook
 * (pages/api/payment/webhooks) is the canonical write and also stores the
 * Rapyd Payment ID + fires the Payday invoice for the dispatch order.
 *
 * Signature requirement: the callback URL is built by /api/day-storage/create,
 * which HMAC-signs orderNo + both record IDs. Without a matching `sig` and
 * unexpired `exp` we refuse — otherwise anyone could mark both records paid
 * (and fire the confirmation email) without paying.
 * See utils/paymentRedirectSig.ts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { orderNo, orderRecordId, storageRecordId, exp, sig } =
    req.query as Record<string, string>

  if (!orderNo || !/^[a-zA-Z0-9]+$/.test(orderNo)) {
    return res.redirect(`/orders?error=true`)
  }

  const verdict = verifyRedirectParams(
    'day-storage',
    DAY_STORAGE_SIGNED_FIELDS,
    { orderNo, orderRecordId, storageRecordId },
    exp,
    sig
  )
  if (!verdict.ok) {
    console.warn('[day-storage] rejected payment-success callback', {
      orderNo,
      reason: verdict.reason,
    })
    return res.redirect(`/orders/${orderNo}?day_storage_error=true`)
  }

  try {
    if (orderRecordId && /^rec[a-zA-Z0-9]+$/.test(orderRecordId)) {
      await getTable()
        .update(orderRecordId, { Greiðslustaða: 'Greitt', Greitt: true } as FieldSet)
        .catch((e) => console.error('[day-storage] order mark-paid failed', e))
    }
    if (storageRecordId && /^rec[a-zA-Z0-9]+$/.test(storageRecordId)) {
      await getStorageTable()
        .update(storageRecordId, { 'Payment Status': 'Paid', 'Paid?': true } as FieldSet)
        .catch((e) => console.error('[day-storage] storage mark-paid failed', e))
      // Instantly trigger the Make confirmation-email scenario (Paid? set above
      // so its trigger filter matches even on this redirect-fallback path).
      await notifyConfirmationEmail(storageRecordId)
    }
    return res.redirect(`/orders/${orderNo}?day_storage_paid=true`)
  } catch (error) {
    console.error('[day-storage] payment-success error:', error)
    return res.redirect(`/orders/${orderNo}?day_storage_error=true`)
  }
}
