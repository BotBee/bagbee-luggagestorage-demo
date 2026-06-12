import React from 'react'
import styled from '@emotion/styled'

const TextArea = styled.textarea<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>`
  height: 64px;
  border: 1px solid #000000;
  border-radius: 6px;
  font-weight: 500;
  font-size: 16px;
  line-height: 20px;
  font-family: Poppins;
  color: #494949;
  background: none;
  padding: 32px;
  width: 100%;
  // max-width: 648px;
  resize: none;
  height: 150px;
  &:focus {
    background: #ffffff;
    box-shadow: 0px 4px 10px 3px rgba(0, 0, 0, 0.11);
  }
`
export default TextArea
