import { NextApiRequest, NextApiResponse } from 'next'
import { AirtableOrder } from '../../../common/types'
import {
  getMinifiedItem,
  getPostalCodeCutoffs,
  getTable,
  parseSlotStartHour,
} from '../../../utils/airtable'
import { lookupDiscountCode } from '../../../utils/discountCodes'

// The exact field set a booking client legitimately sends — the keys of
// mapToOrder's output (common/mapper.ts) / the AirtableOrder type. The raw
// body was previously written to Airtable verbatim, which let a tampered
// request set any field on the Orders table.
const ORDER_FIELDS = [
  'Nafn viðskiptavinar',
  'Flugfélag',
  'Dagsetning flugs',
  'Dagsetning pick-up',
  'Málstaðall',
  'Símanúmer',
  'Flugnúmer',
  'Airport code',
  'Tímasetning',
  'Heimilisfang',
  'Delivery Address',
  'Annað (comment)',
  'Hótel Nafn',
  'Tölvupóstfang',
  'Töskufjöldi_no',
  'Töskufjöldi_no_yfirstærð',
  'Áfangastaður',
  'Kennitala',
  'Greitt',
  'Greiðslustaða',
  'Upphæð',
  'Gengi',
  'Tilvísun',
  'Discount Code',
] as const

// Iceland postcodes are exactly 3 digits. We extract the first 3-digit token
// from the formatted address (Heimilisfang) which Google Places returns in
// the form "<street> <number>, <postcode> <city>, <country>". This is a
// safety net for stale client state / dev-tools edits — the client also
// stores the postal code from Places `addressComponents` and we'd ideally
// trust that, but the AirtableOrder shape doesn't carry it through.
const extractIcelandicPostcode = (address: string | undefined | null): string | null => {
  if (typeof address !== 'string') return null
  const match = /\b(\d{3})\b/.exec(address)
  return match ? match[1] : null
}

// Narrow server-side guard. The strict required-field checks were rolled back
// on 2026-04-30 after they flagged legitimate bookings (root cause still under
// investigation — most likely a code path where the Airtable payload is built
// from booking-state shapes the validator didn't anticipate). What's kept:
// the date-sanity check, which is the single most important safeguard against
// the Apr 29 partial-order incident — that order ended up with `Dagsetning
// flugs = today` because dayjs(undefined)/`new Date()` silently fell back to
// today's date. Past-date is the only deterministic signal of that class of
// bug, and rejecting on it doesn't false-positive on real bookings.
const validateOrderPayload = (item: AirtableOrder): string[] => {
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
  const flightDate = parseYmd(item?.['Dagsetning flugs'] as unknown)
  const pickupDate = parseYmd(item?.['Dagsetning pick-up'] as unknown)
  // `<` today (not `<=`) — same-day pickup is a legitimate scenario:
  // customer books at 8am for an evening flight, gets picked up later
  // today. The previous `<= today` rejection was added 2026-04-30 to
  // catch the dayjs(undefined) → today bug, but it also rejected real
  // bookings whose `dayBeforeDeparture` happened to be today (flight
  // tomorrow, pick up today). Reproduced 2026-05-04 — customer with
  // a May 8 flight tried to submit on May 7 and was blocked here.
  // Past dates (sentinel 1970, etc.) are still rejected. The advisory
  // validateBookingForOrder logger remains as the soft signal for any
  // remaining dayjs(undefined) regressions.
  if (flightDate && flightDate.getTime() < today.getTime()) {
    problems.push('flight date is in the past')
  }
  if (pickupDate && pickupDate.getTime() < today.getTime()) {
    problems.push('pickup date is in the past')
  }
  return problems
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Copy only allowlisted fields — never write the raw body to Airtable.
  const raw = (req.body ?? {}) as Record<string, unknown>
  const picked: Record<string, unknown> = {}
  for (const key of ORDER_FIELDS) {
    if (raw[key] !== undefined) picked[key] = raw[key]
  }
  const item = picked as unknown as AirtableOrder

  try {
    const payloadProblems = validateOrderPayload(item)
    if (payloadProblems.length > 0) {
      console.warn(
        '[api][create] rejecting payload with missing/invalid fields',
        payloadProblems,
        {
          name: item?.['Nafn viðskiptavinar'],
          email: item?.Tölvupóstfang,
          flightDate: item?.['Dagsetning flugs'],
          pickupDate: item?.['Dagsetning pick-up'],
        },
      )
      return res.status(400).json({
        message: `Order is missing required fields: ${payloadProblems.join('; ')}`,
        problems: payloadProblems,
      })
    }

    // Server-side postal-code validation: catches stale state, URL tampering
    // and dev-tools edits. Empty/unknown postcode falls back to the legacy
    // capacity-only behaviour (the availability API enforced that already).
    const postalCode = extractIcelandicPostcode(item?.Heimilisfang)
    const slotLabel = item?.Tímasetning
    if (postalCode && typeof slotLabel === 'string' && slotLabel.trim() !== '') {
      const rules = await getPostalCodeCutoffs()
      const rule = rules[postalCode]
      if (rule) {
        if (rule.service === false) {
          console.warn(
            '[api][create] rejecting unserviced postcode',
            postalCode,
            slotLabel,
          )
          return res.status(400).json({
            message: `Postal code ${postalCode} is not currently serviced for pickup.`,
          })
        }
        // Two parallel rule-sets: evening route uses earliestSlotStartHour
        // / latestSlotStartHour; morning route uses the morning equivalents.
        // Each route has its own "any-time" full-window slot that's exempt
        // from earliest/latest (driver can swing by anytime in the window).
        const ANY_TIME_EVENING_SLOT = '19:00 - 22:00'
        const ANY_TIME_MORNING_SLOT = '09:00 - 12:00'
        const slotIsAnyTimeEvening = slotLabel.trim() === ANY_TIME_EVENING_SLOT
        const slotIsAnyTimeMorning = slotLabel.trim() === ANY_TIME_MORNING_SLOT
        const slotStart = parseSlotStartHour(slotLabel)
        // Heuristic split: < 14h start = morning route, >= 14h = evening
        // route. Matches the slot definitions in availability.ts (08:00,
        // 09:00, 10:00, 11:00 vs 17:00–22:00). Rejects the morning slot
        // class when its postcode-specific earliest/latest fail.
        const slotIsMorning = slotStart != null && slotStart < 14
        const earliest = slotIsMorning
          ? rule.earliestMorningSlotStartHour
          : rule.earliestSlotStartHour
        const latest = slotIsMorning
          ? rule.latestMorningSlotStartHour
          : rule.latestSlotStartHour
        const slotIsAnyTime = slotIsMorning
          ? slotIsAnyTimeMorning
          : slotIsAnyTimeEvening
        if (!slotIsAnyTime && slotStart != null) {
          if (earliest != null && slotStart < earliest) {
            console.warn(
              '[api][create] rejecting slot before postcode earliest',
              postalCode,
              slotLabel,
              earliest,
            )
            return res.status(400).json({
              message: `Slot ${slotLabel} is not available for postal code ${postalCode}.`,
            })
          }
          if (latest != null && slotStart > latest) {
            console.warn(
              '[api][create] rejecting slot past postcode cutoff',
              postalCode,
              slotLabel,
              latest,
            )
            return res.status(400).json({
              message: `Slot ${slotLabel} is not available for postal code ${postalCode}.`,
            })
          }
        }
      }
    }

    // A booking may legitimately arrive pre-paid ONLY via a 100% gift-card
    // discount (mapper.ts sets Greitt from is100PercentDiscount and skips
    // the Rapyd checkout). Verify that claim server-side — otherwise anyone
    // could POST Greitt: true and create a free "paid" order.
    if (item.Greitt === true || item['Greiðslustaða'] === 'Greitt') {
      const code =
        typeof item['Discount Code'] === 'string' ? item['Discount Code'] : ''
      const lookup = code
        ? await lookupDiscountCode('Afslattarkodar', code).catch(() => null)
        : null
      if (!lookup?.valid || lookup.discount !== 100) {
        console.warn(
          '[api][create] rejecting prepaid claim without a valid 100% discount code',
          { code }
        )
        return res.status(400).json({
          message: 'Order claims to be prepaid without a valid 100% discount code.',
        })
      }
    }

    const table = getTable()
    const newRecord = await table.create([{ fields: item }])
    res.status(200).json(getMinifiedItem(newRecord[0]))
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to create order' })
  }
}
