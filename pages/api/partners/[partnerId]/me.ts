import { NextApiRequest, NextApiResponse } from 'next'
import { PARTNERS, isPartnerId, verifySession } from '../../../../utils/partnerAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const partnerSlug = req.query.partnerId
  if (!isPartnerId(partnerSlug)) {
    return res.status(404).json({ message: 'Unknown partner' })
  }
  const session = verifySession(req)
  // Session must be for THIS partner — having a cookie for partner A
  // doesn't authenticate you on partner B's /me endpoint.
  if (!session || session.partnerId !== partnerSlug) {
    return res.status(401).json({ authenticated: false })
  }
  return res.status(200).json({
    authenticated: true,
    partnerId: session.partnerId,
    email: session.email,
    displayName: PARTNERS[session.partnerId].displayName,
  })
}
