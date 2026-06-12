import React from 'react'
import styled from '@emotion/styled'

/**
 * Co-branded header for the partner booking popups (luggagelockers.is,
 * bikerent.is). The partner's brand reads as the primary mark — these forms
 * live on the partner's own site — with the BagBee logo + a small "partner"
 * caption beside it so it's clear who powers payment & support.
 *
 * Both partner brands ship as text wordmarks (no logo files), so the partner
 * mark is rendered as a styled wordmark. If real logo assets arrive later, drop
 * them in /public/images/partners and swap `partnerName` for an <img>.
 */

const Wrap = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid #eceef2;
  background: #ffffff;
`

const PartnerBrand = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
`

const PartnerWordmark = styled.span<{ $color?: string; $tracking?: string }>`
  font-family: 'Poppins', sans-serif;
  font-weight: 800;
  letter-spacing: ${({ $tracking }) => $tracking || '0.05em'};
  font-size: 19px;
  line-height: 1.05;
  color: ${({ $color }) => $color || '#12141d'};
  text-transform: uppercase;
  @media (min-width: 560px) {
    font-size: 23px;
  }
`

const PartnerSub = styled.span`
  font-family: 'Poppins', sans-serif;
  font-size: 11px;
  color: #9aa3b2;
`

const CoBrand = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
`

const BagBeeLogo = styled.img`
  height: 24px;
  width: auto;
  display: block;
`

const PartnerTag = styled.span`
  font-family: 'Poppins', sans-serif;
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #9aa3b2;
`

type Props = {
  /** Partner brand wordmark, e.g. "Luggage Lockers" or "Bike Rent Iceland". */
  partnerName: string
  /** Optional small line under the wordmark, e.g. a location. */
  partnerSubtitle?: string
  /** Wordmark colour (defaults to near-black). */
  partnerColor?: string
  /** Letter-spacing override for the wordmark. */
  tracking?: string
}

const PartnerFormHeader: React.FC<Props> = ({
  partnerName,
  partnerSubtitle,
  partnerColor,
  tracking,
}) => (
  <Wrap>
    <PartnerBrand>
      <PartnerWordmark $color={partnerColor} $tracking={tracking}>
        {partnerName}
      </PartnerWordmark>
      {partnerSubtitle && <PartnerSub>{partnerSubtitle}</PartnerSub>}
    </PartnerBrand>
    <CoBrand>
      <BagBeeLogo src='/images/bagbee-logo-green.svg' alt='BagBee' />
      <PartnerTag>partner</PartnerTag>
    </CoBrand>
  </Wrap>
)

export default PartnerFormHeader
