import styled from '@emotion/styled'

import 'react-phone-input-2/lib/style.css'
import PhoneInput from 'react-phone-input-2'

const StyledPhoneInput = styled(PhoneInput)`
  > div {
    display: flex;
    justify-content: center;
    min-width: 100px;
    min-width: 70px;
    border-top-left-radius: 6px !important;
    border-bottom-left-radius: 6px !important;
    border: 1px solid #8692a6 !important;
    border-right: 1px solid #8692a6 !important;
    > div {
      width: 100% !important;
      display: flex;
      justify-content: center;
      padding: 0 !important;
      &:hover {
        border-radius: 6px;
        background: none !important;
      }
    }
  }
  input {
    height: 64px !important;
    border-radius: 6px !important;
    border: 1px solid #8692a6 !important;
    font-weight: 500 !important;
    font-size: 16px !important;
    line-height: 18px !important;
    display: flex !important;
    align-items: center !important;
    font-family: Poppins !important;
    color: #12141d !important;
    background: none !important;
    padding-left: 80px !important;
    width: 100% !important;
    &:focus {
      background: #ffffff !important;
      box-shadow: 0px 4px 10px 3px rgba(0, 0, 0, 0.11);
    }
  }
  ul {
    margin-left: 230px !important;
    margin-top: 78px !important;
    width: 300px !important;
    border-radius: 6px !important;
    border: 1px solid #000000 !important;
    padding: 12px !important;
    li {
      font-family: 'Poppins';
      font-size: 16px;
      height: 40px;
      div {
      }
    }
  }
`

export default StyledPhoneInput
