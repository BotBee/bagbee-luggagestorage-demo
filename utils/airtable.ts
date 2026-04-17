import Airtable, { FieldSet, Records, Record, Table } from 'airtable'
import getAppConfig from '../modules/config'

const {
  serverRuntimeConfig: {
    airtableAccessToken,
    airtableTableId,
    airtableTagNumbersTableId,
    airtableBaseId,
    airtableEndpointUrl,
  },
} = getAppConfig()

// Returns a record array
const minifyItems = (records: Records<FieldSet>) =>
  records.map(record => getMinifiedItem(record))

// Returns fields and id separately
const getMinifiedItem = (record: Record<FieldSet>) => {
  if (!record.fields.brought) {
    record.fields.brought = false
  }
  return {
    id: record.id,
    fields: record.fields,
  }
}

const PROD_ORDERS_TABLE_ID = 'tblWLlNxZvtkFSFXs'
const TAG_TABLE_ID = 'tblVyZakUmK0CY0YJ'
const OPTIMO_STOPS_TABLE_ID = 'tblE3fYDSuk7dKPdF'

const getTable = (): Table<FieldSet> => {
  Airtable.configure({
    apiKey: airtableAccessToken,
    endpointUrl: airtableEndpointUrl,
  })

  const base = Airtable.base(airtableBaseId)

  return base(airtableTableId)
}

// Always reads from the production Nýtt/óflokkað table.
// Used by the public order tracking page so customers can look up real orders
// even when the booking flow points at a dev/test table.
const getOrdersLookupTable = (): Table<FieldSet> => {
  Airtable.configure({
    apiKey: airtableAccessToken,
    endpointUrl: airtableEndpointUrl,
  })

  const base = Airtable.base(airtableBaseId)

  return base(PROD_ORDERS_TABLE_ID)
}

const getTagNumbersTable = (): Table<FieldSet> => {
  const tagTableId = airtableTagNumbersTableId || TAG_TABLE_ID
  Airtable.configure({
    apiKey: airtableAccessToken,
    endpointUrl: airtableEndpointUrl,
  })

  const base = Airtable.base(airtableBaseId)

  return base(tagTableId)
}

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
  getOrdersLookupTable,
  getTagNumbersTable,
  getOptimoStopsTable,
  minifyItems,
  getMinifiedItem,
}
