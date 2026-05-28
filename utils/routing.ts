export const ApplicationRoutes = {
  pages: {
    book: '/book',
    chooseAirline: '/book/choose-airline',
    bagSelection: '/book/bag-selection',
    confirmOrder: '/book/confirm-order',
    selectFlight: '/book/select-flight',
    departureDate: '/book/departure-date',
    arrivalAirport: '/book/arrival-airport',
    pickUp: '/book/pick-up',
    personalInfo: '/book/personal-info',
    fastTrack: {
      index: '/fast-track/book',
      chooseAirline: '/fast-track/choose-airline',
      confirmOrder: '/fast-track/confirm-order',
      selectFlight: '/fast-track/select-flight',
      departureDate: '/fast-track/departure-date',
      arrivalAirport: '/fast-track/arrival-airport',
      personalInfo: '/fast-track/personal-info',
    }
  },
  apiBook: '/api/book',
  AirTable: {
    apiAirtableCreate: '/api/airtable/create',
    apiAirtableRead: '/api/airtable/read',
    apiAirtableUpdatePayedStatus: '/api/airtable/update-paid-status',
    apiAirtableFastTrackCreate: '/api/airtable/fast-track/create',
    apiAirtableFastTrackRead: '/api/airtable/fast-track/read',
    apiAirtableFastTrackUpdatePayedStatus: '/api/airtable/fast-track/update-paid-status',
    apiAirtableDiscount: '/api/airtable/discount',
    apiAirtableFastTrackDiscount: '/api/airtable/fast-track/discount',
  },
  Isavia: {
    apiGetFlights: '/api/air-travel/get-flights',
  },
  apiRapyd: '/api/rapyd',
  success: '/payment/success',
  error: '/error', //TODO: Error page
}
