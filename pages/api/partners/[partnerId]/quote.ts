import { NextApiRequest, NextApiResponse } from 'next'
import { PartnerId, isPartnerId, requirePartner } from '../../../../utils/partnerAuth'
import { computeOrderPrice, PricelistCustomer } from '../../../../utils/partnerPricing'

// Maps the URL slug to the customer name used in the Airtable Pricelist
// table. The mapping stays here because the pricelist's Customer column
// is a human-readable display name ("Iceland Travel"), not the URL slug.
const PRICELIST_CUSTOMER: Record<PartnerId, PricelistCustomer> = {
  'iceland-travel': 'Iceland Travel',
  atlantik: 'Atlantik',
}

// Live price preview for the new-order form (and the order detail page).
// The portal calls this as the project manager fills in service/bags/time
// — gets back either a calculated total + breakdown, or a "we'll quote"
// message that the UI surfaces inline.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const partnerSlug = req.query.partnerId
  if (!isPartnerId(partnerSlug)) {
    return res.status(404).json({ message: 'Unknown partner' })
  }
  const partnerId = partnerSlug
  if (!requirePartner(req, res, partnerId)) return
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  const {
    serviceType,
    bagsRegular,
    bagsOdd,
    timeWindow,
    pickupAddress,
    deliveryAddress,
  } = req.query
  const input = {
    customer: PRICELIST_CUSTOMER[partnerId],
    serviceType: typeof serviceType === 'string' ? serviceType : null,
    bagsRegular:
      typeof bagsRegular === 'string' ? Math.max(0, Number(bagsRegular) || 0) : 0,
    bagsOdd:
      typeof bagsOdd === 'string' ? Math.max(0, Number(bagsOdd) || 0) : 0,
    timeWindow: typeof timeWindow === 'string' ? timeWindow : null,
    pickupAddress: typeof pickupAddress === 'string' ? pickupAddress : null,
    deliveryAddress: typeof deliveryAddress === 'string' ? deliveryAddress : null,
  }
  try {
    const quote = await computeOrderPrice(input)
    // No HTTP caching — the live-preview UI depends on every keystroke
    // round-tripping fresh. The 30-min in-memory pricelist cache inside
    // computeOrderPrice already absorbs the load against Airtable, so
    // there's no reason to also cache at the HTTP layer (and risk a
    // stale response sticking around if the user edits an input twice).
    res.setHeader('Cache-Control', 'no-store, max-age=0')
    return res.status(200).json({ quote })
  } catch (err) {
    console.error('[partner quote] failed', err)
    return res.status(500).json({ message: 'Could not compute price' })
  }
}
