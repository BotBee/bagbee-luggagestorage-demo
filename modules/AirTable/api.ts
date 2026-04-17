import { AirtableOrder } from '../../common/types'
import { ApplicationRoutes } from '../../utils/routing'

export const getOrderById = async (orderId: AirtableOrder) => {
  try {
    const res = await fetch(ApplicationRoutes.AirTable.apiAirtableRead, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(orderId),
      headers: { 'content-type': 'application/json' },
    })

    return res.json()
  } catch (error: any) {
    // TODO: Add error handling...
    console.error(error)
    throw error
  }
}

export const createOrder = async (order: AirtableOrder) => {
  try {
    const res = await fetch(ApplicationRoutes.AirTable.apiAirtableCreate, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(order),
      headers: { 'content-type': 'application/json' },
    })

    return res.json()
  } catch (error: any) {
    // TODO: Add error handling...
    console.error(error)
    throw error
  }
}

export const updateOrderToPayed = async (recordId: string) => {
  try {
    const res = await fetch(
      ApplicationRoutes.AirTable.apiAirtableUpdatePayedStatus,
      {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(recordId),
        headers: { 'content-type': 'application/json' },
      }
    )

    return res.json()
  } catch (error: any) {
    // TODO: Add error handling...
    console.error(error)
    throw error
  }
}
