import { NextApiRequest, NextApiResponse } from 'next'
import { PARTNERS, verifyPartner } from '../../../../utils/partnerAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const partner = verifyPartner(req)
  if (!partner) return res.status(401).json({ authenticated: false })
  return res.status(200).json({
    authenticated: true,
    partnerId: partner,
    displayName: PARTNERS[partner].displayName,
  })
}
