/**
 * Shared server-side helpers for the staff storage-operations dashboard
 * (/admin/storage + /api/storage-ops/*). Centralises the BSI Storage field-id
 * map, an Airtable base getter, a normaliser that flattens a record into a
 * stable shape for the client, and the whitelist of fields the dashboard is
 * allowed to mutate.
 *
 * Reads use `returnFieldsByFieldId: true` so renames in Airtable never break
 * the dashboard (we key by id, not by display name).
 */
import Airtable, { FieldSet, Table } from 'airtable'
import getAppConfig from '../modules/config'

export const BSI_STORAGE_TABLE_ID = 'tblMJtxJiHFDi3TTk'

/** BSI Storage field ids (tblMJtxJiHFDi3TTk). */
export const FLD = {
  name: 'fld0Ll5nhBcY4Tk9l',
  bookingNumber: 'fldsCNCLMIJOhDnrb', // formula RIGHT(RECORD_ID(),5)
  email: 'fldilQhLz4FEvcQ0I',
  phone: 'fldffrazeIRs9OD5j',
  luggage: 'fldcEWNsDkNVeyYiQ',
  backpacks: 'fldlTqC8dRZg6j51z',
  totalQty: 'fldzgBQLX0exHumuy', // formula
  type: 'fldmUBwZ5as23BcP2',
  arrivalDate: 'fld5HqdhKUSr80jD2',
  arrivalTime: 'fldFgzGR4EL78uuyk',
  departureDate: 'fldPqUkuKBmFBMEYo',
  departureTime: 'fldz6BVPOI163ew85',
  pickUpTime: 'fldZZougYntrAAERG',
  late: 'fldfhdlo2lGlEn5qO',
  delivery: 'fldmepBtYj7H2RzYl',
  deliveryAddress: 'fldNjjSE7KnMk4Myy',
  hotelName: 'fldWTvTxnP2hO5SYR',
  lockerNumber: 'fldcESAn6e1UsOW2H',
  lockerPin: 'flduaVi55rf1HMibF',
  colorSticker: 'fldMcWutItFdTHkFR',
  paid: 'fldtPG8XrVCy7OgfA',
  paymentStatus: 'fld3xh2vqXPJkNmGP',
  totalAmount: 'fldIbJGDDTM6lUZDz',
  amountOnline: 'fldZO9NPuvg4j3Wpm',
  greidsla: 'fldzopMUuCPeLbW5z',
  reference: 'fldqRCneU70rDGq5c',
  comment: 'flddu7kEItTWIH1a6',
  pickedUp: 'fldEHzUTDyzvNBTQ9',
  droppedOff: 'fldY5ONgdSd1afKfd', // added 2026-06-09 for the ops dashboard
  created: 'fldosl21foJgjrtUN',
  flightDate: 'fld7NyaoGGfujPRRo',
  storagePageLink: 'flddm2I9cJlK3sR5Q', // formula
  confirmationEmailSent: 'fldziPc47iBPMm8Ml',
  reconcileAlertSent: 'fldQXyWod2462FkAO',
  bikeRentLink: 'fldteYPYlvY95HRNA',
} as const

export const TYPE_OPTIONS = [
  'Short term storage',
  'Long term storage',
  'Long term + late check-out',
  'Put to luggage lockers',
  'Hotel Delivery',
  'Storage and Check-in',
  'Cruise day-storage',
] as const

export const PAYMENT_STATUS_OPTIONS = ['Pending', 'Paid', 'Refunded', 'Failed', 'Cancelled'] as const
export const GREIDSLA_OPTIONS = ['Kortafærsla', 'Krafa send', 'Dótel rukkar', 'Cash', 'FlyBus', 'Bókun.io'] as const

export const getStorageTable = (): Table<FieldSet> => {
  const {
    serverRuntimeConfig: { airtableAccessToken, airtableBaseId, airtableEndpointUrl },
  } = getAppConfig()
  Airtable.configure({ apiKey: airtableAccessToken, endpointUrl: airtableEndpointUrl })
  return Airtable.base(airtableBaseId)(BSI_STORAGE_TABLE_ID)
}

const dateOnly = (v: unknown): string => (v ? String(v).slice(0, 10) : '')

export type StorageBooking = {
  id: string
  bookingNumber: string
  name: string
  email: string
  phone: string
  luggage: number
  backpacks: number
  totalQty: number
  type: string
  arrivalDate: string
  arrivalTime: string
  departureDate: string
  departureTime: string
  late: boolean
  delivery: boolean
  deliveryAddress: string
  hotelName: string
  lockerNumber: string
  lockerPin: string
  colorSticker: boolean
  paid: boolean
  paymentStatus: string
  totalAmount: number
  reference: string
  comment: string
  pickedUp: boolean
  droppedOff: boolean
  created: string
  flightDate: string
  storagePageLink: string
  fromBikeRent: boolean
}

/** Flatten an Airtable record (fetched with returnFieldsByFieldId) to the client shape. */
export const normalize = (rec: { id: string; fields: Record<string, any> }): StorageBooking => {
  const f = rec.fields
  const num = (k: string) => Number(f[k]) || 0
  const str = (k: string) => (f[k] == null ? '' : String(f[k]))
  return {
    id: rec.id,
    bookingNumber: str(FLD.bookingNumber),
    name: str(FLD.name),
    email: str(FLD.email),
    phone: str(FLD.phone),
    luggage: num(FLD.luggage),
    backpacks: num(FLD.backpacks),
    totalQty: num(FLD.totalQty),
    type: str(FLD.type),
    arrivalDate: dateOnly(f[FLD.arrivalDate]),
    arrivalTime: str(FLD.arrivalTime),
    departureDate: dateOnly(f[FLD.departureDate]),
    departureTime: str(FLD.departureTime) || str(FLD.pickUpTime),
    late: f[FLD.late] === true,
    delivery: f[FLD.delivery] === true,
    deliveryAddress: str(FLD.deliveryAddress),
    hotelName: str(FLD.hotelName),
    lockerNumber: str(FLD.lockerNumber),
    lockerPin: str(FLD.lockerPin),
    colorSticker: f[FLD.colorSticker] === true,
    paid: f[FLD.paid] === true,
    paymentStatus: str(FLD.paymentStatus),
    totalAmount: num(FLD.totalAmount) || num(FLD.amountOnline),
    reference: str(FLD.reference),
    comment: str(FLD.comment),
    pickedUp: f[FLD.pickedUp] === true,
    droppedOff: f[FLD.droppedOff] === true,
    created: str(FLD.created),
    flightDate: dateOnly(f[FLD.flightDate]),
    storagePageLink: str(FLD.storagePageLink),
    fromBikeRent: Array.isArray(f[FLD.bikeRentLink]) && f[FLD.bikeRentLink].length > 0,
  }
}

/**
 * Whitelist of fields the dashboard may write, mapped to their Airtable field id
 * + a coercion. Anything not listed here is rejected by /api/storage-ops/update.
 */
export const WRITABLE: Record<
  string,
  { field: string; coerce: (v: unknown) => unknown }
> = {
  droppedOff: { field: FLD.droppedOff, coerce: (v) => v === true },
  pickedUp: { field: FLD.pickedUp, coerce: (v) => v === true },
  paid: { field: FLD.paid, coerce: (v) => v === true },
  colorSticker: { field: FLD.colorSticker, coerce: (v) => v === true },
  lockerNumber: { field: FLD.lockerNumber, coerce: (v) => String(v ?? '') },
  lockerPin: { field: FLD.lockerPin, coerce: (v) => String(v ?? '') },
  comment: { field: FLD.comment, coerce: (v) => String(v ?? '') },
  paymentStatus: {
    field: FLD.paymentStatus,
    coerce: (v) => (PAYMENT_STATUS_OPTIONS.includes(String(v) as any) ? String(v) : 'Pending'),
  },
  type: {
    field: FLD.type,
    coerce: (v) => (TYPE_OPTIONS.includes(String(v) as any) ? String(v) : 'Short term storage'),
  },
}
