import * as contentful from 'contentful'

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
      limit: 1,
      locale: locale,
    })
    return result.items[0].fields
  } catch (error) {
    console.error('Error fetching landing page:', error)
  }
}
export const getAboutPageContent = async ({ locale }: IQueryParams) => {
  try {
    const result = await client.getEntries({
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
