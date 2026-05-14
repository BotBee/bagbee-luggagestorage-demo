import styled from '@emotion/styled'
import { useEffect, useState } from 'react'

// Two affordances:
//   1) Message the BagBee driver directly (sms: link with templates).
//   2) Share the driver's contact info with a third party (e.g. the tour
//      guide or bus driver who needs to know who's picking up the bags) —
//      prompts for a recipient phone and pre-fills the SMS body in the
//      format requested by the partner.
//
// Both fall back to "Copy" buttons on desktop because `sms:` doesn't always
// open an app there.

const Wrapper = styled.div`
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ToggleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

const ToggleButton = styled.button<{ primary?: boolean }>`
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 600;
  background: ${({ primary }) => (primary ? '#eef5ff' : '#f0f4f3')};
  color: ${({ primary }) => (primary ? '#2d7ff9' : '#2d5d52')};
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  &:hover {
    background: ${({ primary }) => (primary ? '#dde9fc' : '#dceae5')};
  }
`

const Composer = styled.div`
  background: #f7f8fa;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  padding: 12px;
  font-family: 'Poppins', sans-serif;
`

const ComposerHead = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: #696f79;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 8px;
`

const Textarea = styled.textarea`
  width: 100%;
  padding: 9px 11px;
  border-radius: 10px;
  border: 1px solid #d9dde2;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  min-height: 84px;
  outline: none;
  resize: vertical;
  background: white;
  &:focus { border-color: #3d7165; }
`

const PhoneInput = styled.input`
  width: 100%;
  padding: 9px 11px;
  border-radius: 10px;
  border: 1px solid #d9dde2;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  outline: none;
  background: white;
  margin-bottom: 8px;
  &:focus { border-color: #3d7165; }
`

const FieldLabel = styled.label`
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #696f79;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 4px;
`

const ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  align-items: center;
`

const SendButton = styled.a`
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 8px;
  background: #3d7165;
  color: white;
  text-decoration: none;
  display: inline-block;
  &:hover { background: #345f55; }
  &[aria-disabled='true'] {
    opacity: 0.5;
    pointer-events: none;
  }
`

const SecondaryButton = styled.button`
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 500;
  padding: 7px 12px;
  border-radius: 8px;
  background: white;
  border: 1px solid #d9dde2;
  color: #000929;
  cursor: pointer;
  &:hover { background: #f5f6fa; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`

const Toast = styled.span`
  font-size: 11px;
  color: #176c2c;
  font-weight: 600;
`

type Props = {
  driverPhone: string
  driverName: string | null
}

const buildSmsHref = (phone: string, body: string): string => {
  // sms: scheme. iOS prefers `&body=`, Android prefers `?body=` — both
  // accept the same separator. Encode the message for URL safety.
  const cleanedPhone = phone.replace(/\s+/g, '')
  return `sms:${cleanedPhone}?body=${encodeURIComponent(body)}`
}

const firstNameOf = (full: string | null): string => {
  if (!full) return 'driver'
  const trimmed = full.trim()
  if (!trimmed) return 'driver'
  return trimmed.split(/\s+/)[0]
}

type Mode = 'closed' | 'message' | 'share'

export const DriverMessageBar = ({ driverPhone, driverName }: Props) => {
  const [mode, setMode] = useState<Mode>('closed')
  const [body, setBody] = useState('')
  const [recipient, setRecipient] = useState('')
  const [copied, setCopied] = useState<'phone' | null>(null)

  // Default share message — refreshes when the user toggles share mode so
  // the latest driver info is in there even if data updated after first open.
  useEffect(() => {
    if (mode === 'share') {
      setBody(`BagBee driver ${firstNameOf(driverName)} — ${driverPhone}`)
    } else if (mode === 'message') {
      setBody('')
    }
  }, [mode, driverName, driverPhone])

  const onCopy = async (text: string, kind: 'phone') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* no clipboard — silently noop */
    }
  }

  const close = () => {
    setMode('closed')
    setBody('')
    setRecipient('')
    setCopied(null)
  }

  if (mode === 'closed') {
    return (
      <Wrapper>
        <ToggleRow>
          <ToggleButton primary onClick={() => setMode('message')}>
            Message {firstNameOf(driverName)}
          </ToggleButton>
          <ToggleButton onClick={() => setMode('share')}>
            Share driver info
          </ToggleButton>
        </ToggleRow>
      </Wrapper>
    )
  }

  if (mode === 'share') {
    const recipientOk = recipient.replace(/\D/g, '').length >= 4
    const canSend = recipientOk && body.trim().length > 0
    return (
      <Wrapper>
        <Composer>
          <ComposerHead>Share driver contact</ComposerHead>
          <FieldLabel>Send to (phone)</FieldLabel>
          <PhoneInput
            placeholder="+354 698 3808"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            inputMode="tel"
            autoFocus
          />
          <FieldLabel>Message</FieldLabel>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <ActionRow>
            <SendButton
              href={canSend ? buildSmsHref(recipient, body) : '#'}
              aria-disabled={!canSend}
              onClick={() => {
                if (canSend) {
                  setTimeout(() => close(), 200)
                }
              }}
            >
              Send via SMS
            </SendButton>
            <SecondaryButton type="button" onClick={close}>
              Close
            </SecondaryButton>
          </ActionRow>
        </Composer>
      </Wrapper>
    )
  }

  // message mode
  const canSend = body.trim().length > 0
  return (
    <Wrapper>
      <Composer>
        <ComposerHead>Message {driverName || 'driver'}</ComposerHead>
        <Textarea
          placeholder="Type a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          autoFocus
        />
        <ActionRow>
          <SendButton
            href={canSend ? buildSmsHref(driverPhone, body) : '#'}
            aria-disabled={!canSend}
            onClick={() => {
              if (canSend) {
                setTimeout(() => close(), 200)
              }
            }}
          >
            Send via SMS
          </SendButton>
          <SecondaryButton type="button" onClick={() => onCopy(driverPhone, 'phone')}>
            Copy phone
          </SecondaryButton>
          <SecondaryButton type="button" onClick={close}>
            Close
          </SecondaryButton>
          {copied === 'phone' && <Toast>Phone copied</Toast>}
        </ActionRow>
      </Composer>
    </Wrapper>
  )
}

export default DriverMessageBar
