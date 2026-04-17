import { documentToReactComponents } from '@contentful/rich-text-react-renderer'
import styled from '@emotion/styled'
import React from 'react'
import { ITrustpilotWidget } from '../../@types/generated/contentful'
import Button from '../button/Button'
import TrustPilotWidget from './TrustPilotWidget'

interface IWidgetAndTextProps {
  data: ITrustpilotWidget
}

const Container = styled.div`
  display: flex;
  grid-template-columns: 1fr;
  align-items: center;
  flex-direction: column;
  gap: 24px;
  width: 90%;

  margin: 48px auto;
  margin-top: 80px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    margin-top: 48px;
    flex-direction: row;
    padding: 0 48px;
    max-width: 1000px;
    display: grid;
    grid-template-columns: 1fr 1fr;
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

const WidgetAndText = ({ data }: IWidgetAndTextProps) => {
  if (!data?.fields) return null
  return (
    <Container>
      <TrustPilotWidget />
      <TextContainer>
        <Title>{data.fields.title}</Title>
        <Text>{documentToReactComponents(data.fields.text)}</Text>
        <a target='_blank' rel='noreferrer' href={data.fields.buttonUrl}>
          <Button>{data.fields.buttonText}</Button>
        </a>
      </TextContainer>
    </Container>
  )
}

export default WidgetAndText
