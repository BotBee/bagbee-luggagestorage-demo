import { FieldSet, Record as AirtableRecord, Table } from 'airtable'

/** A full Airtable record id, e.g. recABCDEFGHIJKLMN. */
export const isRecordId = (s: string): boolean => /^rec[A-Za-z0-9]{14}$/.test(s)

/**
 * Resolve a customer-facing booking identifier to its Airtable record.
 *
 * Accepts EITHER:
 *   - a full record id (`recXXXXXXXXXXXXXX`) — used by the Rapyd redirect, or
 *   - the short 5-char Booking Number (`RIGHT(RECORD_ID(), 5)`) used in the
 *     customer-facing `/storage/{code}` and `/bikerent/{code}` links (so the
 *     URL matches the short order-number style of the other order pages).
 *
 * Returns null if nothing matches.
 */
export async function findBookingRecord(
  table: Table<FieldSet>,
  idOrCode: string,
): Promise<AirtableRecord<FieldSet> | null> {
  if (isRecordId(idOrCode)) {
    try {
      return await table.find(idOrCode)
    } catch {
      return null
    }
  }
  // Short Booking Number — alphanumeric, 5 chars. Reject anything else so the
  // value can be safely interpolated into the formula.
  if (!/^[A-Za-z0-9]{5}$/.test(idOrCode)) return null
  const recs = await table
    .select({ filterByFormula: `{Booking Number} = '${idOrCode}'`, maxRecords: 1 })
    .firstPage()
  return recs[0] || null
}
