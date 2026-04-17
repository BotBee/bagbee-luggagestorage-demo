import React from 'react'
import styled from '@emotion/styled'

const Select = styled.select<React.InputHTMLAttributes<HTMLInputElement>>`
  height: 64px;
  border: 1px solid #8692a6;
  border-radius: 6px;
  font-weight: 500;
  font-size: 16px;
  line-height: 18px;
  display: flex;
  align-items: center;
  font-family: Poppins;
  color: #12141d;
  background: none;
  padding-left: 32px;
  width: 100%;
  cursor: pointer;
  -moz-appearance: none;
  -webkit-appearance: none;
  appearance: none;

  &:focus {
    background: #ffffff;
    box-shadow: 0px 4px 10px 3px rgba(0, 0, 0, 0.11);
  }
`

export default Select
