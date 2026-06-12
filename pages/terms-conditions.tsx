import Header from '../components/header/Header'

import { getTermsAndAgreements, getNavigation } from '../modules/contentful/api'
import { ILink, ITermsAndAgreementsPageFields } from '../@types/generated/contentful'
import styled from '@emotion/styled'

import { documentToReactComponents } from '@contentful/rich-text-react-renderer'
import Footer from '../components/footer/Footer'

const Container = styled.section`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  max-width: 1240px;
  margin: 0 auto;
  padding: 24px;
  font-family: 'Poppins';
  min-height: calc(100vh - 550px);
  @media ${({ theme }) => theme.breakpoints.tablet} {
    padding: 48px;
  }
  h1,
  h2,
  h3,
  h4,
  h5 {
    color: ${({ theme }) => theme.colors.green};
  }
  h1 {
    font-size: 32px;
    line-height: 110%;
  }
`
interface TermsConditionsProps {
  data: ITermsAndAgreementsPageFields
  navigation: {
    header: ILink[]
    footer: ILink[]
  }
}

const TermsConditionsPage = ({ data, navigation }: TermsConditionsProps) => {
  return (
    <>
      <Header navigation={navigation.header} />
      <Container>{documentToReactComponents(data.termsAndAgreements)}</Container>
      <Footer navigation={navigation.footer} />
    </>
  )
}

export async function getStaticProps(params: any) {
  const data = await getTermsAndAgreements({
    locale: params.locale ? params.locale : '',
  })
  const navigation = await getNavigation({
    locale: params.locale ? params.locale : '',
  })
  return {
    props: { data, navigation },
    revalidate: 10,
  }
}

export default TermsConditionsPage
