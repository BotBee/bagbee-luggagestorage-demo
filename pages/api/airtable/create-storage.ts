import Airtable, { FieldSet, Table } from 'airtable'
import { NextApiRequest, NextApiResponse } from 'next'
import getAppConfig from '../../../modules/config'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'

const getStorageTable = (): Table<FieldSet> => {
  const {
    serverRuntimeConfig: {
      airtableAccessToken,
      airtableBaseId,
      airtableEndpointUrl,
    },
  } = getAppConfig()

  Airtable.configure({
    apiKey: airtableAccessToken,
    endpointUrl: airtableEndpointUrl,
  })

  return Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const table = getStorageTable()
    const created = await table.create([{ fields: req.body as FieldSet }])
    return res
      .status(200)
      .json({ id: created[0].id, fields: created[0].fields })
  } catch (error) {
    console.error('BSI Storage create failed', error)
    return res.status(500).json({ message: (error as Error).message })
  }
}
