import React from 'react'
import dynamic from 'next/dynamic'
import * as animationData from '../../public/lottie/airplane_loading.json'
import styled from '@emotion/styled'

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
      />
      <Text>{text}</Text>
    </Container>
  )
}

export default Loader
