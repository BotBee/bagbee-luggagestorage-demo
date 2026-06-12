import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { NextSeo } from 'next-seo'
import { theme } from '../styles/theme'
import '../styles/fonts.css'
import '/node_modules/flag-icons/css/flag-icons.min.css'
import BagChat from '../components/bag-chat/BagChat'
import GoogleTagScript from '../components/google-tag-script/GoogleTagScript'
import ContentsquareScript from '../components/contentsquare-script/ContentsquareScript'
import { Global, ThemeProvider } from '@emotion/react'
import GlobalStyles from '../styles/global'
import { UserContextProvider } from '../context/UserContext'
import Script from 'next/script'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export default function App({ Component, pageProps }: AppProps) {
  // One client for the app's lifetime — constructing it in the component
  // body created a fresh client on every App render (every route change),
  // silently wiping the react-query cache each navigation.
  const [queryClient] = useState(() => new QueryClient())
  const router = useRouter()
  // Partner booking popups under /embed are iframed onto third-party sites
  // (luggagelockers.is, bikerent.is). Keep them clean and self-contained: no
  // floating chat bubble, no Bokun/Trustpilot widgets, and no analytics tags
  // (the partner site runs its own — we don't want to double-count inside the
  // iframe). Only global styles + theme are kept.
  // Internal staff tools under /admin (dispatch, storage ops) and the partner
  // /embed popups don't need the customer chat bubble, Bokun/Trustpilot widgets
  // or marketing analytics — keep them lean.
  const isEmbed = router.pathname.startsWith('/embed')
  const isAdmin = router.pathname.startsWith('/admin')
  const isBare = isEmbed || isAdmin

  return (
    <QueryClientProvider client={queryClient}>
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
      <Global styles={GlobalStyles} />

      {!isBare && (
        <>
          <Script
            type='text/javascript'
            src='https://widgets.bokun.io/assets/javascripts/apps/build/BokunWidgetsLoader.js?bookingChannelUUID=1a87159d-0e31-4359-a404-34d39230f549'
            async
          ></Script>
          <GoogleTagScript />
          <ContentsquareScript />
          <BagChat />
          <Script
            type='text/javascript'
            src='//widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js'
            async
          ></Script>
        </>
      )}

      <ThemeProvider theme={theme}>
        <UserContextProvider>
          <Component {...pageProps} />
        </UserContextProvider>
      </ThemeProvider>
    </main>
    </QueryClientProvider>
  )
}
