import { documentToReactComponents } from '@contentful/rich-text-react-renderer'
import styled from '@emotion/styled'
import { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next'
import { NextSeo } from 'next-seo'
import Image from 'next/image'
import React from 'react'
import { IImageAndText, ITextSection } from '../../@types/generated/contentful'
import Footer from '../../components/footer/Footer'
import Header from '../../components/header/Header'
import ImageText from '../../components/image-text/ImageText'
import { getPageBySlug, getPageSlugs, getNavigation } from '../../modules/contentful/api'
import { contentfulImage } from '../../utils/contentful'

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
    padding: 0 48px;
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
  margin-top: 32px;
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
    margin-top: 64px;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
`

const isImageAndText = (item: IImageAndText | ITextSection): item is IImageAndText => {
  return 'image' in item.fields
}

const isTextSection = (item: IImageAndText | ITextSection): item is ITextSection => {
  return 'heading' in item.fields
}

const Page = ({ data, navigation }: InferGetStaticPropsType<typeof getStaticProps>) => {
  const { title, heroImage, mediaLinks, content } = data

  return (
    <>
      <NextSeo title={`Bagbee | ${title}`} />
      <Header navigation={navigation.header} />
      <Container>
        <HeroContainer>
          <h1>{title}</h1>
          {heroImage && (
            <ImageContainer>
              <Image src={contentfulImage(heroImage)} fill alt="" />
            </ImageContainer>
          )}
        </HeroContainer>
        {content &&
          content.map((item, i) => {
            if (isTextSection(item)) {
              return (
                <TextSection key={item.sys.id}>
                  <SectionTitle>{item.fields.heading}</SectionTitle>
                  <div>{documentToReactComponents(item.fields.text)}</div>
                </TextSection>
              )
            }
            if (isImageAndText(item)) {
              return (
                <ImageText
                  key={item.sys.id}
                  image={contentfulImage(item.fields.image)}
                  ctaText={item.fields.ctaButtonText}
                  ctaLink={item.fields.url}
                  title={item.fields.title}
                  text={item.fields.text}
                  reverse={i! % 2}
                />
              )
            }
          })}
        {mediaLinks && (
          <LinksContainer>
            <span />
            <div>
              {mediaLinks.map((link) => (
                <a key={link.sys.id} href={link.fields.href} target="_blank" rel="noreferrer">
                  {link.fields.displayText}
                </a>
              ))}
            </div>
          </LinksContainer>
        )}
      </Container>
      <Footer navigation={navigation.footer} />
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async ({ locales }) => {
  const paths: { params: { slug: string }; locale: string }[] = []

  if (locales) {
    const slugs = await getPageSlugs()

    for (const locale of locales) {
      for (const slug of slugs) {
        paths.push({
          params: { slug },
          locale,
        })
      }
    }
  }

  return {
    paths,
    fallback: 'blocking',
  }
}

export const getStaticProps = (async ({ params, locale }) => {
  const slug = params?.slug as string
  const data = await getPageBySlug(slug, locale || '')
  const navigation = await getNavigation({
    locale: locale || '',
  })

  if (!data) {
    return {
      notFound: true,
      revalidate: 300,
    }
  }

  return {
    props: { data, navigation },
    revalidate: 300,
  }
}) satisfies GetStaticProps

export default Page
