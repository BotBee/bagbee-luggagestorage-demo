import { NextApiRequest, NextApiResponse } from 'next'
import { checkPartnerPassword, setPartnerCookie } from '../../../../utils/partnerAuth'

const PARTNER_ID = 'iceland-travel' as const

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  const { password } = (req.body as { password?: string }) || {}
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ message: 'Password required' })
  }
  let ok = false
  try {
    ok = checkPartnerPassword(PARTNER_ID, password)
  } catch (err) {
    console.error('[partner login] config error', err)
    return res
      .status(500)
      .json({ message: 'Login is not configured on the server. Contact BagBee.' })
  }
  if (!ok) {
    // Light, non-leaky failure — same 401 for wrong password or wrong partner.
    return res.status(401).json({ message: 'Invalid password' })
  }
  setPartnerCookie(res, PARTNER_ID)
  return res.status(200).json({ ok: true })
}
