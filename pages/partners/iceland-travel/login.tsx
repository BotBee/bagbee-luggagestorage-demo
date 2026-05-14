import styled from '@emotion/styled'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { verifyPartner } from '../../../utils/partnerAuth'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  if (verifyPartner(ctx.req) === 'iceland-travel') {
    return {
      redirect: { destination: '/partners/iceland-travel/dashboard', permanent: false },
    }
  }
  return { props: {} }
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

const Logo = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: #3d7165;
  color: white;
  display: grid;
  place-items: center;
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 16px;
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

const Err = styled.div`
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #fdecea;
  color: #b3261e;
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

export default function PartnerLogin() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/partners/iceland-travel/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message || 'Login failed')
        setLoading(false)
        return
      }
      router.replace('/partners/iceland-travel/dashboard')
    } catch (err) {
      setError('Network error — please try again.')
      setLoading(false)
    }
  }

  return (
    <Page>
      <Card>
        <Logo>BB</Logo>
        <Title>Iceland Travel</Title>
        <Sub>Partner portal · sign in to manage your bookings</Sub>
        <form onSubmit={onSubmit}>
          <Label htmlFor="password">Access password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
            autoComplete="current-password"
            required
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
          {error && <Err>{error}</Err>}
        </form>
        <Hint>Forgotten the password? Email runar@bagbee.is</Hint>
      </Card>
    </Page>
  )
}
