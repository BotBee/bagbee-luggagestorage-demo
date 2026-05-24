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

const cancelStep = {
  title: 'Payment unsuccessful',
  message:
    "Something went wrong with the payment. You can retry the payment for the same order, or start a new booking from scratch.",
  retryButton: 'Retry payment',
  backToBookingButton: 'Back to booking',
  startOverButton: 'Start a new booking',
  retryError: "Couldn't restart the payment. Please try again or contact BagBee.",
  alreadyPaidNotice: 'This order has already been paid.',
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
  pickupDeliveryService: 'Pickup & Delivery',

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
  clientInfoTitle: 'Client Information',
  pickupInfoTitle: 'Pickup',
  deliveryInfoTitle: 'Delivery',
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
  deliveryDate: 'Delivery Date',
  customer: 'Customer',
  phone: 'Phone',
  email: 'Email',
  address: 'Address',
  pickupAddress: 'Pickup Address',
  deliveryAddress: 'Delivery Address',
  addressLabel: 'Pickup address',
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
  editOrderDescription: 'Change your pickup time, address, or bag count.',
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
  paymentSuccess: 'Payment successful! Your order has been confirmed.',
  paymentError: 'Payment failed. Please try again or contact BagBee for assistance.',

  // Fast-Track
  fastTrackTitle: 'Fast-Track to your flight',
  fastTrackDescription:
    'Skip the queue at airport security. 2,490 kr per passenger.',
  fastTrackOpenButton: 'Order Fast-Track',
  fastTrackSectionTitle: 'Add Fast-Track',
  fastTrackPassenger: 'Passenger',
  fastTrackMainPassenger: 'Main passenger',
  fastTrackFirstName: 'First name',
  fastTrackLastName: 'Last name',
  fastTrackAddPassenger: '+ Add another passenger',
  fastTrackRemovePassenger: 'Remove',
  fastTrackTotal: 'Total',
  fastTrackPay: 'Pay {amount} kr',
  fastTrackProcessing: 'Processing...',
  fastTrackCancel: 'Cancel',
  fastTrackSuccess:
    'Fast-Track purchase complete! You will receive a confirmation email shortly.',
  fastTrackError:
    'Fast-Track payment failed. Please try again or contact BagBee.',
  fastTrackMaxPassengers: 'Maximum 4 passengers per Fast-Track order.',
  fastTrackActiveTitle: 'Fast-Track is active',
  fastTrackActiveDescription:
    'Skip the security queue on your flight day. Show the confirmation email at the Fast-Track lane.',
  fastTrackValidThrough: 'Valid through {date}',
  fastTrackExpiredTitle: 'Fast-Track expired',
  fastTrackExpiredDescription:
    'Your Fast-Track was valid through {date} and is no longer active.',
  fastTrackPassengersLabel: 'Passengers',
  fastTrackAddMore: '+ Add another passenger',

  // Add bags (Planned + In Progress)
  addBagsTitle: 'Need to add a bag?',
  addBagsDescription:
    'Extra bags can be added right up until the driver hands off your luggage.',
  addBagsOpenButton: 'Add bags',
  addBagsSectionTitle: 'Add bags to your order',
  addBagsCurrentBags:
    'You currently have {regular} regular and {oddsize} odd-size bags on this order.',
  addBagsRegularLabel: 'Extra regular bags (1,990 kr each)',
  addBagsOddSizeLabel: 'Extra odd-size bags (2,490 kr each)',
  addBagsTotal: 'Total',
  addBagsPay: 'Pay {amount} kr',
  addBagsCancel: 'Cancel',
  addBagsError:
    'Could not start the payment. Please try again or contact BagBee.',

  // Cancel order
  cancelOrder: {
    linkText: 'Cancel order',
    confirmTitle: 'Cancel this order?',
    confirmBody: (amount: string) =>
      `You'll receive a full refund of ${amount} ISK to your original payment method. This can take a few minutes to appear. This action cannot be undone.`,
    confirmButton: 'Yes, cancel and refund',
    keepButton: 'Keep order',
    cancelling: 'Cancelling…',
    doneTitle: 'Order cancelled',
    successRefunded:
      'Your order has been cancelled and the full amount has been refunded. It may take a few business days to appear on your statement.',
    successPartial:
      'Your order has been cancelled, but one or more refunds could not be processed automatically. BagBee will contact you to complete the refund.',
    successNoPayments:
      'Your order has been cancelled. No payment was on file, so no refund is needed.',
    error:
      'We could not cancel the order. Please try again or contact BagBee directly.',
    tooLate:
      'Online cancellation is only available up to 24 hours before pickup. Please contact BagBee directly.',
    close: 'Close',
  },

  // P&D edit form
  editPickupSection: 'Pickup',
  editDeliverySection: 'Delivery',
  pickupAddressLabel: 'Pickup address',
  deliveryAddressLabel: 'Delivery address',
  pickupDateLabel: 'Pickup date',
  deliveryDateLabel: 'Delivery date',
  pickupTimeWindowLabel: 'Pickup time window',
  deliveryTimeWindowLabel: 'Delivery time window',
  timeWindowPlaceholder: 'e.g. 09:00 - 11:00',

  // Tip the driver (English-only feature, shown after Delivered)
  tipTitle: 'Happy with your delivery?',
  tipSubtext:
    'If your BagBee driver did a great job, leave them a tip. 100% goes to the driver.',
  tipPresetLabel: 'Quick amount',
  tipCustomLabel: 'Or enter a custom amount (kr)',
  tipSubmit: 'Tip {amount} kr',
  tipSubmitGeneric: 'Pay tip',
  tipProcessing: 'Processing...',
  tipSuccess: 'Thank you! Your tip has been sent to the driver.',
  tipError: 'Tip payment failed. Please try again.',

  // Charter-flight passenger collection (FI1XXX flights only).
  // Replaces the legacy email→Fillout-form flow.
  charterTitle: 'Charter flight — please list your passengers',
  charterIntro:
    'Flight {flightNumber} with Icelandair is a charter flight, so we need every passenger’s full name to check baggage in for the whole party. Boarding passes will be emailed to you from Icelandair.',
  charterBaggageNote:
    'Baggage allowance on charter flights is usually 1 bag per passenger. Some charters (typically golf and ski trips) allow 2 bags per passenger — in that case, BagBee will check in the second bag at the airport and email you a photo of the bag tag.',
  charterPassengerLabel: 'Passenger {n} — full name',
  charterMainPassenger: 'Main passenger',
  charterAddPassenger: '+ Add passenger',
  charterRemovePassenger: 'Remove',
  charterSubmit: 'Register passengers',
  charterSubmitting: 'Registering...',
  charterSuccessTitle: 'Thank you!',
  charterSuccessText:
    'We have your passenger list and will handle check-in. Boarding passes will arrive by email.',
  charterError:
    'Could not send passenger list. Please try again or contact us.',
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
  cancelStep,
  loadingScreen,
  priceCalculator,
  aboutPage,
  giftcardPage,
  orderTrackingPage,
}

// eslint-disable-next-line import/no-anonymous-default-export
export default en
