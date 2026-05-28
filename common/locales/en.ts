const common = {
  backButtonText: 'Back',
  menu: 'Menu',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
}

const footer = {
  linksHeading: 'Links',
  contactHeading: 'Contact',
  addressHeading: 'Address',
  addressLine1: 'BSÍ bus terminal',
  addressCountry: 'Iceland',
  tagline: 'We’ll take care of your bags honey.',
  copyright: 'All Rights Reserved.',
  privacyPolicy: 'Privacy Policy',
  termsAndConditions: 'Terms & Conditions',
}

const contactInfoStep = {
  title: 'Lets get your contact details',
  subtitle: 'Just in case we need to get a hold of you',
  fullNameLabel: 'Full name',
  fullNamePlaceholder: 'Enter your full name',
  emailLabel: 'E-mail',
  emailPlaceholder: 'Enter your e-mail',
  phoneNumberLabel: 'Phone number',
  companyButton: 'Booking as a company?',
  companyOffButton: "I'm booking as an individual",
  companyIdLabel: 'Company legal registration/ID number',
  companyIdPlaceholder: 'ID number',
  passengersTitle: 'Passenger information',
  passengersSubTitle: 'NOTE: Names need to be entered as they appear on the flight booking',
  passengerTitle: 'Passenger',
  passengerFirstNameLabel: 'First name',
  passengerFirstNamePlaceholder: 'Enter first name',
  passengerLastNameLabel: 'Last name',
  passengerLastNamePlaceholder: 'Enter last name',
  addPassengerButton: 'Add passenger',
  removePassengerButton: 'Remove',
  termsCheckbox: {
    partOne: 'I agree to Bagbees',
    partTwo: 'terms and conditions',
  },
  submitButtonText: 'Next step',
}

const departureDateStep = {
  title: "Let's start by selecting your departure date",
  confirmTitle: 'Departure date',
  subtitle: 'Select the day of your departure',
}

const airlineStep = {
  title: 'Which airline are you flying with?',
  subtitle: 'Select the airline you are flying with',
  otherAirline: 'Other airline',
}

const airportStep = {
  title: 'Where are you going?',
  subtitle: 'Select your arrival airport',
  arrivalAirport: 'Arrival airport',
  searchPlaceholder: 'Search for a airport or city..',
  infoContainerText:
    "If you have a layover flight, please select the airport you're landing at with your flight from Keflavík Airport. Pls. note: At the moment we can not check in bags to Canada",
}

const selectFlightStep = {
  title: "We've found some matching flights!",
  subtitle: 'Please select your flight in the list below',
  flightNumberText: 'Flight number',
}

const bagSelectionStep = {
  title: 'Number of luggage items',
  subtitle: 'Select an amount of luggage items you need picked up and checked in',
  luggageText: 'Luggage',
  oddSizeText: 'Odd-size items - Example; golf bags, skis, strollers and bicycle bags',
  totalBags: 'Total number of bags:',
  priceText: 'Your price',
  submitButton: 'Next step',
}

const pickUpStep = {
  title: 'Choose your pick up time and location',
  subtitle: 'Select a pick up time and the pick up location',
  addressLabel: 'Hotel or address of luggage pick up',
  residentialTab: 'Residential',
  hotelLocationInputLabel: 'At which hotel do you want your luggage picked up?',
  residentialLocationInputLabel: 'Where do you want your luggage picked up?',
  pickUpTimeLabel: 'Choose a pick up time window',
  morningPickUpGroupLabel: 'Morning pick up windows',
  eveningPickUpGroupLabel: 'Evening pick up windows',
  dayOfDeparture: 'Day of departure',
  dayBeforeDeparture: 'Day before departure',

  pickUpInfoBox:
    'You will get a message on the day of pick up with a more precise pick up time within the selected pick up window.',
  ecoInfo: 'Less driving. Greener option.',
  commentLabel: 'Comments or message to your driver. E.g. hotel room, floor, apartment number etc.',
  submitButton: 'Next step',
  fullyBooked: 'Fully booked',
  loadingAvailableTimes: 'Loading available times...',
  errorLoadingAvailableTimes: 'Error loading available times',
}

const confirmOrderStep = {
  title: 'Confirm your order',
  subtitle: 'Make sure the information is correct',
  personalInformationTitle: 'Personal information',
  flightDetailsTitle: 'Flight details',
  pickUpInfoTitle: 'Luggage information',
  passengersInfoTitle: 'Passenger information',
  passengerInfoTitle: 'Passenger',
  totalPriceText: 'Total price',
  submitButton: 'Proceed to payment',
  pickUpItems: {
    location: 'Pick up location',
    time: 'Pick up time',
    date: 'Pick up date',
  },
  discount: {
    iHaveDiscountCode: 'Do you have a discount code?',
    iDontHaveDiscountCode: "I don't have a discount code",
    discountCode: 'Discount code',
    inputPlaceholder: 'Enter discount code',
    apply: 'Apply',
    discountCodeInvalid: 'Discount code is invalid',
    errorValidatingDiscountCode: 'Error validating discount code',
    discountCodeSuccessfullyAdded: 'Discount code successfully added. Discount: ',
  },
}

const successStep = {
  title: 'Order completed',
  bookingNumber: 'Booking number',
  message:
    'Thank you for ordering the BagBee service. We have sent you an e-mail with further information. If you have further questions, please see www.bagbee.is for information and contact options',
}

const loadingScreen = {
  loadingFlightsText: 'Fetching flights',
  loadingOrderCompleteText: 'finishing up your booking..',
}

const priceCalculator = {
  title: 'How many bags?',
  landingPageCheckInButtonText: 'Check in your bag',
}

const aboutPage = {
  contact: 'Contact us',
}

const giftcardPage = {
  title: 'BagBee Gift Certificate',
  paragraph1:
    'The BagBee gift certificates are an ideal for travellers who can appreciate more comfort during their travels',
  buttonText: 'Buy a gift certificate',
}

const orderTrackingPage = {
  // Page title
  orderLabel: 'Order',

  // Service types
  departureService: 'Departure Service',
  arrivalService: 'Arrival Service',

  // Status names
  status: {
    Pending: 'Pending',
    Confirmed: 'Confirmed',
    Planned: 'Planned',
    'In Progress': 'In Progress',
    Delivered: 'Delivered',
  },

  // 404 page
  notFoundTitle: '404',
  notFoundText: 'Order #{orderNo} was not found. Please check your order number and try again.',

  // Sections
  orderDetailsTitle: 'Order Details',
  estimatedPickupTitle: 'Estimated Pickup Time',
  pickupLocationTitle: 'Pickup Location',
  deliveryLocationTitle: 'Delivery Location',
  yourBagsTitle: 'Your Bags',

  // Detail labels
  service: 'Service',
  flight: 'Flight',
  flightDate: 'Flight Date',
  pickupDate: 'Pickup Date',
  airline: 'Airline',
  bags: 'Bags',
  pickupWindow: 'Pickup Window',
  deliveryWindow: 'Delivery Window',
  customer: 'Customer',
  phone: 'Phone',
  standardSuffix: 'standard',
  oddSizeSuffix: 'odd-size',
  totalSuffix: 'total',

  // Estimated pickup card
  pickupBetween: 'Your bags will be picked up between',
  pickupEstimateNote: 'This is an estimate (\u00b110 minutes)',

  // Bag photos
  noBagPhotos: 'No bag photos available yet.',

  // Edit section
  editOrder: 'Edit order',
  updateYourOrder: 'Update your order',
  standardBags: 'Standard bags',
  oddSizeBags: 'Odd-size bags',
  selectPickupTimeWindow: 'Select a pickup time window:',
  morningLabel: 'Morning (09:00 - 12:00)',
  eveningLabel: 'Evening (17:00 - 22:00)',
  selected: 'Selected',

  // Surcharge
  surcharge: 'Surcharge:',
  extraBag: 'extra bag',
  extraBags: 'extra bags',
  extraOddSize: 'extra odd-size',

  // Buttons
  saveChanges: 'Save changes',
  processing: 'Processing...',
  payAndUpdate: 'Pay {amount} ISK and update',
  freeTimeWindow: 'Updating time window is free of charge.',

  // Messages
  changesSaved: 'Your changes have been saved. You will receive an updated confirmation.',
  paymentSuccess:
    'Payment successful! Your order has been updated and you will receive an updated confirmation.',
  paymentError: 'Payment failed. Please try again or contact BagBee for assistance.',
}

const en = {
  common,
  footer,
  contactInfoStep,
  departureDateStep,
  airlineStep,
  airportStep,
  selectFlightStep,
  bagSelectionStep,
  pickUpStep,
  confirmOrderStep,
  successStep,
  loadingScreen,
  priceCalculator,
  aboutPage,
  giftcardPage,
  orderTrackingPage,
}

// eslint-disable-next-line import/no-anonymous-default-export
export default en
