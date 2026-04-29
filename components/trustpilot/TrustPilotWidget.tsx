import styled from '@emotion/styled'
import React from 'react'

// Static representation of the Trustpilot score. The official widget loader
// would render an iframe with live data; we render a clickable card that
// links out to Trustpilot for the full review list. Score + review count
// match the latest snapshot — bump these when the numbers change, or wire
// up Trustpilot's read API later.
const REVIEW_COUNT = 278
const SCORE = 4.9
const TRUSTPILOT_URL = 'https://www.trustpilot.com/review/bagbee.is'
const TRUSTPILOT_GREEN = '#00b67a'

// Featured review — swap with the latest real 5-star review when refreshing
// the snapshot. Body should stay short enough to fit two-column desktop
// without dwarfing the score block (~3 lines max).
const FEATURED_REVIEW = {
  body: 'Frábær þjónusta! Töskurnar voru sóttar á réttum tíma og innritun á flugvellinum gekk eins og í sögu. Spara okkur klukkutíma af bið og stress — mæli eindregið með!',
  author: 'Anna J.',
  date: '12. mars 2026',
}

const Card = styled.a`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  background: #ffffff;
  border-radius: 32px;
  padding: 40px 32px;
  box-shadow: 0px 17px 62px rgba(2, 6, 12, 0.07);
  text-decoration: none;
  color: inherit;
  /* 10% smaller than the surrounding column — the card was visually
     dominating the heading next to it. transform-origin: top centers it
     horizontally and pulls it up so the section doesn't end with a gap. */
  transform: scale(0.9);
  transform-origin: top center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: scale(0.9) translateY(-2px);
    box-shadow: 0px 22px 70px rgba(2, 6, 12, 0.1);
  }
`

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  font-size: 18px;
  color: #000929;
  letter-spacing: -0.01em;
`

const StarsRow = styled.div`
  display: flex;
  gap: 4px;
`

const StarBox = styled.span`
  width: 38px;
  height: 38px;
  background: ${TRUSTPILOT_GREEN};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
`

const ScoreBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`

const ScoreLine = styled.div`
  font-family: 'Poppins', sans-serif;
  font-size: 18px;
  color: #000929;

  strong {
    font-weight: 600;
  }
`

const ReviewCount = styled.div`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #797979;
`

const VerifiedBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ecfaf3;
  border: 1px solid #c8efdc;
  border-radius: 999px;
  padding: 6px 12px;
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: ${TRUSTPILOT_GREEN};
  letter-spacing: 0.02em;
`

const Divider = styled.div`
  width: 100%;
  height: 1px;
  background: #efeff3;
  margin: 4px 0;
`

const ReviewBlock = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const SmallStarsRow = styled.div`
  display: flex;
  gap: 3px;
`

const SmallStarBox = styled.span`
  width: 18px;
  height: 18px;
  background: ${TRUSTPILOT_GREEN};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
`

const ReviewBody = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  line-height: 22px;
  color: #000929;
  margin: 0;
  font-style: italic;

  &::before {
    content: '“';
    margin-right: 2px;
  }
  &::after {
    content: '”';
    margin-left: 2px;
  }
`

const ReviewMeta = styled.div`
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  color: #797979;

  strong {
    font-weight: 600;
    color: #000929;
  }
`

const TrustpilotMark = () => (
  <svg width='22' height='22' viewBox='0 0 22 22' aria-hidden>
    <polygon
      fill={TRUSTPILOT_GREEN}
      points='11,1 13.83,7.74 21,8.31 15.5,13.07 17.21,20.06 11,16.27 4.79,20.06 6.5,13.07 1,8.31 8.17,7.74'
    />
  </svg>
)

const StarMark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox='0 0 22 22' aria-hidden>
    <polygon
      fill='#ffffff'
      points='11,3 13.47,8.84 19.78,9.34 14.95,13.42 16.49,19.6 11,16.27 5.51,19.6 7.05,13.42 2.22,9.34 8.53,8.84'
    />
  </svg>
)

const VerifiedCheck = () => (
  <svg width='12' height='12' viewBox='0 0 24 24' aria-hidden>
    <path
      fill={TRUSTPILOT_GREEN}
      d='M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
    />
  </svg>
)

const TrustPilotWidget = () => {
  return (
    <Card
      href={TRUSTPILOT_URL}
      target='_blank'
      rel='noopener noreferrer'
      aria-label={`Trustpilot — ${SCORE} out of 5, based on ${REVIEW_COUNT} reviews`}
    >
      <Brand>
        <TrustpilotMark />
        Trustpilot
      </Brand>

      <StarsRow>
        {[0, 1, 2, 3, 4].map((i) => (
          <StarBox key={i}>
            <StarMark />
          </StarBox>
        ))}
      </StarsRow>

      <ScoreBlock>
        <ScoreLine>
          <strong>Excellent</strong> — {SCORE.toFixed(1)} / 5
        </ScoreLine>
        <ReviewCount>Based on {REVIEW_COUNT} reviews</ReviewCount>
      </ScoreBlock>

      <VerifiedBadge>
        <VerifiedCheck />
        Verified company
      </VerifiedBadge>

      <Divider />

      <ReviewBlock>
        <SmallStarsRow>
          {[0, 1, 2, 3, 4].map((i) => (
            <SmallStarBox key={i}>
              <StarMark size={12} />
            </SmallStarBox>
          ))}
        </SmallStarsRow>
        <ReviewBody>{FEATURED_REVIEW.body}</ReviewBody>
        <ReviewMeta>
          <strong>{FEATURED_REVIEW.author}</strong> · {FEATURED_REVIEW.date}
        </ReviewMeta>
      </ReviewBlock>
    </Card>
  )
}

export default TrustPilotWidget
