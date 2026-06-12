import styled from '@emotion/styled'
import { useEffect, useMemo, useState } from 'react'
import en from '../../common/locales/en'
import is from '../../common/locales/is'

// White card placed at the top of /orders/{code} for charter-flight orders
// (Icelandair flight numbers matching FI1XXX, e.g. FI1080). Collects every
// passenger's full name so BagBee can check the whole party in via Amadeus.
//
// Replaces the legacy flow where customers got an email with a link to a
// Fillout form. Same wording, just inline on their order page.
//
// Detection of "is this a charter flight order" lives in [orderNo].tsx; this
// component just renders the form when handed a flightNumber + customerName.

interface ICharterPassengerCardProps {
  recordId: string
  flightNumber: string
  customerName: string
  locale: string
  // Notifies the parent whenever this card knows the passenger list — both
  // on mount (if a previous submission exists in Leiguflug) and right after
  // a fresh submit. Lets /orders/[orderNo].tsx pre-fill the Fast-Track form
  // with the same names without re-asking the customer.
  // eslint-disable-next-line no-unused-vars
  onPassengersAvailable?: (passengers: string[]) => void
}

const Card = styled.section`
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #e5e6eb;
  padding: 24px;
  margin-bottom: 32px;
`

const Title = styled.h2`
  font-family: 'Poppins', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: #000929;
  margin: 0 0 12px;
`

const Body = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  line-height: 22px;
  color: #696f79;
  margin: 0 0 14px;

  strong {
    color: #000929;
    font-weight: 600;
  }
`

const PassengerRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  &:last-of-type {
    border-bottom: none;
  }
`

const PassengerLabelRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const PassengerLabel = styled.span`
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: #696f79;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`

const RemoveButton = styled.button`
  background: transparent;
  border: none;
  color: #c33;
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
`

const NameInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  font-family: 'Poppins', sans-serif;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  outline: none;
  box-sizing: border-box;
  &:focus {
    border-color: #f3ad3c;
  }
`

const AddButton = styled.button`
  width: 100%;
  padding: 12px;
  background: transparent;
  border: 1px dashed #f3ad3c;
  border-radius: 12px;
  color: #e37f2f;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 16px;
`

const SubmitButton = styled.button`
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #f3ad3c 0%, #e37f2f 100%);
  border: none;
  border-radius: 12px;
  color: white;
  font-family: 'Poppins', sans-serif;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 16px;
  transition: opacity 0.2s ease;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`

const ErrorText = styled.p`
  color: #c33;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  margin: 12px 0 0;
  text-align: center;
`

const SmallNote = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  line-height: 18px;
  color: #8a8a94;
  margin: 12px 0 0;
`

const SuccessTitle = styled.h2`
  font-family: 'Poppins', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: #1a8536;
  margin: 0 0 8px;
`

const SuccessBody = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  line-height: 22px;
  color: #696f79;
  margin: 0;
`

const SuccessList = styled.ul`
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  color: #000929;
  margin: 12px 0 0;
  padding-left: 20px;
`

const CharterPassengerCard = ({
  recordId,
  flightNumber,
  customerName,
  locale,
  onPassengersAvailable,
}: ICharterPassengerCardProps) => {
  const t = useMemo(() => (locale === 'en' ? en : is).orderTrackingPage, [locale])

  // Server says: have we already submitted? Stays `null` while we're loading
  // so we don't flash the form for already-submitted orders.
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [submittedNames, setSubmittedNames] = useState<string[] | null>(null)

  const [passengers, setPassengers] = useState<string[]>([customerName || ''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check existing submissions on mount.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/charter/status?recordId=${encodeURIComponent(recordId)}`,
        )
        const data = await res.json()
        if (cancelled) return
        if (data?.submitted) {
          const names = Array.isArray(data.passengers) ? data.passengers : []
          setSubmittedNames(names)
          if (names.length > 0) onPassengersAvailable?.(names)
        }
      } catch {
        // Soft-fail — show the form. Worst case the customer submits twice
        // and BagBee de-duplicates manually.
      } finally {
        if (!cancelled) setStatusLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
    // onPassengersAvailable is treated as a stable callback (the parent
    // passes the useState setter directly, which React guarantees stable).
    // Adding it to deps would re-fire the status fetch on every parent
    // render that creates a new function ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId])

  const updatePassenger = (i: number, name: string) => {
    setPassengers((prev) => {
      const next = [...prev]
      next[i] = name
      return next
    })
  }

  const addPassenger = () => {
    if (passengers.length >= 8) return
    setPassengers((prev) => [...prev, ''])
  }

  const removePassenger = (i: number) => {
    setPassengers((prev) => prev.filter((_, j) => j !== i))
  }

  const canSubmit =
    passengers.length > 0 &&
    passengers.every((p) => p && p.trim().length > 0) &&
    !submitting

  const onSubmit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/charter/passengers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          passengers: passengers.map((p) => p.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Failed')
      }
      const finalNames = passengers.map((p) => p.trim()).filter(Boolean)
      setSubmittedNames(finalNames)
      if (finalNames.length > 0) onPassengersAvailable?.(finalNames)
    } catch (err: any) {
      console.error('[charter] submit error', err)
      setError(t.charterError)
    } finally {
      setSubmitting(false)
    }
  }

  // Don't render anything until we know the submission status — avoids
  // briefly flashing the form before flipping to the thank-you state.
  if (!statusLoaded) return null

  if (submittedNames) {
    return (
      <Card>
        <SuccessTitle>{t.charterSuccessTitle}</SuccessTitle>
        <SuccessBody>{t.charterSuccessText}</SuccessBody>
        {submittedNames.length > 0 && (
          <SuccessList>
            {submittedNames.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </SuccessList>
        )}
      </Card>
    )
  }

  return (
    <Card>
      <Title>{t.charterTitle}</Title>
      <Body>{t.charterIntro.replace('{flightNumber}', flightNumber)}</Body>

      {passengers.map((name, i) => (
        <PassengerRow key={i}>
          <PassengerLabelRow>
            <PassengerLabel>
              {i === 0
                ? t.charterMainPassenger
                : t.charterPassengerLabel.replace('{n}', String(i + 1))}
            </PassengerLabel>
            {i > 0 && (
              <RemoveButton type='button' onClick={() => removePassenger(i)}>
                {t.charterRemovePassenger}
              </RemoveButton>
            )}
          </PassengerLabelRow>
          <NameInput
            type='text'
            value={name}
            placeholder={t.charterPassengerLabel.replace('{n}', String(i + 1))}
            onChange={(e) => updatePassenger(i, e.target.value)}
          />
        </PassengerRow>
      ))}

      {passengers.length < 8 && (
        <AddButton type='button' onClick={addPassenger}>
          {t.charterAddPassenger}
        </AddButton>
      )}

      <SubmitButton type='button' disabled={!canSubmit} onClick={onSubmit}>
        {submitting ? t.charterSubmitting : t.charterSubmit}
      </SubmitButton>

      {error && <ErrorText>{error}</ErrorText>}

      <SmallNote>{t.charterBaggageNote}</SmallNote>
    </Card>
  )
}

export default CharterPassengerCard
