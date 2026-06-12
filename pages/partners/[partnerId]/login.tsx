import styled from '@emotion/styled'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import BagBeeLogo from '../../../public/icons/Logo'
import { PARTNERS, PartnerId, isPartnerId, verifyPartner } from '../../../utils/partnerAuth'

type Props = { partnerId: PartnerId; partnerDisplayName: string }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const partnerSlug = ctx.params?.partnerId
  if (!isPartnerId(partnerSlug)) return { notFound: true }
  const partnerId = partnerSlug
  // If already logged in to THIS partner, jump to the dashboard.
  if (verifyPartner(ctx.req) === partnerId) {
    return {
      redirect: { destination: `/partners/${partnerId}/dashboard`, permanent: false },
    }
  }
  return {
    props: { partnerId, partnerDisplayName: PARTNERS[partnerId].displayName },
  }
}

const Page = styled.div`
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #f5f6fa;
  padding: 24px;
`

const Card = styled.div`
  width: 100%;
  max-width: 400px;
  background: white;
  border: 1px solid #ecedf0;
  border-radius: 12px;
  padding: 32px;
`

// Wraps the BagBee SVG wordmark — sized to sit comfortably above the title.
// The wordmark already includes the "BagBee" letterforms so we don't repeat
// the name as a text logo block.
const LogoMark = styled.div`
  margin-bottom: 18px;
  & svg {
    height: 28px;
    width: auto;
  }
`

const Title = styled.h1`
  font-family: 'Poppins', sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #000929;
  margin: 0 0 4px;
`

const Sub = styled.p`
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  color: #696f79;
  margin: 0 0 28px;
`

const Label = styled.label`
  display: block;
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: #000929;
  margin-bottom: 8px;
`

const Input = styled.input`
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #d9dde2;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
  &:focus { border-color: #3d7165; }
`

// Big, monospaced, letterspaced — codes are 6 digits and the spacing
// makes them readable while typing.
const CodeInput = styled.input`
  width: 100%;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid #d9dde2;
  font-family: 'Poppins', sans-serif;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 10px;
  text-align: center;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
  &:focus { border-color: #3d7165; }
`

const Button = styled.button`
  width: 100%;
  margin-top: 20px;
  padding: 13px 16px;
  border-radius: 12px;
  border: none;
  background: #3d7165;
  color: white;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
  &:hover:enabled { background: #345f55; transform: translateY(-1px); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`

const LinkButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  margin-top: 14px;
  color: #3d7165;
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
  &:disabled { opacity: 0.5; cursor: not-allowed; text-decoration: none; }
`

const Err = styled.div`
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #fdecea;
  color: #b3261e;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
`

const Ok = styled.div`
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #e7f6ec;
  color: #176c2c;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
`

const Hint = styled.div`
  margin-top: 16px;
  font-family: 'Poppins', sans-serif;
  font-size: 11px;
  color: #a3a4a7;
  text-align: center;
`

const EmailLine = styled.div`
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  color: #696f79;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const EmailValue = styled.span`
  color: #000929;
  font-weight: 500;
  word-break: break-all;
`

// Two-step UI:
//   step 1 — collect email, POST /request-code
//   step 2 — collect 6-digit code, POST /verify-code
//
// We keep the same Card chrome between steps so the transition is just a
// content swap; no route change.

type Step = 'email' | 'code'

export default function PartnerLogin({ partnerId, partnerDisplayName }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  // Pick the placeholder domain from the partner's allowlist — the first
  // entry that isn't bagbee.is (which is our internal debug-access domain,
  // not the partner staffer's actual work email). Falls back to the first
  // allowed domain if all of them are bagbee.is (shouldn't happen).
  const primaryDomain =
    PARTNERS[partnerId].allowedDomains.find((d) => d !== 'bagbee.is') ||
    PARTNERS[partnerId].allowedDomains[0]
  const emailPlaceholder = `you@${primaryDomain}`

  // Auto-focus the code input when we land on step 2.
  useEffect(() => {
    if (step === 'code') {
      codeRef.current?.focus()
    }
  }, [step])

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`/api/partners/${partnerId}/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message || 'Could not send the code.')
        setLoading(false)
        return
      }
      setStep('code')
      setInfo(`We sent a 6-digit code to ${email}. Check your inbox.`)
      setLoading(false)
    } catch (err) {
      setError('Network error — please try again.')
      setLoading(false)
    }
  }

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`/api/partners/${partnerId}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message || 'Could not verify the code.')
        setLoading(false)
        return
      }
      // Logged in — go straight to the dashboard. The dashboard's
      // getServerSideProps will see the session cookie and load orders.
      router.replace(`/partners/${partnerId}/dashboard`)
    } catch (err) {
      setError('Network error — please try again.')
      setLoading(false)
    }
  }

  const resendCode = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`/api/partners/${partnerId}/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.message || 'Could not resend the code.')
      } else {
        setInfo('Sent another code. Old codes are no longer valid.')
        setCode('')
      }
    } catch (err) {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  const changeEmail = () => {
    setStep('email')
    setCode('')
    setError(null)
    setInfo(null)
  }

  return (
    <Page>
      <Card>
        <LogoMark>
          <BagBeeLogo fill="#3d7165" />
        </LogoMark>
        <Title>{partnerDisplayName}</Title>
        <Sub>Partner portal · sign in with a code emailed to you</Sub>

        {step === 'email' ? (
          <form onSubmit={submitEmail}>
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={emailPlaceholder}
              autoFocus
              autoComplete="email"
              required
            />
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? 'Sending…' : 'Email me a code'}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitCode}>
            <EmailLine>
              <EmailValue>{email}</EmailValue>
              <LinkButton type="button" onClick={changeEmail} disabled={loading}>
                Change
              </LinkButton>
            </EmailLine>
            <Label htmlFor="code">6-digit code</Label>
            <CodeInput
              id="code"
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="\d{6}"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              placeholder="••••••"
              required
            />
            <Button type="submit" disabled={loading || code.length !== 6}>
              {loading ? 'Verifying…' : 'Sign in'}
            </Button>
            <LinkButton type="button" onClick={resendCode} disabled={loading}>
              Send a new code
            </LinkButton>
          </form>
        )}

        {info && <Ok>{info}</Ok>}
        {error && <Err>{error}</Err>}
        <Hint>Forgotten access? Email bagbee@bagbee.is</Hint>
      </Card>
    </Page>
  )
}
