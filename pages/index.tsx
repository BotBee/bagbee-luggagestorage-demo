import Header from '../components/header/Header'
import BenefitsSection from '../components/landing-sections/BenefitsSection'
import { getLandingPageContent } from '../modules/contentful/api'
import { ILandingPageFields } from '../@types/generated/contentful'
import FAQSection from '../components/landing-sections/FAQSection'
import Footer from '../components/footer/Footer'
import PriceSection from '../components/landing-sections/PriceSection'
import WhyBagBeeSection from '../components/landing-sections/HowItWorksSection'
import VideoSection from '../components/landing-sections/VideoSections'
import OurPartners from '../components/landing-sections/OurPartners'
import WidgetAndText from '../components/trustpilot/WidgetAndText'
import ServiceSelector from '../components/landing-sections/ServiceSelector'

interface ILandingPageProps {
  data: ILandingPageFields
}

const LandingPage = ({ data }: ILandingPageProps) => {
  return (
    <>
      <Header />
      <ServiceSelector />
      {data && (
        <>
          {data.benefitCards && (
            <BenefitsSection data={data.benefitCards} />
          )}
          {data.howItWorksBlocks && (
            <WhyBagBeeSection data={data.howItWorksBlocks} />
          )}
          {data.trustpilotWidget && (
            <WidgetAndText data={data.trustpilotWidget} />
          )}
          {data.videoSection && <VideoSection data={data.videoSection} />}
          {data.priceSection && (
            <PriceSection data={data.priceSection} />
          )}
          <OurPartners title={data.logoSectionTitle} />
          {data.faq && data.faqSection && (
            <FAQSection faqs={data.faq} data={data.faqSection} />
          )}
        </>
      )}
      <Footer />
    </>
  )
}

export async function getStaticProps(params: any) {
  const data = await getLandingPageContent({
    locale: params.locale ? params.locale : '',
  })
  return {
    props: { data: data || null },
    revalidate: 10,
  }
}

export default LandingPage
