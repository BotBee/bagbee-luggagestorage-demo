import { NextApiRequest, NextApiResponse } from 'next'
import { isValidPhoneNumber, parsePhoneNumberWithError } from 'libphonenumber-js'
import { AirtableTransportOrder } from '../../../common/transportMapper'
import { getBase, getMinifiedItem, getTable } from '../../../utils/airtable'

// Server-side only. libphonenumber-js is fine to import normally here —
// Next.js API routes are never bundled into the client.

// Endpoint contract:
//   { order: AirtableTransportOrder, pickupZip?: string, deliveryZip?: string }
// We pass the structured zips alongside the order so the postal-code-cutoff
// check has accurate data — regex'ing zips out of the rendered Heimilisfang
// string is fragile when streets have 3-digit numbers in them.
type CreateRequestBody = {
  order: AirtableTransportOrder
  pickupZip?: string
  deliveryZip?: string
}

// Loose email check — production validation happens at Rapyd / SMTP time.
// This is just to catch obvious typos ("foo@" with no domain, missing @, etc).
const isPlausibleEmail = (s: unknown): s is string =>
  typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

// Phone validation uses libphonenumber-js. Iceland is the default region
// when the number doesn't include an international prefix. Returns true for
// e.g. "+354 578 5900", "5785900" (interpreted as IS), "+44 20 7946 0000".
const isPlausiblePhone = (s: unknown): boolean => {
  if (typeof s !== 'string' || !s.trim()) return false
  try {
    return isValidPhoneNumber(s.trim(), 'IS')
  } catch {
    return false
  }
}

// Normalise a phone number to E.164 format for downstream systems (Payday,
// SMS sender, dispatch dashboards) so we never store a mix of "+354 578 5900"
// and "578 5900" for the same customer.
const normalisePhone = (s: string): string => {
  try {
    return parsePhoneNumberWithError(s.trim(), 'IS').number
  } catch {
    return s.trim()
  }
}

// Read the Postal Code Cutoffs table directly with strict service semantics:
// treat an UNCHECKED Service checkbox as "not serviced". The shared
// getPostalCodeCutoffs() helper used by the check-in flow defaults the
// opposite way (unchecked → serviced) to support capacity-only gating for
// known-good postcodes that just haven't had route rules set up yet. For
// transport that's the wrong default — postcodes like 233 (Reykjanesbær
// rural) and 276 (Kjósarhreppur) have Service unchecked with a "Not
// serviced." note, and we should reject them.
const fetchUnservicedPostcodes = async (): Promise<Set<string>> => {
  const base = getBase()
  const records = await base('Postal Code Cutoffs').select().all()
  const unserviced = new Set<string>()
  for (const r of records) {
    const postal = r.fields['Postal code']
    if (typeof postal !== 'string') continue
    const service = r.fields['Service']
    // Service is a checkbox; Airtable returns `true` when checked, undefined
    // when not. We treat anything that isn't an explicit `true` as
    // not-serviced. Strict by design.
    if (service !== true) unserviced.add(postal.trim())
  }
  return unserviced
}

// Server-side validation for a transport booking. Mirrors the spirit of
// /api/airtable/create.ts (the check-in flow's create endpoint) but with the
// fields that matter for transport. The most important guard is the
// past-date check — the Apr 2026 partial-order incident proved
// `dayjs(undefined)` silently fills in today's date, which is the only
// deterministic signal of stale/missing booking state.
const validateTransportPayload = (item: AirtableTransportOrder): string[] => {
  const problems: string[] = []
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const parseYmd = (s: unknown): Date | null => {
    if (typeof s !== 'string') return null
    const m = /^(\d{4})[\/-](\d{2})[\/-](\d{2})$/.exec(s.trim())
    if (!m) return null
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    return isNaN(d.getTime()) ? null : d
  }

  if (!item?.['Nafn viðskiptavinar']?.trim()) problems.push('customer name is missing')
  if (!item?.Tölvupóstfang?.trim()) {
    problems.push('email is missing')
  } else if (!isPlausibleEmail(item.Tölvupóstfang)) {
    problems.push('email is not a valid format')
  }
  if (!item?.Símanúmer?.trim()) {
    problems.push('phone number is missing')
  } else if (!isPlausiblePhone(item.Símanúmer)) {
    problems.push('phone number is not a valid format')
  }

  if (typeof item?.Töskufjöldi_no !== 'number' || item.Töskufjöldi_no < 1) {
    problems.push('bag count is missing or invalid')
  }

  const pickupDate = parseYmd(item?.['Dagsetning pick-up'])
  const deliveryDate = parseYmd(item?.['Delivery date'])
  if (!pickupDate) problems.push('pickup date is missing or invalid')
  if (!deliveryDate) problems.push('delivery date is missing or invalid')
  if (pickupDate && pickupDate.getTime() < today.getTime()) {
    problems.push('pickup date is in the past')
  }
  if (deliveryDate && deliveryDate.getTime() < today.getTime()) {
    problems.push('delivery date is in the past')
  }
  if (pickupDate && deliveryDate && deliveryDate.getTime() < pickupDate.getTime()) {
    problems.push('delivery date is before pickup date')
  }

  if (!item?.Heimilisfang?.trim()) problems.push('pickup location is missing')
  if (!item?.['Delivery Address']?.trim()) problems.push('delivery location is missing')
  if (!item?.Tímasetning?.trim()) problems.push('pickup time is missing')
  if (!item?.['Delivery Time-window']?.trim()) problems.push('delivery time is missing')

  // Flight number is required when either leg touches KEF — the dispatcher
  // needs it to coordinate around delays. Detected by 'Airport code' being
  // 'KEF' (set by mapTransportToOrder when pickupLocation or deliveryLocation
  // is the airport).
  if (item?.['Airport code'] === 'KEF' && !item?.Flugnúmer?.trim()) {
    problems.push('flight number is required for KEF bookings')
  }

  if (typeof item?.Upphæð !== 'number' || item.Upphæð <= 0) {
    problems.push('amount is missing or invalid')
  }

  return problems
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  // Accept either the new envelope shape ({ order, pickupZip, deliveryZip })
  // or, for backwards-compat with any in-flight clients, an order at the
  // top level. The envelope shape gives us the structured zips for the
  // postcode-service check.
  const body = req.body as CreateRequestBody | AirtableTransportOrder
  const item: AirtableTransportOrder =
    'order' in body && body.order ? body.order : (body as AirtableTransportOrder)
  const pickupZip =
    'pickupZip' in body ? (body.pickupZip || '').trim() : ''
  const deliveryZip =
    'deliveryZip' in body ? (body.deliveryZip || '').trim() : ''
  try {
    const problems = validateTransportPayload(item)
    if (problems.length > 0) {
      console.warn('[api][transport][create] rejecting payload', problems, {
        name: item?.['Nafn viðskiptavinar'],
        email: item?.Tölvupóstfang,
        pickupDate: item?.['Dagsetning pick-up'],
        deliveryDate: item?.['Delivery date'],
      })
      return res.status(400).json({
        message: `Booking is missing required fields: ${problems.join('; ')}`,
        problems,
      })
    }

    // Postal-code service check. The Postal Code Cutoffs table flags
    // postcodes BagBee won't run to (Reykjanesbær rural, Kjósarhreppur, etc).
    // Reject if either leg's zip is on the no-service list. We only apply
    // the *service* flag here — the slot-time cutoffs in that table are
    // tuned for the check-in evening route and don't apply to transport.
    const zips = [
      { label: 'Pickup', zip: pickupZip },
      { label: 'Delivery', zip: deliveryZip },
    ].filter((z) => /^\d{3}$/.test(z.zip))
    if (zips.length > 0) {
      const unserviced = await fetchUnservicedPostcodes()
      for (const { label, zip } of zips) {
        if (unserviced.has(zip)) {
          console.warn(
            '[api][transport][create] rejecting unserviced postcode',
            label,
            zip,
          )
          return res.status(400).json({
            message: `${label} postal code ${zip} is not serviced. Email bagbee@bagbee.is and we'll see what we can arrange.`,
            problems: ['postcode-not-serviced'],
          })
        }
      }
    }

    // Normalise the phone to E.164 before writing — downstream tools
    // (Payday, SMS, dispatch dashboards) all assume the same format.
    const fields: AirtableTransportOrder = {
      ...item,
      Símanúmer: normalisePhone(item.Símanúmer),
    }

    const table = getTable()
    // typecast=true tells Airtable to auto-create new options for select
    // fields rather than rejecting unknown values. Needed because our
    // computed pickup windows (e.g. '06:30 - 09:30' from a 3-hour landing
    // window) won't be pre-registered options in the Tímasetning /
    // Delivery Time-window single-selects. If the API token's permissions
    // forbid auto-create, this still gracefully degrades — Airtable will
    // return the original 422 and we surface it as a 500 (see catch).
    const newRecord = await table.create([{ fields: fields as any }], {
      typecast: true,
    })
    return res.status(200).json(getMinifiedItem(newRecord[0]))
  } catch (error) {
    console.error('[api][transport][create] failed', error)
    return res.status(500).json({ message: 'Failed to create transport booking' })
  }
}
