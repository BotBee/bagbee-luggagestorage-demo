import styled from "@emotion/styled"
import React from "react"
import { IVideoSection } from "../../@types/generated/contentful"

import { contentfulImage } from "../../utils/contentful"
import VideoText from "../video-text/VideoText"

interface IVideoSectionProps {
  data: IVideoSection
}
const Container = styled.section`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 80px;
  padding: 0 24px;
  margin: 0 auto;
  max-width: 1290px;
  margin-top: 60px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    margin-top: 120px;
    gap: 60px;
  }
`
const VideoSection = ({ data }: IVideoSectionProps) => {
  const content = data.fields

  return (
    <Container>
      <VideoText
        poster={content.poster && contentfulImage(content.poster)}
        video={contentfulImage(content.video)}
      />
    </Container>
  )
}

export default VideoSection
