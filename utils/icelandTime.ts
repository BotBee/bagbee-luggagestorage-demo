import dayjs, { type Dayjs } from 'dayjs'
import * as utc from 'dayjs/plugin/utc'
import * as timezone from 'dayjs/plugin/timezone'

// @ts-expect-error dayjs plugin typing
dayjs.extend(utc)
// @ts-expect-error dayjs plugin typing
dayjs.extend(timezone)

export const REYKJAVIK_TZ = 'Atlantic/Reykjavik'

/**
 * BagBee runs on Iceland wall-clock time, but ~80% of customers book from
 * other timezones — business rules (morning-flight cutoff, booking cutoff,
 * displayed departure/ETA times) must NEVER be derived from the browser's
 * local clock. Always convert explicitly with these helpers; a bare
 * dayjs.tz(x) targets the BROWSER timezone (it happens to preserve the
 * wall-clock digits of an offset-bearing string, but corrupts the instant
 * — see the fast-track departureDate regression this nearly caused).
 * Iceland is UTC year-round (no DST).
 */
export const inIcelandTime = (d: string | number | Date | Dayjs) =>
  dayjs(d).tz(REYKJAVIK_TZ)

export const nowInIceland = () => dayjs().tz(REYKJAVIK_TZ)
