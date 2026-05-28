import { AirtableFastTrackOrder, AirtableOrder } from '../../common/types'
import { ApplicationRoutes } from '../../utils/routing'
import { DiscountCodeResponse } from '../../pages/api/airtable/discount'

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

export const getFastTrackOrderById = async (orderId: AirtableOrder) => {
  try {
    const res = await fetch(ApplicationRoutes.AirTable.apiAirtableFastTrackRead, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(orderId),
      headers: { 'content-type': 'application/json' },
    })

    return res.json()
  } catch (error: any) {
    console.error(error)
    throw error
  }
}
export const validateDiscountCode = async (code: string): Promise<DiscountCodeResponse> => {
  try {
    const res = await fetch(ApplicationRoutes.AirTable.apiAirtableDiscount, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify({ code }),
      headers: { 'content-type': 'application/json' },
    })

    return res.json()
  } catch (error: any) {
    console.error(error)
    throw error
  }
}
export const validateFastTrackDiscountCode = async (code: string): Promise<DiscountCodeResponse> => {
  try {
    const res = await fetch(ApplicationRoutes.AirTable.apiAirtableFastTrackDiscount, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify({ code }),
      headers: { 'content-type': 'application/json' },
    })

    return res.json()
  } catch (error: any) {
    console.error(error)
    throw error
  }
}

export const createFastTrackOrder = async (order: AirtableFastTrackOrder) => {
  try {
    const res = await fetch(ApplicationRoutes.AirTable.apiAirtableFastTrackCreate, {
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

export const updateFastTrackOrderToPayed = async (recordId: string) => {
  try {
    const res = await fetch(
      ApplicationRoutes.AirTable.apiAirtableFastTrackUpdatePayedStatus,
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
