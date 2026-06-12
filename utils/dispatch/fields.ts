// Airtable field & table IDs for the dispatch dashboard.
// Mirrors route-planner/route_planner.py constants — keep in sync.

export const TBL_ORDERS = 'tblWLlNxZvtkFSFXs'
export const TBL_SCHEDULE = 'tblaDEYYQ1Wg3gHO0'

export const FLD = {
  // Orders (Nýtt/óflokkað)
  orderId: 'fldFh4cU2KiZant8Q',
  orderNumber: 'fldLGpQE6PIOeMXRd',
  pickupAddress: 'fldA2biuvoFnabjur',
  municipality: 'fldR9yuomHQFhEbt0',
  timeSlot: 'fldXyzfLIhi4G25p4',
  shift: 'fldkdoNmHwjvu6JU9',
  pickupDate: 'fldYDA8Fuk8bU9tZA',
  customerName: 'flds4W4WLarQ5MBEg',
  bagCount: 'fld8lJcgl5CTa0TCF',
  phone: 'fldLNjUKpMHtre188',
  deliveryAddress: 'fldSXm2qLZgpDtDgO',
  optimoPickupId: 'fldRgUzFTY1fAN2Um',
  optimoDeliveryId: 'fldxO93LKk4ndsiU1',
  orderStatus: 'fldsqQ8zCVZSE80Nu',
  paid: 'fldQEgArrB69AHTqy',
  // Per-stop service durations in MINUTES. Formulas in Airtable; values
  // scale with bag count so the planner gets a realistic stop budget
  // instead of a hardcoded constant.
  pickupDurationMin: 'fldlmjbanTtMDud6z',
  deliveryDurationMin: 'fldefiangKfHM5tpu',
} as const

export const SCHED = {
  date: 'fldx0Ga6El80HF9w6',
  shift: 'fldMuKqNnqsldMk2R',
  driver: 'fldAZ3J4BWJ9CXzwn',
  driverEmail: 'fldZm9ZNHpzXid7Js',
  driverName: 'fldA80D2DPmLHkgEI',
  driverAddress: 'fldMfe7d0LGt57eIb',
} as const

// Vehicle start/end — drivers park here, vehicles begin and end the day at BSÍ.
export const BSI_DEPOT = {
  address: 'Reykjavik BSI Bus Terminal, 101 Reykjavík, Iceland',
  // Cached lat/lng for BSÍ — avoids one geocode call per plan.
  lat: 64.1395,
  lng: -21.9408,
}

// Bag delivery drop point — every Evening shipment ends here.
export const KEF_DROP = {
  address: 'Keflavik International Airport, 235 Keflavík, Iceland',
  // Terminal building / bag drop area.
  lat: 63.9895,
  lng: -22.6046,
}

export type ShiftName = 'Evening' | 'Morning' | 'Day'

// --- In-house dispatch persistence (separate from Orders) -----------------
// Created 2026-05-29. Written by /api/dispatch/save-plan; read+updated by the
// driver app. Timestamps are ISO-8601 UTC strings.

export const TBL_DISPATCH_STOPS = 'tblHD8A301Vh2D5Wf'
export const STOP = {
  stopKey: 'fld0C6RGtpzgBReq2',
  date: 'fldM384Gm6q8VfzLJ',
  shift: 'flda1JOoLKS8eBVNa',
  driverRecordId: 'fldUrpB6ClU8BX8iw',
  driverName: 'fldF41iBytsL4bkk3',
  orderRecordId: 'flddmaGxDxUbgcydp',
  seq: 'fldHQ4iPvf6bep944',
  type: 'fldvwD0Mo0ClC1hAG',
  customer: 'fld1hg6zOFLLuBIxr',
  address: 'fldu6h6RPHBv8ps4C',
  lat: 'fldhKiEVr6KATnedB',
  lng: 'fldRVPoKFMEGYQKQl',
  phone: 'fld3uPta0AKNvTS8T',
  bags: 'fldYEZqS0ji3LVr0d',
  timeWindow: 'fldQxZYPtjuC6MALE',
  plannedArrival: 'fldS8Li3IIIxaqiiP',
  status: 'fldB98N5T3LyinUJB',
  actualArrival: 'fldG73kjb8ygsofl4',
  note: 'fldN7WtLruvtsJFiG',
  proofPhoto: 'fldhfiOzBUGtmbdff',
} as const

export const TBL_DISPATCH_PLANS = 'tblsCXqvvVPnN2aPs'
export const PLAN = {
  planKey: 'fldIbv7GKhFOwbXBK',
  date: 'fld9B04yZRqz8Wvsj',
  shift: 'fld9llLikf3AyuEua',
  driverRecordId: 'fldIqJqE83IGzuJYZ',
  driverName: 'fld1IgLSv1lbRlJoe',
  finalizedAt: 'fld9oOHMhDibTL4LF',
  summary: 'fld8yjkQ3f3N9lrt5',
  totalDistanceM: 'fldkNzbxnWLWrCxZi',
  totalDurationS: 'fldLgQWfkSYcjFzKl',
  stopsCount: 'fld6MGeyUSHDdb4Tc',
  driverLastLat: 'fldxTkwKLHfDYjOby',
  driverLastLng: 'fld8DEXLaGkz97554',
  driverLastPingAt: 'fldZw6ED8phMYbgal',
  scheduledSendAt: 'fldsKWQ9vitxhUvcb',
  sentAt: 'flduP2xzhN7cnUKIo',
  sendStatus: 'fldQRXqC0itR65tB1',
  vehicle: 'fldkbnilKHwgg00hw',
} as const

// --- Fleet Management System (separate Airtable base) --------------------
// The dispatcher assigns a van per driver from our Own Fleet, or a rental.
export const FLEET_BASE_ID = 'appe0dWRH3OuVExPW'
export const TBL_OWN_FLEET = 'tblqwRe3tZXihNyYp'
export const OWN_FLEET = {
  vehicleId: 'fldDD2A9vUBz6RrHa',
  make: 'fldnoQLiAwlK6oMgs',
  model: 'fldoBybpHyjYkUDMF',
  colour: 'fld6qtpDf0DvBjulS',
  year: 'fldtPph2m53h1eGHy',
  suitcases: 'fld4MmqpPWHDcABMW',
  bikeBox: 'fld9Z2z1TBsYIJsG0',
  isElectric: 'fldzPMIQ5qMSoZK2e',
  seats: 'fldZFiDDKIJDUjzNL',
} as const
export const TBL_RENTALS = 'tblwfmAIsThxljS9R'
export const RENTAL = {
  vehicleId: 'fldJmxWOuOVOanLSC',
  make: 'fldt7l7XzqFZaU6rU',
  model: 'flduk3x4GsDdoqXX7',
  supplier: 'fldSdO4vCwRpRJJNk',
  suitcases: 'fldavRM4OQ1Sg6VXo',
  recommend: 'fldl4yTrZIkbxn6f8',
} as const
