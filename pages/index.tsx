import HeroSection from '../components/landing-sections/HeroSection'
import Header from '../components/header/Header'
import BenefitsSection from '../components/landing-sections/BenefitsSection'
import { getLandingPageContent, getNavigation } from '../modules/contentful/api'
import { ILandingPageFields, ILink } from '../@types/generated/contentful'
import FAQSection from '../components/landing-sections/FAQSection'
import Footer from '../components/footer/Footer'
import PriceSection from '../components/landing-sections/PriceSection'
import WhyBagBeeSection from '../components/landing-sections/HowItWorksSection'
import VideoSection from '../components/landing-sections/VideoSections'
import OurPartners from '../components/landing-sections/OurPartners'
import WidgetAndText from '../components/trustpilot/WidgetAndText'

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
    faqSectionData: data.faqSection,
    faqData: data.faq,
    priceSectionData: data.priceSection,
    videoSection: data.videoSection,
    trustPilotData: data.trustpilotWidget,
  }
  return (
    <>
      <Header navigation={navigation.header} />
      <HeroSection data={sections.heroSectionData} />
      <BenefitsSection data={sections.benefitsSectionData} />
      <WhyBagBeeSection data={sections.howItWorksSectionData} />
      <WidgetAndText data={sections.trustPilotData} />
      <VideoSection data={sections.videoSection} />
      <PriceSection data={sections.priceSectionData} />
      <OurPartners title={data.logoSectionTitle} />
      <FAQSection faqs={sections.faqData} data={sections.faqSectionData} />
      <Footer navigation={navigation.footer} />
    </>
  )
}

export async function getStaticProps(params: any) {
  const data = await getLandingPageContent({
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
