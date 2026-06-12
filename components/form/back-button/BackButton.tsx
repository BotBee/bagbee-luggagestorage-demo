import { useRouter } from 'next/router'
import React from 'react'
import en from '../../../common/locales/en'
import is from '../../../common/locales/is'
import ChevronLeft from '../../../public/icons/ChevronLeft'
import styled from '@emotion/styled'

const Container = styled.button`
  align-items: center;
  display: flex;
  gap: 8px;
  font-family: 'Poppins';
  font-weight: 400;
  font-size: 16px;
  line-height: 20px;
  color: #8692a6;

  &:hover {
    color: ${({ theme }) => theme.colors.yellow};
    svg {
      path {
        fill: ${({ theme }) => theme.colors.yellow};
      }
    }
  }
`
const BackButton = () => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  return (
    <Container onClick={() => router.back()}>
      <ChevronLeft /> <span>{t.common.backButtonText}</span>
    </Container>
  )
}

export default BackButton
