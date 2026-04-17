import { documentToReactComponents } from '@contentful/rich-text-react-renderer'
import styled from '@emotion/styled'
import { NextSeo } from 'next-seo'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
import { IAboutPageFields } from '../@types/generated/contentful'
import en from '../common/locales/en'
import is from '../common/locales/is'
import Footer from '../components/footer/Footer'
import Header from '../components/header/Header'
import { getAboutPageContent } from '../modules/contentful/api'
import { contentfulImage } from '../utils/contentful'

interface IAboutPageProps {
  data: IAboutPageFields
}

const Container = styled.div`
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px;
`

const HeroContainer = styled.div`
  display: flex;
  gap: 32px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    gap: 64px;
    padding: 64px 0;
  }
  h1 {
    font-family: ${({ theme }) => theme.fonts.druk};
    color: ${({ theme }) => theme.colors.black};
    font-size: 60px;
    font-weight: 500;
    line-height: 110%;
    @media ${({ theme }) => theme.breakpoints.tablet} {
      font-size: 92px;
    }
  }
`

const ImageContainer = styled.div`
  position: relative;
  width: 100%;
  min-height: 180px;

  border-radius: 24px;
  overflow: hidden;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    min-height: 360px;
  }
  > img {
    object-fit: cover;
  }
`

const TextSection = styled.div`
  display: grid;
  padding: 64px 0;
  gap: 24px;

  @media ${({ theme }) => theme.breakpoints.tablet} {
    gap: 0;
    grid-template-columns: 1fr 1fr;
    h2 {
      max-width: 18ch;
      padding-right: 24px;
    }
  }

  p {
    color: #a3a4a7;
    font-family: Poppins;
    font-size: 16px;
    font-weight: 500;
    line-height: 32px;
  }
`

const SectionTitle = styled.h2`
  color: #000;
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-size: 35px;
  font-weight: 600;
  line-height: 52px;
  letter-spacing: -0.7px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    font-size: 50px;
    line-height: 72px; /* 144% */
  }
`

const LinksContainer = styled.div`
  > div {
    display: grid;
    gap: 24px;
    padding: 64px 0;
    border-top: 1px solid #b2b2b2;
    @media ${({ theme }) => theme.breakpoints.tablet} {
    }
    padding: 24px 0;
    > a {
      color: ${({ theme }) => theme.colors.yellow};
      &:hover {
        color: ${({ theme }) => theme.colors.orange};
      }
    }
  }

  @media ${({ theme }) => theme.breakpoints.tablet} {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
`

const StaffSection = styled.section`
  display: grid;
  margin: 80px 0;
  gap: 24px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    margin: 160px 0;
    grid-template-columns: 1fr 1fr;
  }
`

const StaffContainer = styled.div`
  display: grid;
  gap: 24px;
  @media ${({ theme }) => theme.breakpoints.tablet} {
    grid-template-columns: 1fr 1fr;
  }
`

const StaffMember = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  > div {
    display: flex;
    flex-direction: column;
    > h3 {
      color: #000
      font-family: ${({ theme }) => theme.fonts.poppins};
      font-size: 18px;
      font-weight: 600;
      line-height: 32px; 
    }
    > span {
      color: ${({ theme }) => theme.colors.greyLight}};
      font-family: ${({ theme }) => theme.fonts.poppins};
      font-size: 16px;
      font-weight: 500;
      line-height: 32px;
    }
`

const StaffImgContainer = styled.div`
  position: relative;
  min-height: 300px;
  border-radius: 16px;
  overflow: hidden;
  > img {
    object-fit: cover;
  }
`

const SectionTitleContainer = styled.div`
  color: ${({ theme }) => theme.colors.greyLight};
  font-family: ${({ theme }) => theme.fonts.poppins};
  font-size: 16px;
  font-weight: 500;
  line-height: 32px;

  a {
    color: ${({ theme }) => theme.colors.yellow};
    &:hover {
      color: ${({ theme }) => theme.colors.orange};
    }
  }
  p {
    padding: 16px 0;
  }
`
const About = ({ data }: IAboutPageProps) => {
  const router = useRouter()
  const { locale } = router
  const t = locale === 'en' ? en : is
  const {
    title,
    textSections,
    heroImage,
    mediaLinks,
    staff,
    staffSectionText,
    staffSectionTitle,
  } = data

  return (
    <>
      <NextSeo title='Bagbee | About us' />
      <Header />
      <Container>
        <HeroContainer>
          <h1>{title}</h1>
          <ImageContainer>
            <Image src={contentfulImage(heroImage)} fill alt='' />
          </ImageContainer>
        </HeroContainer>
        {textSections.map((section) => (
          <TextSection key={section.sys.id}>
            <SectionTitle>{section.fields.heading}</SectionTitle>
            <div>{documentToReactComponents(section.fields.text)}</div>
          </TextSection>
        ))}
        <LinksContainer>
          <span />
          <div>
            {mediaLinks.map((link) => (
              <a
                key={link.sys.id}
                href={link.fields.href}
                target='_blank'
                rel='noreferrer'
              >
                {link.fields.displayText}
              </a>
            ))}
          </div>
        </LinksContainer>
        <StaffSection>
          <SectionTitleContainer>
            <SectionTitle>{staffSectionTitle}</SectionTitle>
            <div>{documentToReactComponents(staffSectionText)}</div>
            <Link href='/#contact'>{t.aboutPage.contact}</Link>
          </SectionTitleContainer>
          <StaffContainer>
            {staff.map((member) => (
              <StaffMember key={member.sys.id}>
                <StaffImgContainer>
                  <Image
                    src={contentfulImage(member.fields.image)}
                    fill
                    alt=''
                  />
                </StaffImgContainer>
                <div>
                  <h3>{member.fields.name}</h3>
                  <span>{member.fields.role}</span>
                </div>
              </StaffMember>
            ))}
          </StaffContainer>
        </StaffSection>
      </Container>
      <Footer />
    </>
  )
}

export async function getStaticProps(params: any) {
  const data = await getAboutPageContent({
    locale: params.locale ? params.locale : '',
  })
  return {
    props: { data },
    revalidate: 10,
  }
}

export default About
