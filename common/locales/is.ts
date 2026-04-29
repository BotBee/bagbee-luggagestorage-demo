const common = {
  backButtonText: 'Til baka',
  menu: 'Valmynd',
  openMenu: 'Opna valmynd',
  closeMenu: 'Loka valmynd',
}

const footer = {
  linksHeading: 'Hlekkir',
  contactHeading: 'Tengjumst',
  addressHeading: 'Heimilisfang',
  addressLine1: 'BSÍ umferðarmiðstöð',
  addressCountry: '',
  tagline: 'Innritaðu töskurnar að heiman.',
  copyright: 'Allur réttur áskilinn',
  privacyPolicy: 'Persónuverndarstefna',
  termsAndConditions: 'Skilmálar',
}

const contactInfoStep = {
  title: 'Nú þurfum við að fá upplýsingar um þig',
  subtitle: 'Ef ske kynni að við þurfum að ná í þig',
  fullNameLabel: 'Fullt nafn',
  fullNamePlaceholder: 'Sláðu inn fullt nafn',
  emailLabel: 'Netfang',
  emailPlaceholder: 'Sláðu inn netfangið þitt',
  phoneNumberLabel: 'Símanúmer',
  companyButton: 'Bóka fyrir fyrirtæki?',
  companyOffButton: 'Ég er að bóka sem einstaklingur',
  companyIdLabel: 'Kennitala fyrirtækis',
  companyIdPlaceholder: 'Kennitala',
  passengersTitle: 'Farþegaupplýsingar',
  passengersSubTitle: 'ATH. mikilvægt er a skrá nöfn eins og i flugbókun',
  passengerTitle: 'Farþegi',
  passengerFirstNameLabel: 'Eiginnafn (millinafn skráist með eiginnafni)',
  passengerFirstNamePlaceholder: 'Sláðu inn eiginnafn',
  passengerLastNameLabel: 'Eftirnafn',
  passengerLastNamePlaceholder: 'Sláðu inn eftirnafn',
  addPassengerButton: 'Bæta við farþega',
  removePassengerButton: 'Fjarlægja',
  termsCheckbox: {
    partOne: 'Ég samþykki',
    partTwo: 'skilmála Bagbee',
  },
  submitButtonText: 'Næsta skref',
}

const departureDateStep = {
  title: 'Byrjum á að velja dagsetningu brottfarar',
  subtitle: 'Veldu dagsetninguna sem þú flýgur út',
  confirmTitle: 'Dagsetning brottfarar',
}

const airlineStep = {
  title: 'Með hvaða flugfélagi flýgur þú?',
  subtitle: 'Veldu flugfélagið sem þú flýgur með',
  otherAirline: 'Annað flugfélag',
}

const airportStep = {
  title: 'Hvert ertu að fara?',
  subtitle: 'Veldu flugvöllinn sem þú lendir á',
  arrivalAirport: 'Áfangastaður',
  searchPlaceholder: 'Leita að flugvelli eða borg..',
  infoContainerText:
    'Fyrir tengiflug, vinsamlegast veljið fyrsta flugvöll sem flogið er til frá Keflavíkurflugvelli. Taskan verður þó innrituð skv. farþegabókun og skilar sér á áfangastað. ATH: Ekki er hægt að innrita farangur á flugi til Kanada enn sem komið er.',
}

const selectFlightStep = {
  title: 'Við höfum fundið flug sem passa!',
  subtitle: 'Veldu flugið þitt í listanum fyrir neðan',
  flightNumberText: 'Flugnúmer',
}

const bagSelectionStep = {
  title: 'Farangur',
  subtitle: 'Veldu fjölda af töskum og öðrum farangri hér fyrir neðan',
  luggageText: 'Töskur',
  oddSizeText: 'Töskur í umframstærð (odd-size) - T.d. golfsett, skíði, barnavagnar og hjólatöskur',
  priceText: 'Verð',
  totalBags: 'Töskufjöldi samtals:',
  submitButton: 'Næsta skref',
}

const pickUpStep = {
  title: 'Staður og tími',
  subtitle: 'Veldu tímaramma og heimilisfang',
  addressLabel: 'Heimilisfang eða hótel þar sem farangurinn verður sóttur',
  residentialTab: 'Heimilisfang',
  hotelLocationInputLabel: 'Á hvaða hóteli viltu að við sækjum töskurnar þínar?',
  residentialLocationInputLabel: 'Hvert viltu að við sækjum farangurinn á höfuðborgarsvæðinu?',
  pickUpTimeLabel: 'Veldu tímaramma sem hentar til að láta sækja farangurinn',
  morningPickUpGroupLabel: 'Morguntímarammar',
  eveningPickUpGroupLabel: 'Kvöldtímarammar',
  dayOfDeparture: 'Brottfaradagur',
  dayBeforeDeparture: 'Daginn fyrir brottför',
  pickUpInfoBox:
    'Daginn sem farangurinn er sóttur, færðu skilaboð með nákvæmari tímasetningu á því hvenær bílstjórinn mætir',
  ecoInfo: 'Minni akstur og vistvænni kostur',
  commentLabel:
    'Skilaboð til bílstjóra. T.d. númer íbúðar, hæð, bjalla, upplýsingar um aðkomu eða annað.',
  submitButton: 'Næsta skref',
  fullyBooked: 'Uppbókað',
  loadingAvailableTimes: 'Sæki lausa tímaramma...',
  errorLoadingAvailableTimes: 'Villa við að sækja lausa tímaramma',
}

const confirmOrderStep = {
  title: 'Staðfesta pöntun',
  subtitle: 'Vertu viss um að upplýsingarnar séu rétt slegnar inn',
  personalInformationTitle: 'Persónuupplýsingar',
  flightDetailsTitle: 'Flugupplýsingar',
  pickUpInfoTitle: 'Farangursupplýsingar',
  passengersInfoTitle: 'Farþegaupplýsingar',
  passengerInfoTitle: 'Farþegi',
  totalPriceText: 'Verð',
  submitButton: 'Greiða núna',
  pickUpItems: {
    location: 'Staðsetning',
    time: 'Tímarammi',
    date: 'Dagsetning',
  },
  discount: {
    iHaveDiscountCode: 'Ertu með afsláttarkóða?',
    iDontHaveDiscountCode: 'Ég er ekki með afsláttarkóða',
    discountCode: 'Afsláttarkóði',
    inputPlaceholder: 'Sláðu inn afsláttarkóða',
    apply: 'Virkja afsláttarkóða',
    discountCodeInvalid: 'Afsláttarkóði ógildur',
    errorValidatingDiscountCode: 'Villa við að sækja afsláttarkóða',
    discountCodeSuccessfullyAdded: 'Afsláttarkóði virkjaður. Afsláttur: ',
  },
}

const successStep = {
  // incomplete
  title: 'Pöntun fór í gegn!',
  bookingNumber: 'Bókunarnúmer',
  message:
    'Takk fyrir að panta hjá Bagbee! Við munum senda þér skilaboð þegar nær dregur, ef þú hefur einhverjar spurningar um þjónustu okkar getur þú alltaf haft samband í síma, í gegnum tölvupóst eða á spjallinu',
}

const cancelStep = {
  title: 'Greiðsla mistókst',
  message:
    'Eitthvað fór úrskeiðis við greiðsluna. Þú getur reynt aftur með pöntunina þína eða farið aftur á forsíðu og byrjað upp á nýtt.',
  retryButton: 'Reyna greiðslu aftur',
  backToBookingButton: 'Til baka að bókun',
  startOverButton: 'Byrja nýja bókun',
  retryError: 'Ekki tókst að ræsa greiðslu. Reyndu aftur eða hafðu samband við BagBee.',
  alreadyPaidNotice: 'Þessi pöntun hefur þegar verið greidd.',
}

const loadingScreen = {
  loadingFlightsText: 'Fetching flights',
  loadingOrderCompleteText: 'erum að klára pöntunina þína..',
}

const priceCalculator = {
  title: 'Töskufjöldi',
  landingPageCheckInButtonText: 'Bóka',
}
// error screen

const aboutPage = {
  contact: 'Hafa samband',
}

const giftcardPage = {
  title: 'Gjafabréf með Bagbee',
  paragraph1:
    'Gjafabréf hjá BagBee er tilvalin gjöf fyrir ferðalanga sem kunna að meta þægindin sem því fylgir að innrita farangurinn með BagBee og sleppa þannig við töskuburðinn og innritunarröðina',
  buttonText: 'Kaupa gjafabréf',
}

const orderTrackingPage = {
  // Page title
  orderLabel: 'Pöntun',

  // Service types
  departureService: 'Innritunarþjónusta',
  arrivalService: 'Komuþjónusta',

  // Status names
  status: {
    Pending: 'Í bið',
    Confirmed: 'Staðfest',
    Planned: 'Skipulagt',
    'In Progress': 'Í gangi',
    Delivered: 'Afhent',
  },

  // 404 page
  notFoundTitle: '404',
  notFoundText:
    'Pöntun #{orderNo} fannst ekki. Vinsamlegast athugaðu pöntunarnúmerið og reyndu aftur.',

  // Sections
  orderDetailsTitle: 'Pöntunarupplýsingar',
  estimatedPickupTitle: 'Áætluð tímasetning',
  pickupLocationTitle: 'Sóknarstaður',
  deliveryLocationTitle: 'Afhendingarstaður',
  yourBagsTitle: 'Töskurnar þínar',

  // Detail labels
  service: 'Þjónusta',
  flight: 'Flug',
  flightDate: 'Dagsetning flugs',
  pickupDate: 'Dagsetning pick-up',
  airline: 'Flugfélag',
  bags: 'Töskur',
  pickupWindow: 'Tímasetning',
  deliveryWindow: 'Afhendingartími',
  customer: 'Viðskiptavinur',
  phone: 'Sími',
  address: 'Heimilisfang',
  addressLabel: 'Sóknarstaður',
  standardSuffix: 'venjulegar',
  oddSizeSuffix: 'yfirstærð',
  totalSuffix: 'samtals',

  // Estimated pickup card
  pickupBetween: 'Töskurnar þínar verða sóttar á tímabilinu',
  pickupEstimateNote: 'Þetta er áætlun (\u00b110 mínútur)',

  // Bag photos
  noBagPhotos: 'Engar töskumyndir tiltækar enn sem komið er.',

  // Edit section
  editOrder: 'Breyta pöntun',
  editOrderDescription: 'Breyttu sóknartíma, heimilisfangi eða fjölda taska.',
  updateYourOrder: 'Uppfæra pöntun',
  standardBags: 'Venjulegar töskur',
  oddSizeBags: 'Töskur í yfirstærð',
  selectPickupTimeWindow: 'Veldu tímasetningu:',
  morningLabel: 'Morgun (09:00 - 12:00)',
  eveningLabel: 'Kvöld (17:00 - 22:00)',
  selected: 'Valið',

  // Surcharge
  surcharge: 'Aukagjald:',
  extraBag: 'aukatöskur',
  extraBags: 'aukatöskur',
  extraOddSize: 'aukatöskur í yfirstærð',

  // Buttons
  saveChanges: 'Vista breytingar',
  processing: 'Vinnur...',
  payAndUpdate: 'Greiða {amount} kr og uppfæra',
  freeTimeWindow: 'Breyting á tímasetningu er ókeypis.',

  // Messages
  changesSaved: 'Breytingarnar þínar hafa verið vistaðar. Þú færð uppfærða staðfestingu.',
  paymentSuccess:
    'Greiðsla tókst! Pöntunin þín hefur verið uppfærð og þú færð uppfærða staðfestingu.',
  paymentError: 'Greiðsla mistókst. Vinsamlegast reyndu aftur eða hafðu samband við BagBee.',

  // Fast-Track
  fastTrackTitle: 'Fast-Track á flugið þitt',
  fastTrackDescription:
    'Slepptu biðröðinni við öryggisleit. 2.490 kr á farþega.',
  fastTrackOpenButton: 'Panta Fast-Track',
  fastTrackSectionTitle: 'Bæta við Fast-Track',
  fastTrackPassenger: 'Farþegi',
  fastTrackMainPassenger: 'Aðalfarþegi',
  fastTrackFirstName: 'Fornafn',
  fastTrackLastName: 'Eftirnafn',
  fastTrackAddPassenger: '+ Bæta við farþega',
  fastTrackRemovePassenger: 'Fjarlægja',
  fastTrackTotal: 'Samtals',
  fastTrackPay: 'Greiða {amount} kr',
  fastTrackProcessing: 'Vinnur...',
  fastTrackCancel: 'Hætta við',
  fastTrackSuccess:
    'Fast-Track kaupin tókust! Þú munt fá staðfestingarpóst fljótlega.',
  fastTrackError:
    'Fast-Track greiðsla mistókst. Vinsamlegast reyndu aftur eða hafðu samband við BagBee.',
  fastTrackMaxPassengers: 'Hámark 4 farþegar á hverja Fast-Track pöntun.',

  // Cancel order
  cancelOrder: {
    linkText: 'Hætta við pöntun',
    confirmTitle: 'Hætta við þessa pöntun?',
    confirmBody: (amount: string) =>
      `Þú færð fulla endurgreiðslu upp á ${amount} kr. á sömu greiðslukort. Það getur tekið nokkrar mínútur að birtast. Ekki er hægt að afturkalla þessa aðgerð.`,
    confirmButton: 'Já, hætta við og endurgreiða',
    keepButton: 'Halda pöntun',
    cancelling: 'Hætti við…',
    doneTitle: 'Pöntun hætt við',
    successRefunded:
      'Pöntuninni þinni hefur verið hætt við og upphæðin endurgreidd að fullu. Það gæti tekið nokkra virka daga að birtast á yfirlitinu þínu.',
    successPartial:
      'Pöntuninni var hætt við, en ekki tókst að endurgreiða að fullu sjálfkrafa. BagBee hefur samband til að ljúka endurgreiðslu.',
    successNoPayments:
      'Pöntuninni hefur verið hætt við. Engin greiðsla var skráð, svo engin endurgreiðsla þarf að fara fram.',
    error:
      'Ekki tókst að hætta við pöntun. Vinsamlegast reyndu aftur eða hafðu samband við BagBee.',
    close: 'Loka',
  },

  // Tip (English-only feature, but keys mirrored here so TS type is consistent)
  tipTitle: '',
  tipSubtext: '',
  tipPresetLabel: '',
  tipCustomLabel: '',
  tipSubmit: '',
  tipSubmitGeneric: '',
  tipProcessing: '',
  tipSuccess: '',
  tipError: '',
}

const is = {
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
export default is
