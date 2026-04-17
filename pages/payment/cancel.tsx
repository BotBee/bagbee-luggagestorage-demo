import Header from '../../components/header/Header'
import Message from '../../components/message/Message'
import styled from '@emotion/styled'

import FrowningFace from '../../public/icons/FrowningFace'
import Button from '../../components/button/Button'
import Link from 'next/link'

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0 24px;
  height: calc(100vh - 100px);
  > div {
    margin-bottom: 100px;
  }
`

const Cancel = () => {
  const message = `Oh no! Something went wrong during the payment process. Please try again`
  return (
    <>
      <Header />
      <Container>
        <Message
          asset={<FrowningFace />}
          title='Payment unsuccessful'
          text={message}
        />
        <Link href='/book'>
          <Button>Back to booking</Button>
        </Link>
      </Container>
    </>
  )
}
export default Cancel
