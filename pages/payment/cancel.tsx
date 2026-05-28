import Header from '../../components/header/Header'
import Message from '../../components/message/Message'
import styled from '@emotion/styled'

import FrowningFace from '../../public/icons/FrowningFace'
import Button from '../../components/button/Button'
import Link from 'next/link'
import { GetStaticProps, InferGetStaticPropsType } from 'next'
import { getNavigation } from '../../modules/contentful/api'

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

const Cancel = ({ navigation }: InferGetStaticPropsType<typeof getStaticProps>) => {
  const message = `Oh no! Something went wrong during the payment process. Please try again`
  return (
    <>
      <Header navigation={navigation.header} />
      <Container>
        <Message asset={<FrowningFace />} title="Payment unsuccessful" text={message} />
        <Link href="/book">
          <Button>Back to booking</Button>
        </Link>
      </Container>
    </>
  )
}

export const getStaticProps = (async ({ locale }) => {
  const navigation = await getNavigation({ locale: locale || '' })
  return {
    props: { navigation },
    revalidate: 86400,
  }
}) satisfies GetStaticProps

export default Cancel
