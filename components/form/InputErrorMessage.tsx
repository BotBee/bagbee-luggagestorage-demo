import React from 'react'
import styled from '@emotion/styled'

interface IInputErrorMessage {
  errorMessage: string
}

const ErrorMessage = styled.span`
  font-family: 'Poppins';
  font-weight: 400;
  font-size: 14px;
  line-height: 18px;
  display: flex;
  align-items: center;
  color: red;
  margin-top: 8px;
`
const InputErrorMessage = ({ errorMessage }: IInputErrorMessage) => {
  return <ErrorMessage>{errorMessage}</ErrorMessage>
}

export default InputErrorMessage
