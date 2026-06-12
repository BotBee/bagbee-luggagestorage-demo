import React from 'react'
import dynamic from 'next/dynamic'
import * as animationData from '../../public/lottie/airplane_loading.json'
import styled from '@emotion/styled'

// react-lottie depends on lottie-web, which touches `document` at module
// load. That breaks Next.js's prod build during page-data collection
// (`ReferenceError: document is not defined`). Loading it dynamically with
// `ssr: false` keeps it client-only and lets the rest of the app build.
const Lottie = dynamic(() => import('react-lottie'), { ssr: false })

interface ILoaderProps {
  text: string
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  align-items: center;
  justify-content: center;
  padding-bottom: 100px;
`
const Text = styled.p`
  font-weight: 400;
  font-size: 24px;
  text-align: center;
  color: #8692a6;
  margin-top: -48px;
`

const Loader = ({ text }: ILoaderProps) => {
  const defaultOptions = {
    loop: true,
    autoplay: true,

    animationData: animationData,
    rendererSettings: {},
  }
  return (
    <Container>
      <Lottie
        options={defaultOptions}
        width='100%'
        style={{
          maxWidth: '500px',
        }}
        height={200}
        // react-lottie 1.2.3 reads `eventListeners` in componentDidMount and
        // calls .forEach on it. Its class-component `defaultProps` aren't
        // reliably applied through React 18, so when the prop arrives
        // undefined the Loader crashes the whole page with "Cannot read
        // properties of undefined (reading 'forEach')". Pass [] explicitly.
        eventListeners={[]}
      />
      <Text>{text}</Text>
    </Container>
  )
}

export default Loader
