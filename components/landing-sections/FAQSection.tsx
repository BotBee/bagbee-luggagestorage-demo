import { documentToReactComponents } from '@contentful/rich-text-react-renderer'
import styled from '@emotion/styled'
import React, { useState } from 'react'

import {
  IFaqSection,
  IFrequentlyAskedQuestion,
} from '../../@types/generated/contentful'
import Minus from '../../public/icons/Minus'
import Plus from '../../public/icons/Plus'
interface IFAQSectionProps {
  faqs: IFrequentlyAskedQuestion[]
  data: IFaqSection
}
const Container = styled.section`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  max-width: 1240px;
  padding: 24px;
  margin: 60px auto;

  gap: 60px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 48px;
    gap: 8rem;
    flex-direction: row;
    margin: 100px auto;
    margin-bottom: 0;
  }
`

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    gap: 32px;
  }
`
const Title = styled.h3`
  font-weight: 600;
  font-size: 36px;
  line-height: 52px;
  color: ${({ theme }) => theme.colors.black};
  @media ${({ theme }) => theme.breakpoints.tablet} {
    max-width: 440px;
    font-size: 50px;
  }
`
const Text = styled.div`
  font-weight: 500;
  font-size: 16px;
  line-height: 32px;
  color: ${({ theme }) => theme.colors.greyLight};
`

const Summary = styled.summary`
  display: grid;
  grid-template-columns: 80% 10%;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 24px;
  font-family: 'Poppins';
  font-weight: 500;
  font-size: 20px;
  line-height: 30px;
  color: ${({ theme }) => theme.colors.black};
  cursor: pointer;
  align-items: center;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    font-size: 26px;
    line-height: 38px;
  }
`

const Details = styled.details`
  font-family: 'Poppins';
  font-weight: 400;
  font-size: 16px;
  line-height: 24px;
  color: ${({ theme }) => theme.colors.greyLight};
  border-top: 1px solid rgba(0, 0, 0, 0.09);
  padding: 32px 0;
  padding-bottom: 8px;
  list-style: none;
  > p {
    margin: 18px 0;
  }
  b {
    color: ${({ theme }) => theme.colors.black};
    opacity: 0.8;
  }
`
const Accordion = styled.div`
  display: grid;
`
const FAQSection = ({ faqs, data }: IFAQSectionProps) => {
  const [openItems, setOpenItems] = useState<number[]>([])

  const toggleItem = (i: number) => {
    if (openItems.includes(i)) {
      setOpenItems(openItems.filter((id) => id !== i))
    } else {
      setOpenItems([...openItems, i])
    }
  }
  return (
    <Container id='faq'>
      <TextContainer>
        <Title>{data.fields.heading}</Title>
        <Text>{documentToReactComponents(data?.fields?.text)}</Text>
      </TextContainer>
      <Accordion>
        {faqs.map((faq, i) => (
          <Details key={i} onToggle={() => toggleItem(i)}>
            <Summary>
              {faq.fields.title}
              {openItems.includes(i) ? <Minus /> : <Plus />}
            </Summary>
            {documentToReactComponents(faq.fields.text)}
          </Details>
        ))}
      </Accordion>
    </Container>
  )
}

export default FAQSection
