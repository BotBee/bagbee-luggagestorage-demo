import styled from '@emotion/styled'
import React, { ReactNode } from 'react'
import ArrowRight from '../../public/icons/ArrowRight'

interface IButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  showArrow?: boolean
  loading?: boolean
  fullWidth?: boolean
  onClick?: () => void
}

const Container = styled.button<Pick<IButtonProps, 'fullWidth'>>`
  display: flex;
  gap: 8px;
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-weight: 600;
  font-size: 16px;
  line-height: 32px;
  color: white;
  background-color: ${({ theme, disabled }) =>
    disabled ? '#F4D199' : theme.colors.yellow};
  padding: 12px 80px;
  border-radius: 40px;
  min-width: 200px;
  justify-content: center;
  align-items: center;
  width: ${({ fullWidth }) => (fullWidth ? '100%' : 'initial')};
  white-space: nowrap;
  cursor: ${({ disabled }) => (disabled ? 'initial' : 'pointer')};
  &:hover {
    background-color: ${({ theme, disabled }) =>
      disabled ? '#F4D199' : theme.colors.orange};
  }
`

const Loader = styled.div`
  width: 32px;
  height: 32px;
  border: 3px solid #fff;
  border-bottom-color: ${({ theme }) => theme.colors.greyLight};
  border-radius: 50%;
  display: inline-block;
  box-sizing: border-box;
  animation: rotation 1s linear infinite;
  @keyframes rotation {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`

const Button = ({
  children,
  showArrow,
  fullWidth,
  onClick,
  loading = false,
  ...rest
}: IButtonProps) => {
  return (
    <Container onClick={onClick} fullWidth={fullWidth} {...rest}>
      {!loading ? (
        <>
          {children} {showArrow && <ArrowRight />}
        </>
      ) : (
        <Loader />
      )}
    </Container>
  )
}

export default Button
