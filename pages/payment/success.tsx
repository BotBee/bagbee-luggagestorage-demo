import Lottie from 'react-lottie'
import Header from '../../components/header/Header'
import Message from '../../components/message/Message'
import styled from '@emotion/styled'

import * as animationData from '../../public/lottie/checkmark.json'
import { useRouter } from 'next/router'
import is from '../../common/locales/is'
import en from '../../common/locales/en'
import { GetStaticProps, InferGetStaticPropsType } from 'next'
import { getNavigation } from '../../modules/contentful/api'

const Container = styled.div`
  display: flex;
  align-items: center;
  padding: 0 24px;
  height: calc(100vh - 100px);
  > div {
    margin-bottom: 100px;
  }
`

const Success = ({ navigation }: InferGetStaticPropsType<typeof getStaticProps>) => {
  const router = useRouter()
  const { recordId } = router.query
  const { locale } = router
  const t = locale === 'en' ? en : is

  const defaultOptions = {
    loop: false,
    animationData: animationData,
    rendererSettings: {},
  }

  return (
    <>
      <Header navigation={navigation.header} />
      <Container>
        <>
          <Message
            asset={<Lottie options={defaultOptions} width="70%" />}
            title={t.successStep.title}
            text={t.successStep.message}
            bookingNumber={recordId as string}
          />
        </>
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

export default Success
