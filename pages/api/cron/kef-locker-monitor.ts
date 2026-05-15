/**
 * KEF locker-empty monitor — Vercel cron route.
 *
 * Runs every 30 minutes. For each shift defined in `KEF Locker Operations
 * Rules`, when the shift's pickup time + alarm offset has just passed (and
 * we haven't already alerted for this shift+date), audit it:
 *
 *   1. Count BagBee Transport bookings that selected KEF locker pickup
 *      mode for this date with landing time inside the shift's window.
 *      These are the bags BagBee crew should have collected when they
 *      arrived at the shift's pickup time.
 *   2. Count `Access Events` rows with Event type = door_unlocked whose
 *      Occurred at is between the shift's pickup time and pickup time +
 *      alarm offset. These are the actual physical unlock events recorded
 *      by RemoteLock / TTLock for any locker.
 *   3. If unlocks < bookings, write a row to `Locker Alarms` with the
 *      delta. A Zap (or Make scenario) watching that table emails the
 *      Alarm email from the rule row.
 *
 * The monitor is idempotent — `findExistingAlarm(shiftDate, shiftName)`
 * guards against duplicate alarms when the cron ticks again before the
 * operator marks the row Resolved.
 *
 * Protected by CRON_SECRET (matches /api/lockers/sync).
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getOrdersLookupTable } from '../../../utils/airtable'
import {
  appendLockerAlarm,
  countDoorUnlocksInWindow,
  findExistingAlarm,
} from '../../../utils/kefLockersAirtable'
import { loadActiveShifts, shiftPickupIso, TransportShift } from '../../../utils/transportLockerShifts'

export const config = {
  maxDuration: 60,
}

interface RunSummary {
  shiftsAuditedTotal: number
  shiftsAlerted: number
  shiftsSkipped: { reason: string; shift: string; date: string }[]
  errors: { context: string; error: string }[]
}

const parseSlotStartHour = (slot: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(slot.trim())
  if (!m) return null
  const h = parseInt(m[1], 10) + parseInt(m[2], 10) / 60
  return Number.isFinite(h) ? h : null
}

const toYmd = (d: Date): string => {
  // Reykjavik = UTC, so UTC components match wall-clock.
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Bookings for a (date, shift) audit. We look for paid KEF locker-mode
// bookings on the date whose pickup window starts before the shift's
// pickup time AND after the previous shift's pickup time (or 00:00 for
// the first shift of the day). That's the "this shift owns this booking"
// rule.
async function loadBookingsForShift(
  date: string,
  shift: TransportShift,
  prevShiftHour: number,
): Promise<{ recordId: string; customerName: string; pickupSlot: string }[]> {
  const table = getOrdersLookupTable()
  const dateSlash = date.replace(/-/g, '/')
  // Match the literal [LOCKER] marker the mapper writes for KEF locker
  // pickups. Loose `locker` substring matches are skipped here on purpose
  // — the cron must not page Runar for legacy / mis-tagged bookings.
  const formula = `AND(
    {Greiðslustaða} = "Greitt",
    FIND("[LOCKER]", {Annað (comment)}) > 0,
    OR(FIND("Keflav", LOWER({Heimilisfang})), FIND("KEF", UPPER({Heimilisfang}))),
    OR({Dagsetning pick-up} = "${dateSlash}", {Dagsetning pick-up} = "${date}")
  )`
  const records = await table
    .select({
      filterByFormula: formula,
      maxRecords: 50,
      fields: [
        'Nafn viðskiptavinar',
        'Tímasetning',
        'Heimilisfang',
        'Annað (comment)',
      ],
    })
    .firstPage()
  return records
    .filter((r) => {
      const slot = String(r.fields['Tímasetning'] ?? '')
      const startHour = parseSlotStartHour(slot)
      if (startHour === null) return false
      return startHour >= prevShiftHour && startHour < shift.pickupHourDecimal
    })
    .map((r) => ({
      recordId: r.id,
      customerName: String(r.fields['Nafn viðskiptavinar'] ?? '(unknown)'),
      pickupSlot: String(r.fields['Tímasetning'] ?? ''),
    }))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // --- auth -----------------------------------------------------------------
  const expected = process.env.CRON_SECRET
  const auth = req.headers.authorization
  if (!expected || auth !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const summary: RunSummary = {
    shiftsAuditedTotal: 0,
    shiftsAlerted: 0,
    shiftsSkipped: [],
    errors: [],
  }

  let shifts: TransportShift[]
  try {
    shifts = await loadActiveShifts()
  } catch (e) {
    summary.errors.push({
      context: 'loadActiveShifts',
      error: e instanceof Error ? e.message : String(e),
    })
    return res.status(200).json(summary)
  }

  const now = new Date()
  const today = toYmd(now)
  // Shifts that ended within the last 24h get audited. The cron runs every
  // 30 min so each shift has multiple chances to be checked, but
  // `findExistingAlarm` ensures we only alert once per (date, shift).
  const yesterday = toYmd(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const candidateDates = [yesterday, today]

  for (const date of candidateDates) {
    // Sort shifts by pickupHourDecimal so the "previous shift" lookup
    // works in one pass. `loadActiveShifts` already sorts but be explicit.
    const sorted = [...shifts].sort((a, b) => a.pickupHourDecimal - b.pickupHourDecimal)
    for (let i = 0; i < sorted.length; i += 1) {
      const shift = sorted[i]
      const prevShiftHour = i === 0 ? 0 : sorted[i - 1].pickupHourDecimal

      const pickupIso = shiftPickupIso(date, shift.pickupTimeHHmm)
      if (!pickupIso) {
        summary.shiftsSkipped.push({
          reason: 'unparseable pickup time',
          shift: shift.name,
          date,
        })
        continue
      }
      const pickupMs = new Date(pickupIso).getTime()
      const alarmAtMs = pickupMs + shift.alarmOffsetMinutes * 60 * 1000

      // Only audit shifts that have passed (pickup time + alarm offset).
      if (now.getTime() < alarmAtMs) {
        summary.shiftsSkipped.push({
          reason: 'shift not yet due for alarm',
          shift: shift.name,
          date,
        })
        continue
      }
      // Don't go back more than a day — older misses are already alerted
      // (or were never going to be).
      if (now.getTime() - pickupMs > 36 * 60 * 60 * 1000) {
        summary.shiftsSkipped.push({
          reason: 'shift older than 36h',
          shift: shift.name,
          date,
        })
        continue
      }

      summary.shiftsAuditedTotal += 1

      try {
        const already = await findExistingAlarm(date, shift.name as 'Noon' | 'Evening')
        if (already) {
          summary.shiftsSkipped.push({
            reason: 'alarm already exists',
            shift: shift.name,
            date,
          })
          continue
        }

        const bookings = await loadBookingsForShift(date, shift, prevShiftHour)
        if (bookings.length === 0) {
          // Nothing to audit. Not an alarm condition — just no traffic.
          continue
        }

        // Window for unlock events: from shift pickup time to the alarm
        // threshold. If the driver arrives a bit early or a bit late, the
        // unlock still falls inside [pickupMs, alarmAtMs].
        const windowStartIso = new Date(pickupMs - 15 * 60 * 1000).toISOString()
        const windowEndIso = new Date(alarmAtMs).toISOString()
        const unlocks = await countDoorUnlocksInWindow(windowStartIso, windowEndIso)

        if (unlocks >= bookings.length) continue // healthy

        const detailLines: string[] = []
        detailLines.push(`Shift: ${shift.name} (${shift.pickupTimeHHmm}) on ${date}`)
        detailLines.push(
          `Bookings expected to be collected: ${bookings.length}`,
        )
        detailLines.push(
          `door_unlocked Access Events in [${windowStartIso} → ${windowEndIso}]: ${unlocks}`,
        )
        detailLines.push('')
        detailLines.push('Bookings:')
        for (const b of bookings) {
          detailLines.push(
            `  • ${b.customerName} (record ${b.recordId}) — landed ${b.pickupSlot}`,
          )
        }

        await appendLockerAlarm({
          summary: `${shift.name} shift ${date}: ${bookings.length} booked, ${unlocks} unlocked`,
          firedAt: now.toISOString(),
          shiftDate: date,
          shiftName: shift.name as 'Noon' | 'Evening',
          bookingsExpected: bookings.length,
          unlocksObserved: unlocks,
          alarmEmail: shift.alarmEmail || 'runar@bagbee.is',
          detail: detailLines.join('\n'),
        })
        summary.shiftsAlerted += 1
      } catch (e) {
        summary.errors.push({
          context: `audit ${shift.name} ${date}`,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  return res.status(200).json(summary)
}
