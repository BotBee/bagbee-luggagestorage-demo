import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'

// Linear/Vercel-style command palette. The page hands in an array of
// command/order/driver entries; the palette fuzzy-filters as the dispatcher
// types and fires the action on Enter. Arrow keys navigate, Esc closes.

export type PaletteEntry = {
  id: string
  group: 'Actions' | 'Drivers' | 'Orders' | 'Date'
  label: string
  hint?: string
  shortcut?: string
  keywords?: string
  onRun: () => void
}

type Props = {
  open: boolean
  onClose: () => void
  entries: PaletteEntry[]
}

export function CommandPalette({ open, onClose, entries }: Props) {
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => {
      const hay = `${e.label} ${e.hint ?? ''} ${e.keywords ?? ''}`.toLowerCase()
      return q.split(/\s+/).every((tok) => hay.includes(tok))
    })
  }, [query, entries])

  const grouped = useMemo(() => {
    const out = new Map<string, PaletteEntry[]>()
    for (const e of filtered) {
      const arr = out.get(e.group) ?? []
      arr.push(e)
      out.set(e.group, arr)
    }
    return Array.from(out.entries())
  }, [filtered])

  const flat = useMemo(() => grouped.flatMap(([, arr]) => arr), [grouped])

  useEffect(() => {
    if (activeIdx >= flat.length) setActiveIdx(Math.max(0, flat.length - 1))
  }, [flat.length, activeIdx])

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(flat.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const entry = flat[activeIdx]
      if (entry) {
        entry.onRun()
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 92vw)',
          maxHeight: '70vh',
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #eee' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search orders, drivers, actions…"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: 15,
              background: 'transparent',
            }}
          />
        </div>
        <div style={{ overflowY: 'auto', padding: '6px 0' }}>
          {flat.length === 0 && (
            <div
              style={{
                padding: '20px 16px',
                color: '#6b7280',
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              No matches
            </div>
          )}
          {grouped.map(([group, arr]) => (
            <div key={group}>
              <div
                style={{
                  padding: '8px 16px 4px',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  color: '#6b7280',
                  fontWeight: 600,
                }}
              >
                {group}
              </div>
              {arr.map((e) => {
                const flatIdx = flat.indexOf(e)
                const active = flatIdx === activeIdx
                return (
                  <div
                    key={e.id}
                    onMouseEnter={() => setActiveIdx(flatIdx)}
                    onClick={() => {
                      e.onRun()
                      onClose()
                    }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 16px',
                      cursor: 'pointer',
                      background: active ? '#f3f4f6' : 'transparent',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, color: '#111' }}>
                        {e.label}
                      </div>
                      {e.hint && (
                        <div
                          style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}
                        >
                          {e.hint}
                        </div>
                      )}
                    </div>
                    {e.shortcut && (
                      <div
                        style={{
                          fontSize: 11,
                          color: '#6b7280',
                          padding: '2px 6px',
                          border: '1px solid #e5e7eb',
                          borderRadius: 4,
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Consolas, monospace',
                        }}
                      >
                        {e.shortcut}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid #eee',
            background: '#fafafa',
            fontSize: 11,
            color: '#6b7280',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>↑↓ to navigate · Enter to run · Esc to close</span>
          <span>
            {flat.length} match{flat.length === 1 ? '' : 'es'}
          </span>
        </div>
      </div>
    </div>
  )
}
