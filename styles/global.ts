import { css } from '@emotion/react'
import { theme } from './theme'

const GlobalStyles = css`
  * {
    margin: 0;
    padding: 0;
    outline: 0;
    box-sizing: border-box;
  }
  html {
    scroll-behavior: smooth !important;
  }
  #root {
    margin: 0 auto;
  }
  body {
    background-color: ${theme.colors.background};
  }

  button {
    border: none;
    cursor: pointer;
    background: none;
  }
  a {
    color: ${theme.colors.greyLight};
    text-decoration: none;
  }
  p,
  a,
  h2,
  h3 {
    font-family: ${theme.fonts.poppins};
  }
  details summary::-webkit-details-marker {
    display: none;
  }
  /* Google Places dropdown styles */
  .pac-container {
    padding: 12px;
    margin-top: 8px;
    font-family: Poppins;
    background: #ffffff;
    border: 1px solid #12141d;
    box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.11);
    border-radius: 8px;
    &::after {
      display: none;
    }
  }
  .pac-item {
    background-color: white;
    display: flex;
    justify-content: space-between;
    padding: 12px;
    border: none;
    font-size: 14px;
    border-radius: 8px;
    cursor: pointer;
  }
  .pac-icon {
    display: none;
  }

  .rdp-root {
    --rdp-accent-color: #f3ad3c; /* Use blue as the accent color. */
    max-width: 400px;
    margin: 0 auto;
    background-color: white;
    border-radius: 24px;
    padding: 24px 8px;
    .rdp-month_caption {
      padding-left: 12px;
    }

    > div {
      background-color: white;
      border-radius: 24px;
      font-family: Poppins;
      margin: 0 auto;
    }
  }
`

export default GlobalStyles
