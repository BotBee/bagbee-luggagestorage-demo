import React, { useCallback, useEffect, useRef, useState } from 'react'
import styled from '@emotion/styled'
import { strings, Locale } from './strings'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  author?: 'bot' | 'agent'
  text: string
}

const API_BASE = process.env.NEXT_PUBLIC_CHAT_API_URL || 'https://bagbee-api-production.up.railway.app'
const STORAGE_KEY = 'bagbee_chat_session'
const POLL_MS = 4000

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'is'
  const htmlLang = document.documentElement.lang
  if (htmlLang?.startsWith('en')) return 'en'
  return 'is'
}

function localId() {
  return 'local_' + Math.random().toString(36).slice(2, 10)
}

export default function BagChat() {
  const [open, setOpen] = useState(false)
  const [locale, setLocale] = useState<Locale>('is')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastPolledId = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  const t = strings[locale]

  // Restore or create session on mount
  useEffect(() => {
    setLocale(detectLocale())
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.session_id) {
          setSessionId(parsed.session_id)
          setMessages(parsed.messages || [])
          lastPolledId.current = parsed.last_id || 0
          return
        }
      } catch {}
    }
  }, [])

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId
    const res = await fetch(`${API_BASE}/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    })
    if (!res.ok) throw new Error('session_create_failed')
    const data = await res.json()
    setSessionId(data.session_id)
    // Seed the greeting locally (not stored on server)
    setMessages([{ id: 'greet', role: 'assistant', author: 'bot', text: t.greeting }])
    return data.session_id
  }, [sessionId, locale, t.greeting])

  // Persist session + messages to localStorage
  useEffect(() => {
    if (!sessionId) return
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ session_id: sessionId, messages, last_id: lastPolledId.current }),
    )
  }, [sessionId, messages])

  // Scroll to bottom on new message
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open])

  // Poll for teammate replies while panel is open
  useEffect(() => {
    if (!open || !sessionId) return
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/chat/messages?session_id=${encodeURIComponent(sessionId)}&since=${lastPolledId.current}`,
        )
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(prev => {
            const existing = new Set(prev.map(m => m.id))
            const incoming = data.messages
              .filter((m: any) => !existing.has(String(m.id)))
              .map((m: any) => ({
                id: String(m.id),
                role: m.role,
                author: m.author,
                text: m.text,
              }))
            return [...prev, ...incoming]
          })
        }
        if (data.last_id) lastPolledId.current = data.last_id
      } catch {}
    }
    const interval = setInterval(poll, POLL_MS)
    poll()
    return () => { cancelled = true; clearInterval(interval) }
  }, [open, sessionId])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setError(null)
    setSending(true)
    const optimistic: ChatMessage = { id: localId(), role: 'user', text }
    setMessages(prev => [...prev, optimistic])
    setInput('')
    try {
      const id = await ensureSession()
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: id, text }),
      })
      if (!res.ok) throw new Error('send_failed')
      const data = await res.json()
      setMessages(prev => [
        ...prev,
        { id: localId(), role: 'assistant', author: 'bot', text: data.reply },
      ])
    } catch {
      setError(t.error_network)
    } finally {
      setSending(false)
    }
  }, [input, sending, ensureSession, t.error_network])

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const toggleLocale = () => setLocale(l => (l === 'is' ? 'en' : 'is'))

  return (
    <>
      {!open && (
        <Launcher aria-label={t.launcher_aria} onClick={() => setOpen(true)}>
          <ChatIcon />
        </Launcher>
      )}
      {open && (
        <Panel role='dialog' aria-label={t.header_title}>
          <Header>
            <HeaderText>
              <strong>{t.header_title}</strong>
              <span>{t.header_subtitle}</span>
            </HeaderText>
            <LocaleButton onClick={toggleLocale}>{t.language_toggle}</LocaleButton>
            <IconButton aria-label={t.minimise_aria} onClick={() => setOpen(false)}>×</IconButton>
          </Header>
          <List ref={listRef}>
            {messages.length === 0 && (
              <Bubble data-role='assistant'>{t.greeting}</Bubble>
            )}
            {messages.map(m => (
              <Bubble key={m.id} data-role={m.role} data-author={m.author || 'bot'}>
                {m.text}
              </Bubble>
            ))}
            {sending && <Typing>{t.typing}</Typing>}
            {error && <ErrorBar>{error}</ErrorBar>}
          </List>
          <InputRow>
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={t.input_placeholder}
              rows={1}
              disabled={sending}
            />
            <SendButton
              aria-label={t.send_aria}
              onClick={() => void send()}
              disabled={sending || !input.trim()}
            >
              <SendIcon />
            </SendButton>
          </InputRow>
        </Panel>
      )}
    </>
  )
}

// -----------------------------------------------------------------
// Icons
// -----------------------------------------------------------------
const ChatIcon = () => (
  <svg width='28' height='28' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
    <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
  </svg>
)
const SendIcon = () => (
  <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
    <line x1='22' y1='2' x2='11' y2='13' />
    <polygon points='22 2 15 22 11 13 2 9 22 2' />
  </svg>
)

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------
const Launcher = styled.button`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: none;
  background: #F3AD3C;
  color: #1D3C34;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
  &:hover { transform: scale(1.05); }
`

const Panel = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  width: 380px;
  max-width: calc(100vw - 32px);
  height: 560px;
  max-height: calc(100vh - 48px);
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Poppins', system-ui, sans-serif;
  @media (max-width: 480px) {
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    bottom: 0;
    right: 0;
    border-radius: 0;
  }
`

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #1D3C34;
  color: #fff;
`

const HeaderText = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  strong { font-size: 15px; font-weight: 600; }
  span { font-size: 12px; opacity: 0.75; }
`

const IconButton = styled.button`
  background: transparent;
  border: none;
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  &:hover { opacity: 0.75; }
`

const LocaleButton = styled.button`
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.25);
  color: #fff;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: rgba(255,255,255,0.25); }
`

const List = styled.div`
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #F7F7F8;
`

const Bubble = styled.div`
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  &[data-role='user'] {
    align-self: flex-end;
    background: #F3AD3C;
    color: #1D3C34;
    border-bottom-right-radius: 4px;
  }
  &[data-role='assistant'] {
    align-self: flex-start;
    background: #fff;
    color: #1D3C34;
    border: 1px solid #E5E6EB;
    border-bottom-left-radius: 4px;
  }
  &[data-author='agent'] {
    border-left: 3px solid #3D7165;
  }
`

const Typing = styled.div`
  align-self: flex-start;
  font-size: 12px;
  color: #A3A4A7;
  padding: 4px 14px;
`

const ErrorBar = styled.div`
  align-self: center;
  font-size: 12px;
  color: #B00020;
  background: #FEEBEE;
  border-radius: 8px;
  padding: 6px 10px;
`

const InputRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
  background: #fff;
  border-top: 1px solid #E5E6EB;
`

const Input = styled.textarea`
  flex: 1;
  resize: none;
  border: 1px solid #E5E6EB;
  border-radius: 18px;
  padding: 10px 14px;
  font-size: 14px;
  font-family: inherit;
  max-height: 120px;
  outline: none;
  &:focus { border-color: #F3AD3C; }
`

const SendButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: #1D3C34;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  &:disabled {
    background: #A3A4A7;
    cursor: not-allowed;
  }
`
