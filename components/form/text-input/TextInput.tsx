import React from 'react'
import styled from '@emotion/styled'

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  success?: boolean
  error?: boolean
}

const TextInput = styled.input<TextInputProps>`
  height: 64px;
  border: ${({ success, error }) =>
    success
      ? '2px solid#1ddc40'
      : error
      ? '2px solid red'
      : '1px solid #8692a6'};
  border-radius: 6px;
  font-weight: 500;
  font-size: 16px;
  line-height: 18px;
  display: flex;
  align-items: center;
  font-family: Poppins;
  color: #12141d;
  /* background: '#FAFAFA'; */
  padding-left: 32px;
  width: 100%;

  &::placeholder {
    color: #8692a6;
  }
  &:focus {
    background: #ffffff;
    box-shadow: 0px 4px 10px 3px rgba(0, 0, 0, 0.11);
  }
`

export default TextInput
