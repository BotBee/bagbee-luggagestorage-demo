import toast from 'react-hot-toast'
import en from '../common/locales/en'
import is from '../common/locales/is'
import type { Customer } from '../common/types'
import { validateDiscountCode } from '../modules/AirTable/api'
import { useBookingStore } from '../store/store'

type QueryLike = Record<string, string | string[] | undefined>

function queryParam(query: QueryLike, key: string): string | undefined {
  const v = query[key]
  if (v === undefined) return undefined
  return Array.isArray(v) ? v[0] : v
}

function readDecodedParam(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  try {
    return decodeURIComponent(raw).trim() || undefined
  } catch {
    return raw.trim() || undefined
  }
}

function normalizePhoneForForm(phone: string): string {
  return phone.replace(/\s/g, '').replace(/^\++/, '')
}

/** Sync: name, email, phone, pickup location from URL (see pick-up page). */
function mergeContactAndPickupFromQuery(query: QueryLike): void {
  const name = readDecodedParam(queryParam(query, 'name') ?? queryParam(query, 'customer_name'))
  const email = readDecodedParam(queryParam(query, 'email'))
  const phoneRaw = readDecodedParam(queryParam(query, 'phone'))
  const address = readDecodedParam(queryParam(query, 'address'))

  const phoneNumber = phoneRaw !== undefined ? normalizePhoneForForm(phoneRaw) : undefined

  if (name === undefined && email === undefined && phoneNumber === undefined && address === undefined) {
    return
  }

  const { booking, updateCustomer, updatePickupLocation } = useBookingStore.getState()
  const ci = booking.customerInfo

  const next: Customer = {
    ...ci,
    ...(name !== undefined ? { name } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(phoneNumber !== undefined && phoneNumber !== '' ? { phoneNumber } : {}),
  }

  updateCustomer(next)

  if (address !== undefined) {
    updatePickupLocation(address, '')
  }
}

/** Async: validates `discount_code` and merges into customerInfo (same as confirm-order). */
async function applyDiscountCodeFromQuery(query: QueryLike, locale: string | undefined): Promise<void> {
  const raw = readDecodedParam(queryParam(query, 'discount_code'))
  if (!raw) return

  const t = locale === 'en' ? en : is

  try {
    const result = await validateDiscountCode(raw)
    const { booking, updateCustomer } = useBookingStore.getState()
    if (!result.valid) {
      toast.error(t.confirmOrderStep.discount.discountCodeInvalid)
      return
    }
    updateCustomer({
      ...booking.customerInfo,
      discountCode: {
        code: result.code || '',
        discount: result.discount || 0,
      },
    })
  } catch {
    toast.error(t.confirmOrderStep.discount.errorValidatingDiscountCode)
  }
}

/**
 * Everything the pick-up page applies from URL search params: contact + pickup location, then discount.
 */
export async function applyPickupDeepLinkQuery(
  query: QueryLike,
  locale: string | undefined,
): Promise<void> {
  mergeContactAndPickupFromQuery(query)
  await applyDiscountCodeFromQuery(query, locale)
}
