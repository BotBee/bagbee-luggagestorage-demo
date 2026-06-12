export type SliderConstraints = {
  minLeft: number // minimum hour offset from start for left handle
  maxLeft: number // maximum hour offset for left handle
  minRight: number // minimum hour offset for right handle
  maxRight: number // maximum hour offset for right handle
  rightLocked: boolean // if true, right handle cannot move
  minWindow: number // minimum hours between handles
}

// Morning: 09:00–12:00 (3-hour range), no postal code restrictions
export function getMorningConstraints(): SliderConstraints {
  return {
    minLeft: 0, // 09:00
    maxLeft: 2, // 11:00
    minRight: 1, // 10:00
    maxRight: 3, // 12:00
    rightLocked: false,
    minWindow: 1,
  }
}

export function getSliderConstraints(postalCode: string): SliderConstraints {
  // Postal codes 230, 235: near airport — right handle locked at 22:00
  if (['230', '235'].includes(postalCode)) {
    return {
      minLeft: 0, // 17:00
      maxLeft: 4, // 21:00
      minRight: 5, // 22:00 (locked)
      maxRight: 5, // 22:00 (locked)
      rightLocked: true,
      minWindow: 1,
    }
  }

  // Postal code 270: outside area — constrained to 18:00–21:00
  if (postalCode === '270') {
    return {
      minLeft: 1, // 18:00
      maxLeft: 3, // 20:00
      minRight: 2, // 19:00
      maxRight: 4, // 21:00
      rightLocked: false,
      minWindow: 1,
    }
  }

  // Default: full range 17:00–22:00
  return {
    minLeft: 0, // 17:00
    maxLeft: 4, // 21:00
    minRight: 1, // 18:00
    maxRight: 5, // 22:00
    rightLocked: false,
    minWindow: 1,
  }
}
