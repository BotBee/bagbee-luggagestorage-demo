import { NextApiRequest, NextApiResponse } from 'next'
import { PARTNERS, verifySession } from '../../../../utils/partnerAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = verifySession(req)
  if (!session) return res.status(401).json({ authenticated: false })
  return res.status(200).json({
    authenticated: true,
    partnerId: session.partnerId,
    email: session.email,
    displayName: PARTNERS[session.partnerId].displayName,
  })
}
