import styled from '@emotion/styled'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { ApplicationRoutes } from '../../utils/routing'

import Button from '../button/Button'

interface IImageTextProps {
  image: string
  title: string
  text: string
  reverse: boolean | number
  ctaText: string
}

const Container = styled.div<Pick<IImageTextProps, 'reverse'>>`
  display: flex;
  grid-template-columns: 1fr;
  align-items: center;
  flex-direction: column;
  gap: 16px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    gap: 10%;
    flex-direction: ${({ reverse }) => (reverse ? 'row-reverse' : 'row')};
    padding: 0 48px;
    max-width: 1440px;
  }
`
const ImageContainer = styled.div`
  position: relative;
  width: 100%;
  height: 600px;
`

const TextContainer = styled.div`
  display: grid;
  gap: 32px;
`

export const Title = styled.h3`
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

export const Text = styled.div`
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 500;
  font-size: 16px;
  line-height: 32px;
  color: ${({ theme }) => theme.colors.greyLight};
`

const ImageText = ({
  image,
  title,
  text,
  ctaText,
  reverse,
}: IImageTextProps) => {
  return (
    <Container reverse={reverse}>
      <ImageContainer>
        <Image src={image} alt='image' fill style={{ objectFit: 'contain' }} />
      </ImageContainer>
      <TextContainer>
        <Title>{title}</Title>
        <Text>{text}</Text>

        <Link href={ApplicationRoutes.pages.book}>
          <Button>{ctaText}</Button>
        </Link>
      </TextContainer>
    </Container>
  )
}

export default ImageText
