import { NextApiRequest, NextApiResponse } from 'next'
import { clearPartnerCookie, isPartnerId } from '../../../../utils/partnerAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  if (!isPartnerId(req.query.partnerId)) {
    return res.status(404).json({ message: 'Unknown partner' })
  }
  // Cookie clear is universal (only one bb_partner cookie per browser),
  // so we don't need partnerId beyond the URL validation.
  clearPartnerCookie(res)
  return res.status(200).json({ ok: true })
}
