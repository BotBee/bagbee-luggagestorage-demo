import { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import { useEffect, useState } from 'react'
import Lottie from 'react-lottie'
import { AirtableOrder } from '../../common/types'
import Header from '../../components/header/Header'
import Loader from '../../components/loader/Loader'
import Message from '../../components/message/Message'
import { updateOrderToPayed } from '../../modules/AirTable/api'
import styled from '@emotion/styled'

import { getMinifiedItem } from '../../utils/airtable'
import { ApplicationRoutes } from '../../utils/routing'
import * as animationData from '../../public/lottie/checkmark.json'
import { useRouter } from 'next/router'
import is from '../../common/locales/is'
import en from '../../common/locales/en'
import { useBookingStore } from '../../store/store'
import Button from '../../components/button/Button'

const Container = styled.div`
  display: flex;
  align-items: center;
  padding: 0 24px;
  height: calc(100vh - 100px);
  > div {
    margin-bottom: 100px;
  }
`

const Success = ({
  recordId,
}: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const serviceType = useBookingStore((state) => state.booking.serviceType)
  const [order, setOrder] = useState<AirtableOrder>()
  useEffect(() => {
    updateOrderToPayed(recordId).then((res) => {
      const foo = getMinifiedItem(res)

      setOrder(foo.fields as AirtableOrder)
    })
  }, [recordId])

  const defaultOptions = {
    loop: false,
    animationData: animationData,
    rendererSettings: {},
  }
  return (
    <>
      <Header />
      <Container>
        {order ? (
          <>
            <Message
              asset={<Lottie options={defaultOptions} width='70%' />}
              title={t.successStep.title}
              text={t.successStep.message}
              bookingNumber={recordId}
            />
            {serviceType === 'both' && (
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <p
                  style={{
                    fontFamily: 'Poppins',
                    fontSize: 16,
                    color: '#696f79',
                    marginBottom: 16,
                  }}
                >
                  Your departure service is booked! Now let&apos;s set up your
                  arrival service.
                </p>
                <Button
                  onClick={() =>
                    router.push(ApplicationRoutes.arrival.book)
                  }
                >
                  Continue to arrival booking
                </Button>
              </div>
            )}
          </>
        ) : (
          <Loader text={t.loadingScreen.loadingOrderCompleteText} />
        )}
      </Container>
    </>
  )
}

interface Props {
  recordId: string
}

export const getServerSideProps: GetServerSideProps<Props> = async ({
  query,
}) => {
  if (!query || !query.recordId)
    return {
      props: {},
      redirect: {
        permanent: false,
        destination: ApplicationRoutes.pages.book,
      },
    }

  const recordId: string = query.recordId as string

  return {
    props: {
      recordId,
    },
  }
}

export default Success
