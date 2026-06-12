// All pricing should use this function so we only have to update it here when BagBee updates their pricing

const priceOfFirstBag = 6_990
const pricePerExtraBag = 1_990
const pricePerOddsize = 2_490

const priceOfFastTrack = 2_490

export const calculateCheckoutPrice = (numberOfBags: number, numberOfOddsize: number) => {
  const amountOfItems = numberOfBags + numberOfOddsize

  const bagPrice = () => {
    if (numberOfBags && !numberOfOddsize) {
      return (numberOfBags - 1) * pricePerExtraBag
    }
    if (numberOfOddsize > 0 && numberOfBags > 0) {
      return (numberOfBags - 1) * pricePerExtraBag
    }
    if (numberOfBags === 0) {
      return 0
    }
  }
  const oddsizePrice = () => {
    if (numberOfOddsize && !numberOfBags) {
      return (numberOfOddsize - 1) * pricePerOddsize
    }
    if (numberOfBags > 0) {
      return numberOfOddsize * pricePerOddsize
    }
    if (numberOfOddsize === 0) {
      return 0
    }
  }

  let totalPrice = amountOfItems > 0 ? bagPrice()! + oddsizePrice()! + priceOfFirstBag : 0

  if (numberOfBags + numberOfOddsize === 2 && numberOfOddsize > 0) {
    return priceOfFirstBag + pricePerOddsize
  }
  return totalPrice
}

export const mapCurrencyToDisplay = (amount: number, currency: string) => {
  /**
   * TODO:
   * Reintroduce this when we figure out why this isn't working because it should.
   * For some reason it always returns "ISK 6,880" even though the locale is "IS" and shows "6.880 kr" in ​​​​​Quokka locally, very strange.
   */
  // const formatter = Intl.NumberFormat('is', {
  //   style: 'currency',
  //   currency,
  // })

  // return formatter.format(amount)

  return `${Math.round(amount)} ${currency === 'ISK' ? 'kr' : ''}`
}

export const discountPrice = (amount: number, percentage: number) => {
  if (percentage === 0) {
    return amount
  }
  const discount = (percentage / 100) * amount
  const finalPrice = amount - discount

  // ISK has no decimals — this value goes verbatim to Rapyd and Airtable
  // (Upphæð), while the UI rounds for display. Without rounding here a 15%
  // discount on 6,990 charges 5,941.5 kr: charged ≠ displayed.
  return Math.round(finalPrice)
}

export const calculateFastTrackPrice = (numberOfPax: number) => {
  return numberOfPax * priceOfFastTrack
}