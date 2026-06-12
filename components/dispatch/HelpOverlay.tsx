// Keyboard shortcut cheat sheet. Toggled by `?`, dismissed by `Esc` or
// click-outside.

const SHORTCUTS: Array<{ keys: string[]; action: string; group: string }> = [
  { keys: ['⌘', 'K'], action: 'Command palette', group: 'Navigation' },
  { keys: ['/'], action: 'Focus order search', group: 'Navigation' },
  { keys: ['?'], action: 'Show this help', group: 'Navigation' },
  { keys: ['Esc'], action: 'Close panel / overlay', group: 'Navigation' },
  { keys: ['R'], action: 'Reload orders + drivers + weather', group: 'Actions' },
  { keys: ['P'], action: 'Plan routes', group: 'Actions' },
  { keys: ['T'], action: 'Switch to tomorrow', group: 'Actions' },
]

export function HelpOverlay({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null
  const grouped = new Map<string, typeof SHORTCUTS>()
  for (const s of SHORTCUTS) {
    const arr = grouped.get(s.group) ?? []
    arr.push(s)
    grouped.set(s.group, arr)
  }

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
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)',
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          padding: '20px 24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600 }}>Keyboard shortcuts</div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: '#6b7280',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {Array.from(grouped.entries()).map(([group, items]) => (
          <div key={group} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                color: '#6b7280',
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              {group}
            </div>
            {items.map((s) => (
              <div
                key={s.action}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                }}
              >
                <div style={{ fontSize: 13 }}>{s.action}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {s.keys.map((k, i) => (
                    <kbd
                      key={i}
                      style={{
                        padding: '2px 8px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        fontSize: 11,
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Consolas, monospace',
                        background: '#f9fafb',
                        color: '#111',
                      }}
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
        <div
          style={{
            marginTop: 8,
            paddingTop: 12,
            borderTop: '1px solid #eee',
            fontSize: 11,
            color: '#6b7280',
          }}
        >
          Drag any timeline box or list row to reassign drivers · Lock a route
          to keep it through re-plans
        </div>
      </div>
    </div>
  )
}
