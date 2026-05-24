import Airtable, { FieldSet, Table } from 'airtable'
import { NextApiRequest, NextApiResponse } from 'next'
import getAppConfig from '../../../modules/config'

const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'

const getStorageTable = (): Table<FieldSet> => {
  const {
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
  } = getAppConfig()
  Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
  return Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string }

  if (!id || typeof id !== 'string') return res.status(400).json({ message: 'Missing id' })

  const table = getStorageTable()

  if (req.method === 'GET') {
    try {
      const record = await table.find(id)
      return res.status(200).json({ id: record.id, fields: record.fields })
    } catch {
      return res.status(404).json({ message: 'Booking not found' })
    }
  }

  if (req.method === 'PATCH') {
    try {
      const updated = await table.update(id, req.body as FieldSet)
      return res.status(200).json({ id: updated.id, fields: updated.fields })
    } catch (err) {
      return res.status(500).json({ message: (err as Error).message })
    }
  }

  return res.status(405).end()
}
