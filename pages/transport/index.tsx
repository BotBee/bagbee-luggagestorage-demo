import styled from '@emotion/styled'
import { keyframes } from '@emotion/react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { NextSeo } from 'next-seo'
import { ChangeEvent, useMemo, useState } from 'react'

import type { KefAvailability } from '../../common/transportTypes'

import Button from '../../components/button/Button'
import BackButton from '../../components/form/back-button/BackButton'
import PlaceAutocompleteInput from '../../components/form/place-autocomplete-input/PlaceAutocompleteInput'
import Select from '../../components/form/select/Select'
import TextInput from '../../components/form/text-input/TextInput'
import FlightLookup from '../../components/transport/FlightLookup'
import TransportCalendar from '../../components/transport/TransportCalendar'
import Logo from '../../public/icons/Logo'

import {
  TransportLocation,
  Locale,
} from '../../common/transportTypes'
import {
  BSI_AFTER_HOURS_SLOT,
  deliveryLocationOptions,
  findLocation,
  minSameDayDeliveryHour,
  pickupLocationOptions,
  timeSlotOptionsForLocation,
} from '../../common/transportConstants'
import {
  calculateTransportPrice,
  defaultPricingContext,
} from '../../utils/transportPricing'
import { useTransportStore } from '../../store/transportStore'
import {
  mapTransportToOrder,
  mapTransportToPayment,
} from '../../common/transportMapper'

// ---------------------------------------------------------------------------
// Copy — kept inline for v1; will move to common/locales/{en,is}.ts in a
// follow-up so the rest of the site stays consistent. Keys are scoped under
// `transport` so future locale-file extraction is mechanical.
// ---------------------------------------------------------------------------
const COPY = {
  en: {
    seoTitle: 'BagBee | Transport & Storage',
    title: 'Transport & Storage',
    subtitle:
      'Door-to-door luggage transport across the capital area, the airport and the cruise terminals.',
    sections: {
      dates: 'When?',
      bags: 'How many bags?',
      pickup: 'Pick-up',
      delivery: 'Delivery',
      contact: 'Your details',
      summary: 'Summary',
    },
    fields: {
      pickupDate: 'Pick-up date',
      deliveryDate: 'Delivery date',
      selectDate: 'Select date',
      bsiLockerNote:
        'After 17:00 the BSÍ counter is closed. We’ll email you a PIN code and the locker number so you can drop off / pick up your luggage at the BSÍ luggage lockers any time.',
      bsiOpeningHoursNote:
        'Our counter is inside BSÍ next to the Flybus desk. Staffed daily 06:45 – 17:00.',
      timeWindow: 'Time window',
      kefPickupHintArrival:
        'A BagBee driver will already be at KEF for one of our Pickup & Delivery runs that day. They’ll be outside arrivals with a luggage truck — we’ll email the exact spot, the driver’s phone number, and a photo a few hours before you land. Just walk over and hand off your bags.',
      // {collection} is replaced at render time with the specific run
      // (noon vs 22:00) we'll empty the locker on, based on the customer's
      // landing hour. Keeps the message concrete instead of "noon or 22:00".
      kefPickupHintLockerTemplate:
        'Drop your bags in one of our two locked compartments at The Bike Pit, just outside the arrivals terminal. We’ll email you the PIN code and locker number a few hours before you land. We’ll collect them on our {collection} run and handle them according to your order from there.',
      kefPickupHintLockerNoon: 'noon',
      kefPickupHintLockerEvening: '22:00',
      kefPickupHintLockerNextNoon: 'noon (the day after)',
      kefPickupHintUnavailable:
        'KEF pickup is fully booked for this date. Email us at bagbee@bagbee.is and we’ll see what we can arrange.',
      kefPickupHintLoading: 'Checking KEF availability for that date…',
      kefPickupHintNeedFlight:
        'Enter your flight number above to see whether you can hand off to a driver or drop in the lockers.',
      kefDeliveryHint:
        'We’ll have your bags at KEF inside this window so you have time to check in. Exact drop-off point and contact details land in your booking email.',
      bagsCount: 'Number of bags',
      location: 'Location',
      time: 'Time window',
      street: 'Street name and number',
      zip: 'Zip / postal code',
      hotelName: 'Hotel name',
      flightNumberArrival: 'Arrival flight number',
      flightNumberDeparture: 'Departure flight number',
      cruiseShip: 'Name of cruise ship',
      outsideHoursPickup: 'Pick-up outside daytime opening hours?',
      outsideHoursDelivery: 'Delivery outside daytime opening hours?',
      leaveAtReceptionPickup: 'I will leave the luggage at the hotel reception',
      leaveAtReceptionDelivery: 'BagBee can leave the luggage at the hotel reception',
      name: 'Full name',
      bookingForCompany: 'Booking for a company',
      email: 'Email',
      phone: 'Phone number',
      kennitala: 'Kennitala / company ID',
      comments: 'Comments (optional)',
    },
    placeholders: {
      chooseLocation: 'Choose a location',
      chooseTime: 'Choose a time window',
      bags: '3',
      street: '101 Hotel',
      zip: '101',
      hotelName: '101 Hotel',
      flight: 'FI544',
      cruise: 'MS Sample',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+354 ...',
      kennitala: '0101011010',
    },
    summary: {
      bags: 'Bags',
      days: 'Storage days',
      subtotal: 'Subtotal',
      discount: 'Bulk discount (10%)',
      total: 'Total',
      vatNote: 'Prices include 24% VAT.',
      vatPortion: 'VAT included',
    },
    submit: 'Proceed to payment',
    notReady: 'Fill in pick-up, delivery, dates and bags to see your price.',
  },
  is: {
    seoTitle: 'BagBee | Töskuflutningur og geymsla',
    title: 'Töskuflutningur og geymsla',
    subtitle:
      'Sækjum og afhendum töskur á höfuðborgarsvæðinu, flugvellinum og skemmtiferðaskipum.',
    sections: {
      dates: 'Hvenær?',
      bags: 'Hversu margar töskur?',
      pickup: 'Sótt',
      delivery: 'Afhent',
      contact: 'Þínar upplýsingar',
      summary: 'Yfirlit',
    },
    fields: {
      pickupDate: 'Dagsetning sótt',
      deliveryDate: 'Dagsetning afhent',
      selectDate: 'Veldu dagsetningu',
      bsiLockerNote:
        'Eftir kl. 17:00 er afgreiðsla á BSÍ lokuð. Við sendum þér PIN-númer og lyklageymslunúmer í tölvupósti svo þú getur skilið eftir / sótt töskurnar í lyklageymslunni á BSÍ á þeim tíma sem hentar.',
      bsiOpeningHoursNote:
        'Afgreiðsla okkar er inni á BSÍ við hliðina á Flybus borðinu. Opin daglega 06:45 – 17:00.',
      timeWindow: 'Tímabil',
      kefPickupHintArrival:
        'BagBee bílstjóri verður á KEF í einni af Pickup & Delivery ferðunum okkar þennan dag. Hann bíður fyrir utan komusalinn með farangurskerru — við sendum nákvæma staðsetningu, símanúmer og mynd í tölvupósti nokkrum tímum áður en þú lendir. Gakktu beint að honum og afhentu töskurnar.',
      kefPickupHintLockerTemplate:
        'Skildu töskurnar eftir í annarri af tveimur lyklageymslum okkar við The Bike Pit, rétt fyrir utan komusalinn. Við sendum þér PIN-númer og lyklageymslunúmer í tölvupósti nokkrum tímum áður en þú lendir. Við sækjum þær á {collection} ferð okkar og afgreiðum þær samkvæmt pöntuninni þaðan.',
      kefPickupHintLockerNoon: 'hádegis',
      kefPickupHintLockerEvening: '22:00',
      kefPickupHintLockerNextNoon: 'hádegis (daginn eftir)',
      kefPickupHintUnavailable:
        'KEF sókn er fullbókuð á þessari dagsetningu. Sendu okkur tölvupóst á bagbee@bagbee.is og við athugum hvað við getum gert.',
      kefPickupHintLoading: 'Athuga KEF-aðgengi fyrir þessa dagsetningu…',
      kefPickupHintNeedFlight:
        'Sláðu inn flugnúmer hér að ofan til að sjá hvort þú getur afhent bílstjóra eða notað lyklageymslu.',
      kefDeliveryHint:
        'Töskurnar þínar verða á KEF innan þessa tímabils svo þú hefur tíma til að innrita þig. Nákvæm staðsetning og samskiptaupplýsingar fylgja með í bókunarpóstinum.',
      bagsCount: 'Fjöldi taska',
      location: 'Staðsetning',
      time: 'Tímabil',
      street: 'Götuheiti og númer',
      zip: 'Póstnúmer',
      hotelName: 'Nafn hótels',
      flightNumberArrival: 'Komuflugnúmer',
      flightNumberDeparture: 'Brottfararflugnúmer',
      cruiseShip: 'Nafn skemmtiferðaskips',
      outsideHoursPickup: 'Sækja utan opnunartíma?',
      outsideHoursDelivery: 'Afhenda utan opnunartíma?',
      leaveAtReceptionPickup: 'Ég skil töskurnar eftir í móttöku hótelsins',
      leaveAtReceptionDelivery: 'BagBee má skilja töskurnar eftir í móttöku hótelsins',
      name: 'Fullt nafn',
      bookingForCompany: 'Bóka fyrir fyrirtæki',
      email: 'Netfang',
      phone: 'Símanúmer',
      kennitala: 'Kennitala / fyrirtækisnúmer',
      comments: 'Athugasemdir (valfrjálst)',
    },
    placeholders: {
      chooseLocation: 'Veldu staðsetningu',
      chooseTime: 'Veldu tímabil',
      bags: '3',
      street: '101 Hotel',
      zip: '101',
      hotelName: '101 Hotel',
      flight: 'FI544',
      cruise: 'MS Sample',
      name: 'Jón Jónsson',
      email: 'jon@example.com',
      phone: '+354 ...',
      kennitala: '0101011010',
    },
    summary: {
      bags: 'Töskur',
      days: 'Geymsludagar',
      subtotal: 'Millisamtals',
      discount: 'Magnafsláttur (10%)',
      total: 'Samtals',
      vatNote: 'Verð inniheldur 24% vsk.',
      vatPortion: 'Vsk innifalið',
    },
    submit: 'Áfram að greiðslu',
    notReady: 'Veldu sótt, afhent, dagsetningar og fjölda taska til að sjá verð.',
  },
}

// ---------------------------------------------------------------------------
// Styled components — Emotion, matching the existing BagBee design tokens
// (Poppins font, gray-blue subtitles, yellow → orange CTA via <Button>).
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Layout — single page, two columns on desktop. Compact spacings throughout
// (this is a one-page flow, no need for the airy multi-step look used in
// /book/). Form on the left, sticky live-price sidebar on the right.
// ---------------------------------------------------------------------------
const PageContainer = styled.div`
  padding: 16px 20px 80px;
  background: #f7f8fa;
  min-height: 100vh;
`

const TopBar = styled.div`
  max-width: 1180px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`

const HeaderBlock = styled.header`
  max-width: 1180px;
  margin: 0 auto 20px;
`

const Title = styled.h1`
  font-family: 'Poppins';
  font-weight: 700;
  font-size: 26px;
  line-height: 32px;
  margin: 0 0 6px 0;
  color: #0b0f1a;
  @media (min-width: 720px) {
    font-size: 30px;
    line-height: 36px;
  }
`

const Subtitle = styled.p`
  font-family: 'Poppins';
  font-weight: 400;
  font-size: 15px;
  line-height: 22px;
  color: #6b7280;
  margin: 0;
`

const PageGrid = styled.div`
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  gap: 20px;
  grid-template-columns: 1fr;
  @media (min-width: 960px) {
    grid-template-columns: minmax(0, 1fr) 340px;
    align-items: start;
  }
`

const SectionsGrid = styled.div`
  display: grid;
  gap: 16px;
`

const Section = styled.section`
  display: grid;
  gap: 12px;
  padding: 18px 20px;
  border: 1px solid #e6e9ee;
  border-radius: 10px;
  background: #ffffff;
`

const SectionTitle = styled.h2`
  font-family: 'Poppins';
  font-weight: 600;
  font-size: 17px;
  line-height: 22px;
  margin: 0;
  color: #12141d;
`

const FieldGrid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
  @media (min-width: 640px) {
    grid-template-columns: 1fr 1fr;
  }
`

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: 'Poppins';
  font-size: 13px;
  color: #4a5260;
`

const ToggleRow = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Poppins';
  font-size: 14px;
  color: #12141d;
  cursor: pointer;
  user-select: none;
`

const TextArea = styled.textarea`
  font-family: 'Poppins';
  font-size: 14px;
  line-height: 20px;
  padding: 10px 14px;
  border: 1px solid #c8cdd6;
  border-radius: 8px;
  min-height: 60px;
  resize: vertical;
  color: #12141d;
  &:focus {
    background: #ffffff;
    box-shadow: 0px 4px 10px 3px rgba(0, 0, 0, 0.08);
    outline: none;
  }
`

// Slide-in animation for the sidebar on desktop. Subtle — 200ms ease-out
// from 12px to the right, opacity 0 → 1. The user called this the
// "side sliding thing"; this is what makes it feel anchored.
const slideInRight = keyframes`
  from {
    transform: translateX(12px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`

const Sidebar = styled.aside`
  display: grid;
  gap: 12px;
  @media (min-width: 960px) {
    position: sticky;
    top: 20px;
    align-self: start;
    animation: ${slideInRight} 0.28s ease-out;
  }
`

const SummaryCard = styled(Section)`
  background: #fff8ec;
  border-color: #f4d199;
  padding: 16px 18px;
`

const SummaryRow = styled.div<{ $emphasize?: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  font-family: 'Poppins';
  font-weight: ${({ $emphasize }) => ($emphasize ? 700 : 400)};
  font-size: ${({ $emphasize }) => ($emphasize ? '18px' : '14px')};
  color: ${({ $emphasize }) => ($emphasize ? '#0b0f1a' : '#3c4253')};
  padding: ${({ $emphasize }) => ($emphasize ? '10px 0 0' : '0')};
  border-top: ${({ $emphasize }) => ($emphasize ? '1px solid #f0d49a' : 'none')};
`

const SummaryNote = styled.p`
  font-family: 'Poppins';
  font-size: 12px;
  color: #6b7280;
  margin: 4px 0 0 0;
  line-height: 16px;
`

const SubmitWrap = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 8px;
  button {
    /* The Button component pads 12px 80px by default — too wide for the
       sidebar. Tighten it to fit. */
    padding: 12px 24px;
    min-width: 0;
    width: 100%;
  }
`

const DateChipsRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`

const DateChip = styled.div`
  border: 1px solid #e9ecf0;
  border-radius: 10px;
  padding: 10px 14px;
  background: #fafafa;
`

const DateChipLabel = styled.div`
  font-family: 'Poppins';
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
`

// $ prefix marks this as a "transient prop" — Emotion (and styled-components)
// strip these before forwarding to the DOM, preventing the
// "Received `true` for a non-boolean attribute `placeholder`" warning that
// otherwise fires on every render (and noisily clogs the console).
const DateChipValue = styled.div<{ $placeholder?: boolean }>`
  font-family: 'Poppins';
  font-size: 15px;
  font-weight: ${({ $placeholder }) => ($placeholder ? 400 : 600)};
  color: ${({ $placeholder }) => ($placeholder ? '#9CA3AF' : '#12141d')};
`

const BagStepper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 6px 10px;
`

const StepperButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid ${({ theme, disabled }) =>
    disabled ? '#F4D199' : theme.colors.yellow};
  background: white;
  color: ${({ theme, disabled }) =>
    disabled ? '#F4D199' : theme.colors.yellow};
  font-family: 'Poppins';
  font-size: 18px;
  font-weight: 500;
  line-height: 1;
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  &:hover {
    background: ${({ disabled }) =>
      disabled ? 'white' : '#FFF8EC'};
  }
`

const RequiredMark = styled.span`
  color: #c25400;
  font-weight: 600;
`

const KefWindowChip = styled.div`
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #f3f7f4;
  border: 1px solid #cde2d5;
  font-family: 'Poppins';
`

const KefWindowLabel = styled.div`
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #4a5260;
`

const KefWindowValue = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: #0b0f1a;
`

const KefWindowHint = styled.div`
  font-size: 12px;
  color: #4a5260;
  line-height: 16px;
  margin-top: 4px;
`

// Calmer blue-grey info note for BSI counter hours. Shown whenever BSÍ is
// the selected leg — separate from BsiLockerNote (yellow/warn) which only
// fires for the after-hours locker slot.
const BsiInfoNote = styled.div`
  display: flex;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #eef3f8;
  border: 1px solid #cdd9e5;
  font-family: 'Poppins';
  font-size: 13px;
  line-height: 18px;
  color: #1f3a5f;
`

const BsiLockerNote = styled.div`
  display: flex;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #fff8eb;
  border: 1px solid #f4d199;
  font-family: 'Poppins';
  font-size: 13px;
  line-height: 18px;
  color: #7a5400;
`

const SubmitErrorNote = styled.div`
  font-family: 'Poppins';
  font-size: 13px;
  color: #b91c1c;
  background: #fee2e2;
  border: 1px solid #fecaca;
  padding: 10px 12px;
  border-radius: 8px;
`

const StepperValue = styled.span`
  font-family: 'Poppins';
  font-weight: 700;
  font-size: 22px;
  min-width: 28px;
  text-align: center;
  color: #12141d;
`

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const TransportPage = () => {
  const router = useRouter()
  const localeRaw = router.locale ?? 'en'
  const locale: Locale = localeRaw === 'is' ? 'is' : 'en'
  const t = COPY[locale]

  const booking = useTransportStore((s) => s.booking)
  const setBooking = useTransportStore((s) => s.setBooking)
  const setPickupAddress = useTransportStore((s) => s.setPickupAddress)
  const setDeliveryAddress = useTransportStore((s) => s.setDeliveryAddress)
  const setCustomer = useTransportStore((s) => s.setCustomer)

  // Live price — recalculated on every render. Engine is pure + cheap.
  const breakdown = useMemo(
    () => calculateTransportPrice(booking, defaultPricingContext()),
    [booking],
  )

  const pickupMeta = findLocation(booking.pickupLocation)
  const deliveryMeta = findLocation(booking.deliveryLocation)

  // KEF pickup availability lookup. Returns the day's existing driver
  // windows at KEF + locker capacity info. The page combines this with
  // the customer's flight landing time to resolve the final mode:
  //   - landing overlaps an existing driver window → 'pickup-delivery'
  //   - else if summer + lockers available           → 'locker'
  //   - else                                         → 'unavailable'
  // The query only fires once the customer has picked KEF for pickup AND
  // chosen a date — there's no answer to compute before then.
  const kefPickupAvailability = useQuery<KefAvailability>({
    queryKey: ['kef-availability', booking.pickupDate],
    queryFn: async () => {
      const r = await fetch(
        `/api/transport/kef-availability?date=${booking.pickupDate}`,
      )
      if (!r.ok) throw new Error('availability lookup failed')
      return r.json()
    },
    enabled:
      booking.pickupLocation === 'kef-airport' && !!booking.pickupDate,
    staleTime: 5 * 60 * 1000,
  })

  // Resolve the pickup mode using both the availability response and the
  // customer's landing time. We extract the landing HH:MM from
  // booking.pickupTime (which FlightLookup's onMatch wrote as
  // 'HH:MM - HH:MM'), convert to a decimal hour, then check for overlap
  // against the driver windows. Overlap = customer's 3-hour window
  // intersects the driver's window. Tolerates the (+1d) / (-1d) tags by
  // ignoring them — we already compute the customer's window as 3h after
  // landing, so we only need the landing hour itself.
  //
  // Locker availability is year-round (not just summer). Off-season we
  // simply don't have driver-meets-customer runs to bundle with, so the
  // mode falls through to locker as long as a locker is free.
  const resolveKefPickupMode = (): 'pickup-delivery' | 'locker' | 'unavailable' | null => {
    const data = kefPickupAvailability.data
    if (!data) return null
    if (!booking.pickupTime) return null
    const m = /^(\d{1,2}):(\d{2})/.exec(booking.pickupTime)
    if (!m) return null
    const landingHour = parseInt(m[1], 10) + parseInt(m[2], 10) / 60
    const customerWindowEnd = landingHour + 3
    const overlapsDriver = data.driverWindows.some((w) => {
      // Standard interval overlap: [a1, a2] and [b1, b2] overlap when
      // a1 < b2 AND a2 > b1. Any overlap means the driver is at arrivals
      // when the customer is, so they can hand bags off directly.
      return landingHour < w.endHour && customerWindowEnd > w.startHour
    })
    if (overlapsDriver) return 'pickup-delivery'
    // Lockers run year-round. Only 'unavailable' when both lockers are
    // already booked for this date — then the customer needs to contact us.
    if (data.lockersInUse < data.lockerCapacity) return 'locker'
    return 'unavailable'
  }
  const kefPickupMode = resolveKefPickupMode()

  const formatISK = (n: number) =>
    n.toLocaleString(locale === 'is' ? 'is-IS' : 'en-US') + ' ISK'

  // Submit button is disabled until the basics are filled. Full server-side
  // validation in /api/transport/create is the source of truth — this client
  // check just keeps the customer from POSTing a payload that will obviously
  // bounce back.
  const kefPickupNeedsFlight =
    booking.pickupLocation === 'kef-airport' && !booking.pickupFlightNumber.trim()
  const kefDeliveryNeedsFlight =
    booking.deliveryLocation === 'kef-airport' && !booking.deliveryFlightNumber.trim()
  // Format checks — same shape the server applies so client + server agree.
  // Email: minimal '.+@.+\..+' check; production validation is at Rapyd/SMTP.
  // Phone: loose check for "has at least 7 digits". Full E.164 validation
  // happens server-side via libphonenumber-js; we don't want to ship that
  // bundle to the client just for the submit gate.
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    (booking.customer.email || '').trim(),
  )
  const phoneLooksValid = (booking.customer.phoneNumber.match(/\d/g) || []).length >= 7
  // 'unavailable' KEF mode blocks submit: there's no driver and no locker
  // available. Customer should email us instead.
  const kefUnavailable =
    booking.pickupLocation === 'kef-airport' && kefPickupMode === 'unavailable'
  const submitDisabled =
    !booking.pickupLocation ||
    !booking.deliveryLocation ||
    !booking.pickupDate ||
    !booking.deliveryDate ||
    !booking.pickupTime ||
    !booking.deliveryTime ||
    booking.bagsCount < 1 ||
    !booking.customer.name ||
    !booking.customer.email ||
    !emailLooksValid ||
    !phoneLooksValid ||
    kefPickupNeedsFlight ||
    kefDeliveryNeedsFlight ||
    kefUnavailable ||
    breakdown.total <= 0

  // Local submission state — disables the button + shows a spinner while
  // the create + payment-init round trip is in flight. Kept simple (no
  // react-hook-form for v1) since this is a single submit button.
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      // 1. Write the booking to Airtable as Ógreitt (unpaid). Server-side
      //    validation rejects past dates / missing required fields and
      //    surfaces the message back to the customer.
      const orderPayload = mapTransportToOrder(booking, breakdown, locale, document.referrer)
      // Envelope: pass structured zips so the server postcode-service check
      // doesn't have to regex them out of the concatenated address string.
      const createRes = await fetch('/api/transport/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          order: orderPayload,
          pickupZip: booking.pickupAddress.zip,
          deliveryZip: booking.deliveryAddress.zip,
        }),
      })
      const created = await createRes.json()
      if (!createRes.ok || !created?.id) {
        const msg = created?.message || 'Could not create your booking. Please try again.'
        setSubmitError(msg)
        return
      }

      // 2. Hand off to Rapyd. /api/rapyd creates the hosted checkout and
      //    returns the URL we redirect the customer to.
      const rapydPayload = mapTransportToPayment(
        created.id,
        breakdown.total,
        locale,
        window.location.host,
      )
      const rapydRes = await fetch('/api/rapyd', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(rapydPayload),
      })
      const rapydJson = await rapydRes.json()
      const redirectUrl = rapydJson?.body?.data?.redirect_url
      if (!redirectUrl) {
        console.error('[transport] no Rapyd redirect URL', rapydJson)
        setSubmitError(
          locale === 'is'
            ? 'Ekki tókst að opna greiðslusíðu. Reyndu aftur.'
            : 'Could not open the payment page. Please try again.',
        )
        return
      }
      // 3. Send the customer to Rapyd. On success Rapyd will redirect to
      //    /<locale>/orders/<last5>?paid=true (set in complete_payment_url)
      //    and the webhook at /api/payment/webhooks marks the row Greitt +
      //    fires the Payday invoice if a Kennitala is present.
      //
      //    On failure / customer-cancels, Rapyd redirects to /payment/cancel
      //    (we set `cancel_checkout_url` + `&service=transport` in
      //    mapTransportToPayment). That page reads the recordId and offers
      //    a one-click 'Retry payment' against the same Airtable order via
      //    /api/rapyd/retry — customer doesn't refill the form. The
      //    service=transport param also routes the 'Start over' link back
      //    here instead of /book.
      //
      //    We deliberately do NOT reset the Zustand store here. The
      //    window.location.assign causes a full page unload so the
      //    in-memory store dies anyway; on retry the customer never returns
      //    to this page in the first place. Resetting now would only hurt
      //    the rare back-button-from-Rapyd case.
      window.location.assign(redirectUrl)
    } catch (err) {
      console.error('[transport] submit failed', err)
      setSubmitError(
        locale === 'is'
          ? 'Eitthvað fór úrskeiðis. Reyndu aftur.'
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const renderLocationConditionals = (
    side: 'pickup' | 'delivery',
    meta: TransportLocation | undefined,
  ) => {
    if (!meta) return null

    const isPickup = side === 'pickup'
    const addr = isPickup ? booking.pickupAddress : booking.deliveryAddress
    const setAddr = isPickup ? setPickupAddress : setDeliveryAddress
    const flightVal = isPickup ? booking.pickupFlightNumber : booking.deliveryFlightNumber
    const cruiseVal = isPickup ? booking.pickupCruiseShipName : booking.deliveryCruiseShipName
    // outsideHours toggle was removed from the UI but the booking shape
    // still carries the field; we just don't bind anything to it here.
    const leaveVal = isPickup ? booking.pickupLeaveAtReception : booking.deliveryLeaveAtReception

    return (
      <>
        {meta.requiresFlightNumber && (
          <Field>
            <span>
              {isPickup ? t.fields.flightNumberArrival : t.fields.flightNumberDeparture}
              <RequiredMark> *</RequiredMark>
            </span>
            <TextInput
              type="text"
              placeholder={t.placeholders.flight}
              value={flightVal}
              required
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setBooking(
                  isPickup
                    ? { pickupFlightNumber: e.target.value }
                    : { deliveryFlightNumber: e.target.value },
                )
              }
            />
            {/* Live lookup against the KEF schedule.
                - Pickup at KEF  → arrival lookup against pickupDate; onMatch
                  auto-fills pickupTime as a fixed 2-hour window starting at
                  the landing time (e.g. 10:30 → 10:30-12:30). The customer
                  doesn't pick a time slot at all for KEF.
                - Delivery at KEF → departure lookup against deliveryDate;
                  customer still picks their own deliveryTime above (when to
                  hand off the bags at check-in). */}
            {meta.kind === 'kef-airport' && (
              <FlightLookup
                flightNumber={flightVal}
                date={isPickup ? booking.pickupDate : booking.deliveryDate}
                direction={isPickup ? 'arrival' : 'departure'}
                locale={locale}
                onChangeFlightNumber={(v) =>
                  setBooking(
                    isPickup
                      ? { pickupFlightNumber: v }
                      : { deliveryFlightNumber: v },
                  )
                }
                onMatch={(flight) => {
                  // Fixed 3-hour window keyed off the flight time. Same rule
                  // both directions, mirrored:
                  //   pickup (arrival)   → window starts at landing, ends +3h
                  //   delivery (departure) → window ends at departure, starts −3h
                  // Late landings or early departures can roll past midnight;
                  // the (+1d) / (−1d) tag makes the rollover obvious in the
                  // Tímasetning / Delivery Time-window columns for ops.
                  const flightIso =
                    flight.EstimatedDateTime || flight.ScheduledDateTime
                  if (!flightIso) return
                  const d = new Date(flightIso)
                  if (isNaN(d.getTime())) return
                  const hhmm = d.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Atlantic/Reykjavik',
                  })
                  const hh = parseInt(hhmm.slice(0, 2), 10)
                  const mm = parseInt(hhmm.slice(3, 5), 10)
                  const pad = (n: number) => String(n).padStart(2, '0')
                  let windowStr: string
                  if (isPickup) {
                    const rawEnd = hh + 3
                    windowStr =
                      `${hhmm} - ${pad(rawEnd % 24)}:${pad(mm)}` +
                      (rawEnd >= 24 ? ' (+1d)' : '')
                  } else {
                    const rawStart = hh - 3
                    windowStr =
                      `${pad((rawStart + 24) % 24)}:${pad(mm)}` +
                      (rawStart < 0 ? ' (-1d)' : '') +
                      ` - ${hhmm}`
                  }
                  setBooking(
                    isPickup ? { pickupTime: windowStr } : { deliveryTime: windowStr },
                  )
                }}
                onClear={() => {
                  // Wipe the auto-filled window when the flight match is
                  // lost (cleared input, not-found, network err) so we don't
                  // submit a stale value.
                  const fresh = useTransportStore.getState().booking
                  if (isPickup && fresh.pickupTime) {
                    setBooking({ pickupTime: null })
                  } else if (!isPickup && fresh.deliveryTime) {
                    setBooking({ deliveryTime: null })
                  }
                }}
              />
            )}
            {/* When KEF + a window is computed, show it as a chip + a
                mode-aware hint. For PICKUP the copy varies by availability:
                  - landing overlaps an existing driver window → 'pickup-delivery'
                  - else if locker free + in season             → 'locker'
                  - else                                         → 'unavailable'
                DELIVERY always shows the same drop-at-check-in message. */}
            {meta.kind === 'kef-airport' &&
              (isPickup ? booking.pickupTime : booking.deliveryTime) && (
                <KefWindowChip>
                  <KefWindowLabel>{t.fields.timeWindow}</KefWindowLabel>
                  <KefWindowValue>
                    {isPickup ? booking.pickupTime : booking.deliveryTime}
                  </KefWindowValue>
                  <KefWindowHint>
                    {isPickup
                      ? kefPickupAvailability.isFetching
                        ? t.fields.kefPickupHintLoading
                        : kefPickupMode === 'pickup-delivery'
                          ? t.fields.kefPickupHintArrival
                          : kefPickupMode === 'locker'
                            ? // Pick the specific collection run based on
                              // the landing hour and substitute it into the
                              // template. Morning landing → noon. Afternoon
                              // → 22:00. Late evening → next day's noon.
                              (() => {
                                const landingH = (() => {
                                  const m = /^(\d{1,2}):(\d{2})/.exec(
                                    booking.pickupTime || '',
                                  )
                                  return m ? parseInt(m[1], 10) : 0
                                })()
                                const collection =
                                  landingH < 12
                                    ? t.fields.kefPickupHintLockerNoon
                                    : landingH < 22
                                      ? t.fields.kefPickupHintLockerEvening
                                      : t.fields.kefPickupHintLockerNextNoon
                                return t.fields.kefPickupHintLockerTemplate.replace(
                                  '{collection}',
                                  collection,
                                )
                              })()
                            : kefPickupMode === 'unavailable'
                              ? t.fields.kefPickupHintUnavailable
                              : t.fields.kefPickupHintNeedFlight
                      : t.fields.kefDeliveryHint}
                  </KefWindowHint>
                </KefWindowChip>
              )}
          </Field>
        )}
        {meta.requiresCruiseShipName && (
          <Field>
            <span>{t.fields.cruiseShip}</span>
            <TextInput
              type="text"
              placeholder={t.placeholders.cruise}
              value={cruiseVal}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setBooking(
                  isPickup
                    ? { pickupCruiseShipName: e.target.value }
                    : { deliveryCruiseShipName: e.target.value },
                )
              }
            />
          </Field>
        )}
        {meta.requiresAddress && (
          <>
            <Field>
              <span>{t.fields.street}</span>
              {/* For manual-address legs we use Google Places autocomplete:
                  it propagates the canonical formatted address AND the
                  postcode in one go, which gives the server's postal-code-
                  service check accurate data. Hotel addresses also flow
                  through this — customer can still type free-text, or pick
                  a suggestion, either works. */}
              <PlaceAutocompleteInput
                apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}
                placeholder={t.placeholders.street}
                initialValue={addr.street}
                onPlaceSelect={(address, _placeName, postalCode) => {
                  // Google's postcode wins when provided; otherwise keep
                  // whatever the customer had typed in the zip field.
                  setAddr({
                    street: address,
                    zip: postalCode || addr.zip,
                  })
                }}
              />
            </Field>
            <Field>
              <span>{t.fields.zip}</span>
              <TextInput
                type="text"
                placeholder={t.placeholders.zip}
                value={addr.zip}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setAddr({ zip: e.target.value })
                }
              />
            </Field>
          </>
        )}
        {meta.requiresHotelName && (
          <Field>
            <span>{t.fields.hotelName}</span>
            <TextInput
              type="text"
              placeholder={t.placeholders.hotelName}
              value={addr.hotelName}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setAddr({ hotelName: e.target.value })
              }
            />
          </Field>
        )}
        {/* Outside-opening-hours toggle was removed per product feedback —
            customers can't reliably self-report this without seeing our
            schedule, and the surcharge it triggered was confusing. The
            booking shape still carries the field (pickupOutsideHours /
            deliveryOutsideHours) in case ops decides to enable it later. */}
        {(meta.kind === 'hotel-pickup' || meta.kind === 'hotel-delivery') && (
          <ToggleRow>
            <input
              type="checkbox"
              checked={leaveVal}
              onChange={(e) =>
                setBooking(
                  isPickup
                    ? { pickupLeaveAtReception: e.target.checked }
                    : { deliveryLeaveAtReception: e.target.checked },
                )
              }
            />
            <span>
              {isPickup ? t.fields.leaveAtReceptionPickup : t.fields.leaveAtReceptionDelivery}
            </span>
          </ToggleRow>
        )}
      </>
    )
  }

  return (
    <>
      <NextSeo title={t.seoTitle} />
      <PageContainer>
        <TopBar>
          <BackButton />
          <Link href="/">
            <Logo />
          </Link>
          <span style={{ width: 60 }} />
        </TopBar>
        <HeaderBlock>
          <Title>{t.title}</Title>
          <Subtitle>{t.subtitle}</Subtitle>
        </HeaderBlock>
        <PageGrid>
          <SectionsGrid>
          {/* Dates + bags */}
          <Section>
            <SectionTitle>{t.sections.dates}</SectionTitle>
            <TransportCalendar
              pickupDate={booking.pickupDate}
              deliveryDate={booking.deliveryDate}
              onChange={(pickupDate, deliveryDate) =>
                setBooking({ pickupDate, deliveryDate })
              }
              locale={locale}
            />
            <DateChipsRow>
              <DateChip>
                <DateChipLabel>{t.fields.pickupDate}</DateChipLabel>
                <DateChipValue $placeholder={!booking.pickupDate}>
                  {booking.pickupDate ?? t.fields.selectDate}
                </DateChipValue>
              </DateChip>
              <DateChip>
                <DateChipLabel>{t.fields.deliveryDate}</DateChipLabel>
                <DateChipValue $placeholder={!booking.deliveryDate}>
                  {booking.deliveryDate ?? t.fields.selectDate}
                </DateChipValue>
              </DateChip>
            </DateChipsRow>

            <Field>
              <span>{t.fields.bagsCount}</span>
              <BagStepper>
                <StepperButton
                  type="button"
                  aria-label="Decrease bag count"
                  disabled={booking.bagsCount <= 1}
                  // Read fresh state at click time. Closure-captured
                  // `booking.bagsCount` would let two fast clicks both see
                  // the pre-click value and only register one decrement.
                  onClick={() => {
                    const current = useTransportStore.getState().booking.bagsCount
                    setBooking({ bagsCount: Math.max(1, current - 1) })
                  }}
                >
                  −
                </StepperButton>
                <StepperValue>{booking.bagsCount}</StepperValue>
                <StepperButton
                  type="button"
                  aria-label="Increase bag count"
                  onClick={() => {
                    const current = useTransportStore.getState().booking.bagsCount
                    setBooking({ bagsCount: current + 1 })
                  }}
                >
                  +
                </StepperButton>
              </BagStepper>
            </Field>
          </Section>

          {/* Pick-up */}
          <Section>
            <SectionTitle>{t.sections.pickup}</SectionTitle>
            <FieldGrid>
              <Field>
                <span>{t.fields.location}</span>
                <Select
                  value={booking.pickupLocation ?? ''}
                  onChange={(e) =>
                    setBooking({
                      pickupLocation: (e.target.value || null) as any,
                      // Switching pickup location can change which time-slot
                      // set is valid (BSI has its own slots, KEF has no
                      // dropdown). Clear the old selection so we don't carry
                      // an invalid value into the new mode.
                      pickupTime: null,
                    })
                  }
                >
                  <option value="">{t.placeholders.chooseLocation}</option>
                  {pickupLocationOptions().map((loc) => (
                    <option key={loc.kind} value={loc.kind}>
                      {loc.label[locale]}
                    </option>
                  ))}
                </Select>
              </Field>
              {/* For KEF pickup, the time window is auto-derived from the
                  flight's landing time (set by FlightLookup's onMatch
                  callback below). We hide the dropdown entirely; the
                  computed window appears as a chip beneath the flight info. */}
              {booking.pickupLocation !== 'kef-airport' && (
                <Field>
                  <span>{t.fields.time}</span>
                  <Select
                    value={booking.pickupTime ?? ''}
                    onChange={(e) => setBooking({ pickupTime: e.target.value || null })}
                    disabled={!booking.pickupLocation}
                  >
                    <option value="">{t.placeholders.chooseTime}</option>
                    {timeSlotOptionsForLocation(booking.pickupLocation, 'pickup').map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.value}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </FieldGrid>
            {booking.pickupLocation === 'bsi-flybus' && (
              <BsiInfoNote>{t.fields.bsiOpeningHoursNote}</BsiInfoNote>
            )}
            {booking.pickupTime === BSI_AFTER_HOURS_SLOT && (
              <BsiLockerNote>{t.fields.bsiLockerNote}</BsiLockerNote>
            )}
            {renderLocationConditionals('pickup', pickupMeta)}
          </Section>

          {/* Delivery */}
          <Section>
            <SectionTitle>{t.sections.delivery}</SectionTitle>
            <FieldGrid>
              <Field>
                <span>{t.fields.location}</span>
                <Select
                  value={booking.deliveryLocation ?? ''}
                  onChange={(e) =>
                    setBooking({
                      deliveryLocation: (e.target.value || null) as any,
                      // Clear when switching modes — BSI's slots and KEF's
                      // computed window are mutually exclusive.
                      deliveryTime: null,
                    })
                  }
                >
                  <option value="">{t.placeholders.chooseLocation}</option>
                  {deliveryLocationOptions().map((loc) => (
                    <option key={loc.kind} value={loc.kind}>
                      {loc.label[locale]}
                    </option>
                  ))}
                </Select>
              </Field>
              {/* For KEF delivery, the time window is auto-derived from the
                  departure flight (set by FlightLookup's onMatch below);
                  we hide the dropdown the same way we do for pickup. */}
              {booking.deliveryLocation !== 'kef-airport' && (
                <Field>
                  <span>{t.fields.time}</span>
                  <Select
                    value={booking.deliveryTime ?? ''}
                    onChange={(e) => setBooking({ deliveryTime: e.target.value || null })}
                    disabled={!booking.deliveryLocation}
                  >
                    <option value="">{t.placeholders.chooseTime}</option>
                    {timeSlotOptionsForLocation(booking.deliveryLocation, 'delivery', {
                      // When pickup is KEF and delivery is same-day, the
                      // bags physically can't be in our hands before 14:00
                      // (locker collected at noon + 2h transit). Filter
                      // morning slots so the customer can't pick something
                      // we can't fulfil. Multi-day delivery returns 0 from
                      // the helper → no filtering.
                      minStartHour: minSameDayDeliveryHour(
                        booking.pickupLocation,
                        booking.pickupDate,
                        booking.deliveryDate,
                        booking.pickupTime,
                      ),
                    }).map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.value}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </FieldGrid>
            {booking.deliveryLocation === 'bsi-flybus' && (
              <BsiInfoNote>{t.fields.bsiOpeningHoursNote}</BsiInfoNote>
            )}
            {booking.deliveryTime === BSI_AFTER_HOURS_SLOT && (
              <BsiLockerNote>{t.fields.bsiLockerNote}</BsiLockerNote>
            )}
            {renderLocationConditionals('delivery', deliveryMeta)}
          </Section>

          {/* Contact */}
          <Section>
            <SectionTitle>{t.sections.contact}</SectionTitle>
            <FieldGrid>
              <Field>
                <span>{t.fields.name}</span>
                <TextInput
                  type="text"
                  placeholder={t.placeholders.name}
                  value={booking.customer.name}
                  onChange={(e) => setCustomer({ name: e.target.value })}
                />
              </Field>
              <Field>
                <span>{t.fields.email}</span>
                <TextInput
                  type="email"
                  placeholder={t.placeholders.email}
                  value={booking.customer.email}
                  onChange={(e) => setCustomer({ email: e.target.value })}
                />
              </Field>
              <Field>
                <span>{t.fields.phone}</span>
                <TextInput
                  type="tel"
                  placeholder={t.placeholders.phone}
                  value={booking.customer.phoneNumber}
                  onChange={(e) => setCustomer({ phoneNumber: e.target.value })}
                />
              </Field>
            </FieldGrid>
            <ToggleRow>
              <input
                type="checkbox"
                checked={booking.customer.bookingForCompany}
                onChange={(e) => setCustomer({ bookingForCompany: e.target.checked })}
              />
              <span>{t.fields.bookingForCompany}</span>
            </ToggleRow>
            {booking.customer.bookingForCompany && (
              <Field>
                <span>{t.fields.kennitala}</span>
                <TextInput
                  type="text"
                  placeholder={t.placeholders.kennitala}
                  value={booking.customer.kennitala}
                  onChange={(e) => setCustomer({ kennitala: e.target.value })}
                />
              </Field>
            )}
            <Field>
              <span>{t.fields.comments}</span>
              <TextArea
                value={booking.customer.comments}
                onChange={(e) => setCustomer({ comments: e.target.value })}
              />
            </Field>
          </Section>

          </SectionsGrid>

          {/* Sticky live-price sidebar — slides in from the right on desktop.
              On mobile it just stacks below the form (no sticky positioning). */}
          <Sidebar>
            <SummaryCard>
              <SectionTitle>{t.sections.summary}</SectionTitle>
              {/* Hide the breakdown until BOTH legs are selected — otherwise
                  storage fee would show on its own once dates are picked,
                  which is misleading (it isn't the final price). */}
              {!booking.pickupLocation ||
              !booking.deliveryLocation ||
              breakdown.lineItems.length === 0 ? (
                <SummaryNote>{t.notReady}</SummaryNote>
              ) : (
                <>
                  {breakdown.lineItems.map((item) => (
                    <SummaryRow key={item.key}>
                      <span>{item.label[locale]}</span>
                      <span>{formatISK(item.amount)}</span>
                    </SummaryRow>
                  ))}
                  {breakdown.discount > 0 && (
                    <SummaryRow>
                      <span>{t.summary.discount}</span>
                      <span>−{formatISK(breakdown.discount)}</span>
                    </SummaryRow>
                  )}
                  <SummaryRow $emphasize>
                    <span>{t.summary.total}</span>
                    <span>{formatISK(breakdown.total)}</span>
                  </SummaryRow>
                  <SummaryNote>
                    {t.summary.vatNote} {t.summary.vatPortion}:{' '}
                    {formatISK(breakdown.vatIncluded)}
                  </SummaryNote>
                </>
              )}
            </SummaryCard>
            <SubmitWrap>
              <Button
                onClick={handleSubmit}
                disabled={submitDisabled || submitting}
                loading={submitting}
                fullWidth
              >
                {t.submit}
              </Button>
            </SubmitWrap>
            {submitError && <SubmitErrorNote>{submitError}</SubmitErrorNote>}
          </Sidebar>
        </PageGrid>
      </PageContainer>
    </>
  )
}

export default TransportPage

// Opt out of static generation. Next.js 13's i18n + Pages Router
// auto-static-optimization has a long-standing bug where the export
// finalize step expects '.next/export/is/transport.html' but never
// writes it (the default locale + non-default locale dedupe step
// collapses the HTML when the page renders identically up front).
// Symptom: build fails with ENOENT on rename in build/index.js:1450.
// getServerSideProps forces SSR per request, bypassing the export
// pipeline entirely. Trivial perf cost — the page returns no
// server-side data; this is purely to dodge the build bug.
export async function getServerSideProps() {
  return { props: {} }
}
