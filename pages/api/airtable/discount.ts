import { NextApiRequest, NextApiResponse } from 'next'
import { lookupDiscountCode } from '../../../utils/discountCodes'

export interface DiscountCodeResponse {
  valid: boolean
  discount?: number
  code?: string
  error?: string
}

/**
 * Validates a discount code (exists + not expired) against the
 * Afslattarkodar table. Lookup + injection guard live in
 * utils/discountCodes.ts.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DiscountCodeResponse>
) {
  if (req.method !== 'POST') {
    res.status(405).json({ valid: false, error: 'Method not allowed' })
    return
  }

  const { code } = req.body

  if (!code || typeof code !== 'string') {
    res.status(400).json({ valid: false, error: 'Discount code is required' })
    return
  }

  try {
    res.status(200).json(await lookupDiscountCode('Afslattarkodar', code))
  } catch (error) {
    console.error('Error validating discount code:', error)
    res.status(500).json({ valid: false, error: 'Error validating discount code' })
  }
}
