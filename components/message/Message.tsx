import { useRouter } from 'next/router'
import React, { ReactNode } from 'react'
import styled from '@emotion/styled'

import en from '../../common/locales/en'
import is from '../../common/locales/is'
import Button from '../button/Button'

interface IMessageProps {
  title: string
  text: string
  asset: ReactNode
  bookingNumber?: string
  onClick?: () => void
  buttonText?: string
}
const Container = styled.div`
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
  align-items: center;
  justify-content: center;
  display: flex;
  flex-direction: column;
`
const Title = styled.h1`
  font-family: 'Poppins';
  font-weight: 600;
  font-size: 20px;
  line-height: 30px;
`
const Text = styled.p`
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 400;
  font-size: 16px;
  line-height: 24px;
  display: flex;
  align-items: center;
  text-align: center;
  color: #8692a6;
  margin: 32px 0;
`
const BookingNumber = styled.p``

const Message = ({
  title,
  text,
  bookingNumber,
  buttonText,
  onClick,
  asset,
}: IMessageProps) => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  return (
    <Container>
      {asset}
      <Title>{title}</Title>
      {bookingNumber && (
        <BookingNumber>
          {t.successStep.bookingNumber}: <strong>{bookingNumber}</strong>
        </BookingNumber>
      )}
      <Text>{text}</Text>
      {onClick && buttonText && (
        <Button fullWidth onClick={onClick}>
          {buttonText}
        </Button>
      )}
    </Container>
  )
}

export default Message
