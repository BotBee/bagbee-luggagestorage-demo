import getAppConfig from '../config'

const API_VERSION = 'alpha'

type Customer = {
  id: string
  ssn?: string
  name?: string
  email?: string
}

type CachedToken = { token: string; expiresAt: number }
let cachedToken: CachedToken | null = null

const cfg = () => {
  const { serverRuntimeConfig } = getAppConfig()
  const { paydayBaseUrl, paydayClientId, paydayClientSecret } = serverRuntimeConfig
  if (!paydayBaseUrl || !paydayClientId || !paydayClientSecret) {
    throw new Error(
      'Payday not configured: set PAYDAY_BASE_URL, PAYDAY_CLIENT_ID, PAYDAY_CLIENT_SECRET'
    )
  }
  return { paydayBaseUrl, paydayClientId, paydayClientSecret }
}

const headers = (token?: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  'Api-Version': API_VERSION,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

const getToken = async (): Promise<string> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token
  }
  const { paydayBaseUrl, paydayClientId, paydayClientSecret } = cfg()
  const res = await fetch(`${paydayBaseUrl}/auth/token`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ clientId: paydayClientId, clientSecret: paydayClientSecret }),
  })
  if (!res.ok) {
    throw new Error(`Payday auth failed: ${res.status} ${await res.text()}`)
  }
  const body = (await res.json()) as Record<string, unknown>
  // Payday returns `accessToken`; older docs sometimes say `token`/`access_token` — accept all.
  const token = (body.accessToken ?? body.token ?? body.access_token) as
    | string
    | undefined
  if (!token) {
    throw new Error('Payday auth response missing token (no accessToken/token field)')
  }
  const ttlSec = (body.expiresIn ?? body.expires_in ?? 3600) as number
  cachedToken = { token, expiresAt: Date.now() + ttlSec * 1000 }
  return token
}

const normalizeSsn = (s: string) => s.replace(/\D/g, '')

const findCustomerBySsn = async (ssn: string): Promise<Customer | null> => {
  const token = await getToken()
  const { paydayBaseUrl } = cfg()
  const res = await fetch(
    `${paydayBaseUrl}/customers/search/?query=${encodeURIComponent(ssn)}`,
    { headers: headers(token) }
  )
  if (!res.ok) {
    throw new Error(`Payday customer search failed: ${res.status} ${await res.text()}`)
  }
  const body = (await res.json()) as unknown
  const list = extractList<Customer>(body)
  const target = normalizeSsn(ssn)
  return list.find((c) => normalizeSsn(c.ssn ?? '') === target) ?? null
}

const extractList = <T>(body: unknown): T[] => {
  if (Array.isArray(body)) return body as T[]
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>
    for (const key of ['data', 'customers', 'items', 'results']) {
      if (Array.isArray(o[key])) return o[key] as T[]
    }
  }
  return []
}

const createCustomer = async (input: {
  ssn: string
  name: string
  email: string
}): Promise<Customer> => {
  const token = await getToken()
  const { paydayBaseUrl } = cfg()
  // We deliberately do not pass `address` here. The booking captures the bag
  // pickup address, which is not the billing address. Payday will leave the
  // address field empty (or fill from its own data) — that's preferable to us
  // writing the pickup address as the customer's billing address.
  const res = await fetch(`${paydayBaseUrl}/customers`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      ssn: input.ssn,
      name: input.name,
      email: input.email,
      language: 'is',
      // Mirrors the customer's national e-invoice registry preference; setting
      // `true` for a kennitala that hasn't opted in is rejected with errorCode 21018.
      // We rely on `sendEmail: true` on the invoice itself for delivery.
      sendElectronicInvoices: false,
      finalDueDateDefaultDaysAfter: 14,
    }),
  })
  if (!res.ok) {
    throw new Error(`Payday customer create failed: ${res.status} ${await res.text()}`)
  }
  const body = (await res.json()) as Record<string, unknown>
  const created = (body.data ?? body) as Customer

  // Payday auto-resolves the customer name from Þjóðskrá at create time and
  // overwrites whatever we sent. We want the name we submitted to win, so we
  // immediately PUT it back. PUT is authoritative — it does not re-trigger
  // the Þjóðskrá lookup. (Verified manually before shipping.)
  if (created.id && (created.name ?? '') !== input.name) {
    const putRes = await fetch(`${paydayBaseUrl}/customers/${created.id}`, {
      method: 'PUT',
      headers: headers(token),
      body: JSON.stringify({ name: input.name }),
    })
    if (putRes.ok) {
      const putBody = (await putRes.json()) as Record<string, unknown>
      return (putBody.data ?? putBody) as Customer
    }
    // Soft-fail: we still have a usable customer record, just with the
    // Þjóðskrá-resolved name. Log and continue so the invoice still goes out.
    console.warn(
      `[payday] could not override Þjóðskrá name for customer ${created.id}: ` +
        `${putRes.status} ${await putRes.text()}`
    )
  }
  return created
}

export const findOrCreateCustomer = async (input: {
  ssn: string
  name: string
  email: string
}): Promise<Customer> => {
  // If a customer already exists for this kennitala, return it as-is. We
  // intentionally do NOT update name/email/address: Payday holds the canonical
  // record (name from Þjóðskrá; email + address as previously set), and the
  // booking flow's values reflect *this* booker, not the bill-to entity.
  const found = await findCustomerBySsn(input.ssn)
  if (found) return found
  return createCustomer(input)
}

const formatDate = (d: Date) => d.toISOString().slice(0, 10)

export const sendInvoice = async (input: {
  customerId: string
  description: string
  quantity: number
  grossUnitPriceIsk: number
  vatPercentage?: number
  comment?: string
}): Promise<{ id: string }> => {
  const token = await getToken()
  const { paydayBaseUrl } = cfg()
  const vat = input.vatPercentage ?? 24
  const unitPriceExcludingVat = Math.round(input.grossUnitPriceIsk / (1 + vat / 100))
  const today = new Date()
  const due = new Date(today.getTime() + 7 * 86_400_000)
  const finalDue = new Date(today.getTime() + 14 * 86_400_000)
  const res = await fetch(`${paydayBaseUrl}/invoices`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      customer: { id: input.customerId },
      invoiceDate: formatDate(today),
      dueDate: formatDate(due),
      finalDueDate: formatDate(finalDue),
      currencyCode: 'ISK',
      createClaim: false,
      sendEmail: true,
      lines: [
        {
          description: input.description,
          quantity: input.quantity,
          unitPriceExcludingVat,
          vatPercentage: vat,
          discountPercentage: 0,
          ...(input.comment ? { comment: input.comment } : {}),
        },
      ],
    }),
  })
  if (!res.ok) {
    throw new Error(`Payday invoice create failed: ${res.status} ${await res.text()}`)
  }
  const body = (await res.json()) as Record<string, unknown>
  const invoice = (body.data ?? body) as { id: string }
  return { id: invoice.id }
}
