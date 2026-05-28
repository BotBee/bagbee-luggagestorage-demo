import Airtable, { FieldSet, Records, Record as AirtableRecord, Table } from 'airtable'
import getAppConfig from '../modules/config'

const {
  serverRuntimeConfig: {
    airtableAccessToken,
    airtableTableId,
    airtableBaseId,
    airtableEndpointUrl,
    airtableFastTrackTableId,
  },
} = getAppConfig()

// Returns a record array
const minifyItems = (records: Records<FieldSet>) => records.map((record) => getMinifiedItem(record))

// Returns fields and id separately
const getMinifiedItem = (record: AirtableRecord<FieldSet>) => {
  if (!record.fields.brought) {
    record.fields.brought = false
  }
  return {
    id: record.id,
    fields: record.fields,
  }
}

Airtable.configure({
  apiKey: airtableAccessToken,
  endpointUrl: airtableEndpointUrl,
})

const getBase = (): Airtable.Base => {
  return Airtable.base(airtableBaseId)
}

const getTable = (): Table<FieldSet> => {
  const base = getBase()

  return base(airtableTableId)
}

const getFastTrackTable = (): Table<FieldSet> => {
  const base = getBase()

  return base(airtableFastTrackTableId)
}

/**
 * Get the default timeslot max
 * @returns The default timeslot max
 */
const getPickupConfig = async () => {
  const base = getBase()

  const records = await base('Config').select({}).all()

  const timeslotMax = records.find((record) => record.fields.Name === 'Timeslot Max')

  try {
    const value = timeslotMax?.fields.Value
    if (typeof value === 'number') return value
    if (typeof value === 'string') return parseInt(value, 10)
    return 2
  } catch (error) {
    return 2
  }
}

/**
 * Get the pickup config matrix
 * The matrix is used to override the default timeslot max for specific dates and timeslots
 * @param defaultTimeslotMax The default timeslot max
 * @returns The pickup config matrix
 */
const getPickupConfigMatrix = async (defaultTimeslotMax: number) => {
  const base = getBase()

  const records = await base('Matrix Pickup')
    .select({
      fields: ['Date', 'Timeslot', 'Difference Value'],
    })
    .all()

  const timeslotMaxOverrides = records.reduce((acc, curr) => {
    if (typeof curr.fields.Timeslot !== 'string' || typeof curr.fields.Date !== 'string') return acc

    const key = `${curr.fields.Date}/${curr.fields.Timeslot}`
    const differenceValue = curr.fields['Difference Value']
    if (typeof differenceValue !== 'number') return acc
    acc[key] = defaultTimeslotMax + differenceValue
    return acc
  }, {} as Record<string, number>)

  return timeslotMaxOverrides
}

/**
 * Get pickup times for paid orders only (capacity excludes unpaid bookings).
 */
const getPickupTimes = async () => {
  const base = getBase()
  const records = await base
    .table('Nýtt/óflokkað')
    .select({
      view: 'Timeslot Timeline',
      fields: ['Dagsetning pick-up', 'Tímasetning'],
      filterByFormula: `AND(NOT({Tímasetning} = BLANK()), {Greiðslustaða} = 'Greitt')`,
    })
    .all()

  return minifyItems(records)
}

// Hardcoded table IDs for the order tracking feature.
// These are the production table IDs in the same Airtable base.
const ORDERS_LOOKUP_TABLE_ID = 'tblWLlNxZvtkFSFXs' // Nýtt/óflokkað
const TAG_NUMBERS_TABLE_ID = 'tblVyZakUmK0CY0YJ' // Tag numbers
const OPTIMO_STOPS_TABLE_ID = 'tblE3fYDSuk7dKPdF' // Optimo stops

/**
 * Always reads from the production Nýtt/óflokkað table.
 * Used by the public order tracking page.
 */
const getOrdersLookupTable = (): Table<FieldSet> => {
  Airtable.configure({
    apiKey: airtableAccessToken,
    endpointUrl: airtableEndpointUrl,
  })
  const base = Airtable.base(airtableBaseId)
  return base(ORDERS_LOOKUP_TABLE_ID)
}

/**
 * Tag numbers table — stores bag photos linked to orders.
 */
const getTagNumbersTable = (): Table<FieldSet> => {
  Airtable.configure({
    apiKey: airtableAccessToken,
    endpointUrl: airtableEndpointUrl,
  })
  const base = Airtable.base(airtableBaseId)
  return base(TAG_NUMBERS_TABLE_ID)
}

/**
 * Optimo stops table — stores scheduled pickup/delivery times from OptimoRoute.
 */
const getOptimoStopsTable = (): Table<FieldSet> => {
  Airtable.configure({
    apiKey: airtableAccessToken,
    endpointUrl: airtableEndpointUrl,
  })
  const base = Airtable.base(airtableBaseId)
  return base(OPTIMO_STOPS_TABLE_ID)
}

export {
  getTable,
  getPickupConfig,
  getPickupConfigMatrix,
  minifyItems,
  getMinifiedItem,
  getBase,
  getPickupTimes,
  getFastTrackTable,
  getOrdersLookupTable,
  getTagNumbersTable,
  getOptimoStopsTable,
}
