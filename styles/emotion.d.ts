import '@emotion/react'

type Colors = {
  // To do: allow all keys as strings but typed so that we get typescript suggestions
  // [key: string]: string
  yellow: string
  orange: string
  green: string
  greenDark: string
  background: string
  black: string
  greyLight: string
  greyDark: string
}

type Breakpoints = {
  tablet: string
  laptop: string
}

type Fonts = {
  druk: string
  poppins: string
}
declare module '@emotion/react' {
  export interface Theme {
    colors: Colors
    breakpoints: Breakpoints
    fonts: Fonts
  }
}
