import * as contentful from 'contentful'

const space = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID
const accessToken = process.env.NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN

const client =
  space && accessToken ? contentful.createClient({ space, accessToken }) : null

// Queries

interface IQueryParams {
  locale: string
}

const fetchEntry = async (contentType: string, { locale }: IQueryParams) => {
  if (!client) return null
  try {
    const result = await client.getEntries({
      content_type: contentType,
      limit: 1,
      locale,
    })
    return result.items[0]?.fields ?? null
  } catch (error) {
    console.error(`Error fetching ${contentType}:`, error)
    return null
  }
}

export const getLandingPageContent = (p: IQueryParams) =>
  fetchEntry('landingPage', p)

export const getAboutPageContent = (p: IQueryParams) =>
  fetchEntry('aboutPage', p)

export const getPrivacyPolicy = (p: IQueryParams) =>
  fetchEntry('privacyPolicyPage', p)

export const getTermsAndAgreements = (p: IQueryParams) =>
  fetchEntry('termsAndAgreementsPage', p)
