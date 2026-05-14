import { GetServerSideProps } from 'next'
import { verifyPartner } from '../../../utils/partnerAuth'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const partner = verifyPartner(ctx.req)
  return {
    redirect: {
      destination:
        partner === 'iceland-travel'
          ? '/partners/iceland-travel/dashboard'
          : '/partners/iceland-travel/login',
      permanent: false,
    },
  }
}

const Index = () => null
export default Index
