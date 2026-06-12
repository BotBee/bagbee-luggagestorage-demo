// Per-driver workload visualisation. A horizontal stacked bar showing
// drive / service / waiting time, with the actual numbers below. Three
// glances at the dashboard now tell the dispatcher who's overloaded
// before they have to read any text.

export function WorkloadBar({
  driveSec,
  serviceSec,
  waitingSec,
  distanceM,
  color,
}: {
  driveSec: number
  serviceSec: number
  waitingSec: number
  distanceM?: number
  color: string
}) {
  const total = driveSec + serviceSec + waitingSec
  if (total <= 0) return null
  const drivePct = (driveSec / total) * 100
  const servicePct = (serviceSec / total) * 100
  const waitingPct = (waitingSec / total) * 100

  const fmt = (sec: number) => {
    const m = Math.round(sec / 60)
    if (m < 60) return `${m}m`
    return `${Math.floor(m / 60)}h ${m % 60}m`
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          display: 'flex',
          height: 6,
          borderRadius: 3,
          overflow: 'hidden',
          background: '#f1f5f9',
        }}
        title={`Drive ${fmt(driveSec)} · Service ${fmt(serviceSec)}${
          waitingSec > 0 ? ` · Waiting ${fmt(waitingSec)}` : ''
        }`}
      >
        <div style={{ width: `${drivePct}%`, background: color }} />
        <div
          style={{ width: `${servicePct}%`, background: color, opacity: 0.55 }}
        />
        <div
          style={{
            width: `${waitingPct}%`,
            background:
              'repeating-linear-gradient(45deg, #cbd5e1 0 4px, transparent 4px 8px)',
          }}
        />
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#6b7280',
          marginTop: 4,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: 2,
              background: color,
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />
          Drive {fmt(driveSec)}
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: 2,
              background: color,
              opacity: 0.55,
              marginRight: 4,
              verticalAlign: 'middle',
            }}
          />
          Service {fmt(serviceSec)}
        </span>
        {waitingSec > 0 && (
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: 2,
                background:
                  'repeating-linear-gradient(45deg, #cbd5e1 0 2px, transparent 2px 4px)',
                marginRight: 4,
                verticalAlign: 'middle',
              }}
            />
            Waiting {fmt(waitingSec)}
          </span>
        )}
        {distanceM != null && (
          <span style={{ marginLeft: 'auto' }}>
            {(distanceM / 1000).toFixed(1)} km
          </span>
        )}
      </div>
    </div>
  )
}
