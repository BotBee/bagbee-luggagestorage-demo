import styled from '@emotion/styled'
import React from 'react'

interface IVideoTextProps {
  video: string
  title?: string
  text?: string
  reverse?: boolean | number
  poster?: string
}

const Container = styled.div<Pick<IVideoTextProps, 'reverse'>>`
  display: flex;
  grid-template-columns: 1fr;
  align-items: center;
  flex-direction: column;
  gap: 16px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    gap: 10%;
    /* flex-direction: ${({ reverse }) => (reverse ? 'row-reverse' : 'row')}; */
    padding: 0 48px;
    gap: 24px;
  }
`
const VideoContainer = styled.div`
  position: relative;
  height: 100%;
  > video {
    height: 100%;
    width: 100%;
    border-radius: 8px;
  }
`

const TextContainer = styled.div`
  display: grid;
  gap: 32px;
`

const Title = styled.h3`
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 600;
  font-size: 36px;
  line-height: 40px;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.black};
  @media ${({ theme }) => theme.breakpoints.tablet} {
    font-size: 50px;
    line-height: 72px;
  }
`

const Text = styled.div`
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 500;
  font-size: 16px;
  line-height: 32px;
  color: ${({ theme }) => theme.colors.greyLight};
`

const VideoText = ({
  video,
  title,
  text,
  reverse,
  poster,
}: IVideoTextProps) => {
  return (
    <Container reverse={reverse}>
      <VideoContainer>
        <video src={video} poster={poster} controls />
      </VideoContainer>
      <TextContainer>
        {title && <Title>{title}</Title>}
        {text && <Text>{text}</Text>}
      </TextContainer>
    </Container>
  )
}

export default VideoText
