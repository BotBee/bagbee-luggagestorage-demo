import type { AppProps } from 'next/app'
import { NextSeo } from 'next-seo'
import { theme } from '../styles/theme'
import '../styles/fonts.css'
import '/node_modules/flag-icons/css/flag-icons.min.css'
import BagChat from '../components/bag-chat/BagChat'
import GoogleTagScript from '../components/google-tag-script/GoogleTagScript'
import { Global, ThemeProvider } from '@emotion/react'
import GlobalStyles from '../styles/global'
import { UserContextProvider } from '../context/UserContext'
import Script from 'next/script'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main>
      <NextSeo
        title='Bagbee | Luggage pick up and check in service'
        description='Bagbee will pick up your luggage and check them in for you so you and your family can go directly to the gate without waiting in line'
        openGraph={{
          images: [
            {
              url: '/images/bagbee-og.png',
            },
          ],
        }}
      />
      <Script
        type='text/javascript'
        src='https://widgets.bokun.io/assets/javascripts/apps/build/BokunWidgetsLoader.js?bookingChannelUUID=1a87159d-0e31-4359-a404-34d39230f549'
        async
      ></Script>
      <Global styles={GlobalStyles} />
      <GoogleTagScript />
      <BagChat />
      <Script
        type='text/javascript'
        src='//widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js'
        async
      ></Script>

      <ThemeProvider theme={theme}>
        <UserContextProvider>
          <Component {...pageProps} />
        </UserContextProvider>
      </ThemeProvider>
    </main>
  )
}
