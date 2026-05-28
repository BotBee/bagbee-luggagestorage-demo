import HeroSection from '../../components/landing-sections/HeroSection'
import Header from '../../components/header/Header'
import BenefitsSection from '../../components/landing-sections/BenefitsSection'
import { getFastTrackPageContent, getNavigation } from '../../modules/contentful/api'
import { ILandingPageFields, ILink } from '../../@types/generated/contentful'
import Footer from '../../components/footer/Footer'
import WhyBagBeeSection from '../../components/landing-sections/HowItWorksSection'
import OurPartners from '../../components/landing-sections/OurPartners'
import { ApplicationRoutes } from '../../utils/routing'

interface ILandingPageProps {
  data: ILandingPageFields
  navigation: {
    header: ILink[]
    footer: ILink[]
  }
}

const LandingPage = ({ data, navigation }: ILandingPageProps) => {
  const sections = {
    heroSectionData: data.heroSection,
    benefitsSectionData: data.benefitCards,
    howItWorksSectionData: data.howItWorksBlocks,
  }
  return (
    <>
      <Header navigation={navigation.header} />
      <HeroSection data={sections.heroSectionData} href={ApplicationRoutes.pages.fastTrack.index} />
      <BenefitsSection data={sections.benefitsSectionData} />
      <WhyBagBeeSection data={sections.howItWorksSectionData} />
      <OurPartners title={data.logoSectionTitle} />
      <Footer navigation={navigation.footer} />
    </>
  )
}

export async function getStaticProps(params: any) {
  const data = await getFastTrackPageContent({
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

export default LandingPage
