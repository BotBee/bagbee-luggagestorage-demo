// All pricing should use this function so we only have to update it here when BagBee updates their pricing

import { ServiceType } from '../common/types'

const departurePricing = {
  firstBag: 6990,
  extraBag: 1990,
  oddSize: 2490,
}

const arrivalPricing = {
  firstBag: 8990,
  extraBag: 1990,
  oddSize: 2490,
}

export const calculateCheckoutPrice = (
  numberOfBags: number,
  numberOfOddsize: number,
  serviceType: ServiceType = 'departure'
) => {
  const pricing =
    serviceType === 'arrival' ? arrivalPricing : departurePricing
  const amountOfItems = numberOfBags + numberOfOddsize

  const bagPrice = () => {
    if (numberOfBags && !numberOfOddsize) {
      return (numberOfBags - 1) * pricing.extraBag
    }
    if (numberOfOddsize > 0 && numberOfBags > 0) {
      return (numberOfBags - 1) * pricing.extraBag
    }
    if (numberOfBags === 0) {
      return 0
    }
  }
  const oddsizePrice = () => {
    if (numberOfOddsize && !numberOfBags) {
      return (numberOfOddsize - 1) * pricing.oddSize
    }
    if (numberOfBags > 0) {
      return numberOfOddsize * pricing.oddSize
    }
    if (numberOfOddsize === 0) {
      return 0
    }
  }

  let totalPrice =
    amountOfItems > 0 ? bagPrice()! + oddsizePrice()! + pricing.firstBag : 0

  if (numberOfBags + numberOfOddsize === 2 && numberOfOddsize > 0) {
    return pricing.firstBag + pricing.oddSize
  }
  return totalPrice
}

export const mapCurrencyToDisplay = (amount: number, currency: string) => {
  return `${Math.round(amount)} ${currency === 'ISK' ? 'kr' : ''}`
}

export const discountPrice = (amount: number, percentage: number) => {
  if (percentage === 0) {
    return amount
  }
  const discount = (percentage / 100) * amount
  const finalPrice = amount - discount

  return finalPrice
}
