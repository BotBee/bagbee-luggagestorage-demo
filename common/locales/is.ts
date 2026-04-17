const common = {
  backButtonText: 'Til baka',
}

const navbar = {
  why: 'Afhverju BagBee?',
  howItWorks: 'Hvernig virkar þetta',
  prices: 'Verð',
  FAQ: 'FAQ',
  contact: 'Hafa samband',
  home: 'Heim',
  about: 'Um okkur',
  giftCertificates: 'Gjafabréf',
}
const footer = {
  linksHeading: 'Hlekkir',
  contactHeading: 'Tengjumst',
  addressHeading: 'Heimilisfang',
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
}

const airportStep = {
  title: 'Hvert ertu að fara?',
  subtitle: 'Veldu flugvöllinn sem þú lendir á',
  arrivalAirport: 'Komustaður',
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
  oddSizeText:
    'Töskur í umframstærð (odd-size) - T.d. golfsett, skíði, barnavagnar og hjólatöskur',
  priceText: 'Verð',
  totalBags: 'Töskufjöldi samtals:',
  submitButton: 'Næsta skref',
  infoBanner:
    'Fyrir Icelandair: Barnavagnar og bílstólar þurfa að vera hluti af keyptri farangursheimild. Skíðaklossapokar þurfa sér farangursheimild.',
}

const pickUpStep = {
  title: 'Staður og tími',
  subtitle: 'Veldu tímaramma og heimilisfang',
  addressLabel: 'Heimilisfang eða hótel þar sem farangurinn verður sóttur',
  residentialTab: 'Heimilisfang',
  hotelLocationInputLabel:
    'Á hvaða hóteli viltu að við sækjum töskurnar þínar?',
  residentialLocationInputLabel:
    'Hvert viltu að við sækjum farangurinn á höfuðborgarsvæðinu?',
  pickUpTimeLabel: 'Stilltu hvenær hægt er að sækja farangurinn',
  morningPickUpGroupLabel: 'Morguntímarammar',
  eveningPickUpGroupLabel: 'Kvöldtímarammar',
  dayOfDeparture: 'Brottfaradagur',
  dayBeforeDeparture: 'Daginn fyrir brottför',
  pickUpInfoBox:
    'Dragðu sleðann til að merkja hvenær þú ert ekki laus. BagBee sækir farangurinn á þeim tíma sem eftir stendur.',
  ecoInfo: 'Minni akstur og vistvænni kostur',
  commentLabel:
    'Skilaboð til bílstjóra. T.d. númer íbúðar, hæð, bjalla, upplýsingar um aðkomu eða annað.',
  submitButton: 'Næsta skref',
}

const confirmOrderStep = {
  title: 'Staðfesta pöntun',
  subtitle: 'Vertu viss um að upplýsingarnar séu rétt slegnar inn',
  personalInformationTitle: 'Persónuupplýsingar',
  flightDetailsTitle: 'Flugupplýsingar',
  pickUpInfoTitle: 'Farangursupplýsingar',
  totalPriceText: 'Verð',
  submitButton: 'Greiða núna',
  pickUpItems: {
    location: 'Staðsetning',
    time: 'Tímarammi',
    date: 'Dagsetning',
  },
  discount: {
    discountCode: 'Afsláttarkóði',
    inputPlaceholder: 'Sláðu inn afsláttarkóða',
    apply: 'Virkja afsláttarkóða',
  },
}

const successStep = {
  // incomplete
  title: 'Pöntun fór í gegn!',
  bookingNumber: 'Bókunarnúmer',
  message:
    'Takk fyrir að panta hjá Bagbee! Við munum senda þér skilaboð þegar nær dregur, ef þú hefur einhverjar spurningar um þjónustu okkar getur þú alltaf haft samband í síma, í gegnum tölvupóst eða á spjallinu',
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
  title: 'Gjafabréf á þægindi',
  paragraph1:
    'Gjafabréf BagBee er tilvalin gjöf fyrir ferðalanga sem kunna að meta þægindin sem því fylgir að innrita farangurinn með BagBee. Þau eru á viðráðanlegu verði eða 6.000 kr. og innifalið í því er innritun á allt að fjórum töskum. Afslátturinn nemur því allt að 45% miðað við venjulegt verð.',
  paragraph2:
    'Gjafabréfin eru annaðhvort rafræn eða á pappír. Rafræn gjafabréf afhendast í tölvupósti en gjafabréf á pappír verða send heim í pósti. Til að panta gjafabréf þarf einfaldlega að senda okkur tölvupóst í gegnum hnappinn að neðan með upplýsingum um fjölda gjafabréfa. Við sendum þá greiðsluhlekk til þín og greiðslan er framkvæmd með greiðslukorti. ',
  buttonText: 'Panta gjafabréf',
}

// Arrival service locales
const arrivalDateStep = {
  title: 'Hvenær lendir þú á Íslandi?',
  subtitle: 'Veldu komudagsetningu',
}

const arrivalAirportStep = {
  title: 'Hvaðan kemur þú?',
  subtitle: 'Veldu brottfararflugvöll',
  searchPlaceholder: 'Leitaðu að flugvelli eða borg..',
}

const arrivalFlightStep = {
  title: 'Veldu komuflugið þitt',
  subtitle: 'Vinsamlegast veldu flugið þitt úr listanum',
}

const arrivalBagStep = {
  title: 'Hversu margar töskur ertu með?',
  subtitle: 'Veldu fjölda taska sem við eigum að sækja við komu',
}

const arrivalDeliveryStep = {
  title: 'Hvert eigum við að koma með töskurnar?',
  subtitle: 'Við komum með töskurnar á hótelið þitt eða heimilisfang',
  addressLabel: 'Hótel eða heimilisfang',
  meetingPointCustoms:
    'Við mætum þig rétt fyrir utan tollgáttina með BagBee skilti',
  meetingPointTruck:
    'Fyrir stærri hópa mætum við þig við farangursbílinn fyrir utan flugstöðina',
  commentLabel: 'Sérstakar leiðbeiningar um afhendingu (valfrjálst)',
  submitButton: 'Næsta skref',
}

const arrivalConfirmStep = {
  title: 'Staðfestu komuþjónustu',
  subtitle: 'Vertu viss um að upplýsingarnar séu réttar',
  flightDetailsTitle: 'Komuflug',
  deliveryTitle: 'Afhendingarupplýsingar',
  meetingPointLabel: 'Mæting',
  deliveryWindowLabel: 'Afhendingartími',
  deliveryAddressLabel: 'Afhendingarstaður',
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
  changesSaved:
    'Breytingarnar þínar hafa verið vistaðar. Þú færð uppfærða staðfestingu.',
  paymentSuccess:
    'Greiðsla tókst! Pöntunin þín hefur verið uppfærð og þú færð uppfærða staðfestingu.',
  paymentError:
    'Greiðsla mistókst. Vinsamlegast reyndu aftur eða hafðu samband við BagBee.',
}

const is = {
  common,
  navbar,
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
  arrivalDateStep,
  arrivalAirportStep,
  arrivalFlightStep,
  arrivalBagStep,
  arrivalDeliveryStep,
  arrivalConfirmStep,
  orderTrackingPage,
}

// eslint-disable-next-line import/no-anonymous-default-export
export default is
