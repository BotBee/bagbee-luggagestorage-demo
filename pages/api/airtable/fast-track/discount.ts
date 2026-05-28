import { NextApiRequest, NextApiResponse } from 'next'
import { getBase } from '../../../../utils/airtable'

export interface DiscountCodeResponse {
  valid: boolean
  discount?: number
  code?: string
  error?: string
}

/**
 * This handler validates a discount code against our Airtable instance.
 * It checks if the code exists and whether it has expired.
 *
 * @param req The request object containing { code: string }
 * @param res Response with discount validation result
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
    const base = getBase()

    const records = await base('Afslattarkodar Fast Track')
      .select({
        filterByFormula: `{Gjafakodi} = "${code}"`,
      })
      .firstPage()

    if (!records || records.length === 0) {
      res.status(200).json({ valid: false, error: 'Discount code not found' })
      return
    }

    const foundRecord = records[0]

    if (!foundRecord.fields) {
      res.status(200).json({ valid: false, error: 'Invalid discount code record' })
      return
    }

    const expiryDate = new Date(foundRecord.fields['Expire date'] as string)
    const today = new Date()

    if (expiryDate < today) {
      res.status(200).json({ valid: false, error: 'Discount code has expired' })
      return
    }

    // Successfully found an active discount code
    res.status(200).json({
      valid: true,
      code: foundRecord.fields['Gjafakodi'] as string,
      discount: foundRecord.fields['Discount'] as number,
    })
  } catch (error) {
    console.error('Error validating discount code:', error)
    res.status(500).json({ valid: false, error: 'Error validating discount code' })
  }
}

