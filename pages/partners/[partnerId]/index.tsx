import { GetServerSideProps } from 'next'
import { isPartnerId, verifyPartner } from '../../../utils/partnerAuth'

// Bare /partners/<partnerId>/ — redirects to dashboard if logged in for
// this partner, otherwise to the login page. Keeps URLs tidy when a staffer
// types just /partners/atlantik in the address bar.
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const partnerSlug = ctx.params?.partnerId
  if (!isPartnerId(partnerSlug)) return { notFound: true }
  const partnerId = partnerSlug
  const session = verifyPartner(ctx.req)
  return {
    redirect: {
      destination:
        session === partnerId
          ? `/partners/${partnerId}/dashboard`
          : `/partners/${partnerId}/login`,
      permanent: false,
    },
  }
}

const Index = () => null
export default Index
