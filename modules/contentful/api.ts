import * as contentful from 'contentful'
import { IAboutPageFields, INavigationFields, IPageFields } from '../../@types/generated/contentful'
import compact from 'lodash/compact'

const client = contentful.createClient({
  space: process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID!,
  accessToken: process.env.NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN!,
})

// Queries

interface IQueryParams {
  locale: string
}
export const getLandingPageContent = async ({ locale }: IQueryParams) => {
  try {
    const result = await client.getEntries({
      content_type: 'landingPage',
      'fields.id': 'bagbee',
      limit: 1,
      locale: locale,
    })
    return result.items[0].fields
  } catch (error) {
    console.error('Error fetching landing page:', error)
  }
}

export const getFastTrackPageContent = async ({ locale }: IQueryParams) => {
  try {
    const result = await client.getEntries({
      content_type: 'landingPage',
      'fields.id': 'fast-track',
      limit: 1,
      locale: locale,
    })
    return result.items[0].fields;
  } catch (error) {
    console.error('Error fetching fast track page:', error);
  }
};

export const getAboutPageContent = async ({ locale }: IQueryParams) => {
  try {
    const result = await client.getEntries<IAboutPageFields>({
      content_type: 'aboutPage',
      limit: 1,
      locale: locale,
    })
    return result.items[0].fields
  } catch (error) {
    console.error('Error fetching about page:', error)
  }
}

export const getPrivacyPolicy = async ({ locale }: IQueryParams) => {
  try {
    const result = await client.getEntries({
      content_type: 'privacyPolicyPage',
      limit: 1,
      locale: locale,
    })
    return result.items[0].fields
  } catch (error) {
    console.error('Error fetching landing page:', error)
  }
}
export const getTermsAndAgreements = async ({ locale }: IQueryParams) => {
  try {
    const result = await client.getEntries({
      content_type: 'termsAndAgreementsPage',
      limit: 1,
      locale: locale,
    })
    return result.items[0].fields
  } catch (error) {
    console.error('Error fetching landing page:', error)
  }
}

export const getPageSlugs = async () => {
  try {
    const result = await client.getEntries<IPageFields>({
      content_type: 'page',
      select: 'fields.slug',
    })
    return result.items.map((item) => item.fields.slug)
  } catch (error) {
    console.error('Error fetching page slugs:', error)
    return []
  }
}

export const getPageBySlug = async (slug: string, locale: string) => {
  try {
    const result = await client.getEntries<IPageFields>({
      content_type: 'page',
      'fields.slug': slug,
      locale,
    })
    return result.items[0].fields
  } catch (error) {
    console.error('Error fetching page by slug:', error)
    return null
  }
}

export const getNavigation = async ({ locale }: IQueryParams) => {
  try {
    const siteNavigation = await client.getEntries<INavigationFields>({
      content_type: 'navigation',
      'fields.name': "Site",
      limit: 1,
      locale: locale,
    })
    const header = compact(siteNavigation.items[0].fields.items)
    const footerNavigation = await client.getEntries<INavigationFields>({
      content_type: 'navigation',
      'fields.name': "Footer",
      limit: 1,
      locale: locale,
    })
    const footer = compact(footerNavigation.items[0].fields.items)
    return {
      header,
      footer,
    }
  } catch (error) {
    console.error('Error fetching navigation:', error)
    return {
      header: [],
      footer: [],
    }
  }
}
