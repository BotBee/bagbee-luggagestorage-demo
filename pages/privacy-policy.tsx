import Header from '../components/header/Header'

import { getPrivacyPolicy } from '../modules/contentful/api'
import { IPrivacyPolicyPageFields } from '../@types/generated/contentful'
import styled from '@emotion/styled'

import { documentToReactComponents } from '@contentful/rich-text-react-renderer'
import Footer from '../components/footer/Footer'

const Container = styled.section`
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1240px;
  margin: 0 auto;
  padding: 24px;
  font-family: 'Poppins';
  min-height: calc(100vh - 550px);

  @media ${({ theme }) => theme.breakpoints.tablet} {
    padding: 48px;
  }

  h1 {
    font-size: 32px;
    line-height: 110%;
    color: ${({ theme }) => theme.colors.green};
  }
`
interface PrivacyPolicyProps {
  data: IPrivacyPolicyPageFields | null
}

const PrivacyPolicyPage = ({ data }: PrivacyPolicyProps) => {
  return (
    <>
      <Header />
      <Container>
        {data
          ? documentToReactComponents(data.privacyPolicy)
          : <p>Content is temporarily unavailable.</p>}
      </Container>
      <Footer />
    </>
  )
}

export async function getStaticProps(params: any) {
  const data = await getPrivacyPolicy({
    locale: params.locale ? params.locale : '',
  })
  return {
    props: { data },
    revalidate: 10,
  }
}

export default PrivacyPolicyPage
