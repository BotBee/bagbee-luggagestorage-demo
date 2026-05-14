import { NextApiRequest, NextApiResponse } from 'next'
import { clearPartnerCookie } from '../../../../utils/partnerAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  clearPartnerCookie(res)
  return res.status(200).json({ ok: true })
}
