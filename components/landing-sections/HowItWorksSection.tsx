import styled from '@emotion/styled'
import React from 'react'
import { IImageAndText } from '../../@types/generated/contentful'
import { contentfulImage } from '../../utils/contentful'
import ImageText from '../image-text/ImageText'
interface IWhyBagBeeProps {
  data: IImageAndText[]
}

const Container = styled.section`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  gap: 80px;
  padding: 0 24px;
  margin: 0 auto;
  max-width: 1280px;
  margin-top: 60px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    margin-top: 120px;
    gap: 60px;
  }
`
const WhyBagBeeSection = ({ data }: IWhyBagBeeProps) => {
  return (
    <Container id='why-bagbee'>
      {data.map((item, i) => (
        <ImageText
          image={contentfulImage(item.fields.image)}
          ctaText={item.fields.ctaButtonText}
          title={item.fields.title}
          text={item.fields.text}
          reverse={i! % 2}
          key={i}
        />
      ))}
    </Container>
  )
}

export default WhyBagBeeSection
