import { getBase } from './airtable'

export interface DiscountLookupResult {
  valid: boolean
  discount?: number
  code?: string
  error?: string
}

export type DiscountTable = 'Afslattarkodar' | 'Afslattarkodar Fast Track'

// Gift/discount codes are short human-issued tokens: letters (any script),
// digits, spaces, dashes, underscores. The allowlist doubles as the
// filterByFormula injection guard — without it a "code" like `x" OR TRUE
// OR "` breaks out of the quoted literal below and matches the first row
// of the table, handing out a discount the caller never owned.
const CODE_RE = /^[\p{L}\p{N} _-]{1,64}$/u

export const isWellFormedDiscountCode = (code: unknown): code is string =>
  typeof code === 'string' && CODE_RE.test(code.trim())

/**
 * Validates a discount code against Airtable: exists + not expired.
 * Shared by the two public /discount endpoints and by the order-create
 * handlers, which use it to verify a "prepaid via 100% gift card" claim
 * server-side.
 */
export async function lookupDiscountCode(
  table: DiscountTable,
  rawCode: string
): Promise<DiscountLookupResult> {
  if (!isWellFormedDiscountCode(rawCode)) {
    return { valid: false, error: 'Discount code not found' }
  }
  const code = rawCode.trim()

  const base = getBase()
  const records = await base(table)
    .select({
      filterByFormula: `{Gjafakodi} = "${code}"`,
      maxRecords: 1,
    })
    .firstPage()

  if (!records || records.length === 0) {
    return { valid: false, error: 'Discount code not found' }
  }

  const found = records[0]
  if (!found.fields) {
    return { valid: false, error: 'Invalid discount code record' }
  }

  const expiryDate = new Date(found.fields['Expire date'] as string)
  if (expiryDate < new Date()) {
    return { valid: false, error: 'Discount code has expired' }
  }

  return {
    valid: true,
    code: found.fields['Gjafakodi'] as string,
    discount: found.fields['Discount'] as number,
  }
}
