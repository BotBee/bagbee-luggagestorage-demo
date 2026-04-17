import React, { useState } from 'react'
import ChevronDown from '../../public/icons/ChevronDown'
import ChevronUp from '../../public/icons/ChevronUp.tsx'
import { IInfoBoxProps } from './InfoBox.types'
import styled from '@emotion/styled'

const Container = styled.details`
  width: 100%;
  background-color: white;
  border-radius: 10px;
`

const Summary = styled.summary`
  padding: 24px 32px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  justify-content: space-between;
  width: 100%;
  font-family: 'Poppins';
  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  color: ${({ theme }) => theme.colors.black};
  cursor: pointer;
  align-items: center;
  > svg {
    justify-self: flex-end;
  }
`

const Content = styled.ul`
  padding: 0 32px;
  padding-bottom: 32px;
`

const ListItem = styled.li`
  list-style: none;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #e5e6eb;
  padding: 12px 0px;
`

const ItemTitle = styled.p`
  font-family: 'Poppins';
  font-weight: 400;
  font-size: 16px;
  line-height: 24px;
  color: #9ea3ae;
`

const ItemValue = styled.p`
  font-family: 'Poppins';
  font-weight: 600;
  font-size: 16px;
  line-height: 24px;
  color: #12141d;
`

const InfoBox = ({ title, data, open }: IInfoBoxProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  return (
    <Container open={open} onToggle={() => setIsOpen(!isOpen)}>
      <Summary>
        {title} {isOpen ? <ChevronUp /> : <ChevronDown />}
      </Summary>
      <Content>
        {data.map((item) => (
          <ListItem key={item.title}>
            <ItemTitle>{item.title}</ItemTitle>
            <ItemValue>{item.value}</ItemValue>
          </ListItem>
        ))}
      </Content>
    </Container>
  )
}

export default InfoBox
