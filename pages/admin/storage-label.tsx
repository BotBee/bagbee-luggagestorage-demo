// @ts-nocheck — print view; inline styles.
//
// Printable storage labels for the ops dashboard, matching BagBee's Airtable
// Page Designer tag: ONE label per booking, 100 × 62 mm (Brother QL die-cut
// DK-11202, landscape). Open with:
//   /admin/storage-label?ids=rec1,rec2,...
// Reads the shared admin key from localStorage, fetches the active bookings,
// filters to the requested ids, renders a label each, and AUTO-PRINTS. Each
// label is its own 100×62 page (overflow clipped) so it always lands on exactly
// one tape — never spilling onto a second sheet.
//
// For a truly one-click (no dialog) workflow, launch the dashboard in Chrome
// with --kiosk-printing (see notes). window.print() then prints straight to the
// default printer.
import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { QRCodeSVG } from 'qrcode.react'

const GREEN = '#3D7165'
const NAVY = '#1f4a57'
const TIME = '#c2843a'
const INK = '#1a1a1a'

const RECEPTION_PHONE = '+354 649-1819'
const BAGBEE_PHONE = '+354 578-5900'

const dmy = (iso: string) => {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

export default function StorageLabel() {
  const router = useRouter()
  const [labels, setLabels] = useState<any[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!router.isReady) return
    const ids = String(router.query.ids || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    let key = ''
    try {
      key = (window.localStorage.getItem('dispatch_admin_key') || '').trim()
    } catch {
      /* localStorage can be blocked in sandboxed contexts */
    }
    if (!key) return setError('No admin key found. Open the dashboard first.')
    if (!ids.length) return setError('No bookings specified.')
    fetch('/api/storage-ops/list', { headers: { Authorization: `Bearer ${key}` } })
      .then((r) => r.json())
      .then((j) => {
        const byId: Record<string, any> = {}
        ;(j.bookings || []).forEach((b: any) => (byId[b.id] = b))
        const out = ids.map((id) => byId[id]).filter(Boolean)
        if (!out.length) setError('Bookings not found in the active window.')
        setLabels(out)
        setReady(true)
      })
      .catch((e) => setError(e.message || 'Failed to load'))
  }, [router.isReady, router.query.ids])

  useEffect(() => {
    if (ready && labels.length && router.query.print !== '0') {
      // Auto-close this tab once printing is done so the flow is a single click
      // from the dashboard (open → print → close). In Chrome --kiosk-printing
      // this is fully silent: one button, no dialog.
      window.onafterprint = () => {
        try {
          window.close()
        } catch {
          /* can't close a tab the script didn't open — harmless */
        }
      }
      const t = setTimeout(() => window.print(), 500)
      return () => clearTimeout(t)
    }
  }, [ready, labels.length, router.query.print])

  if (error) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>{error}</div>

  return (
    <div style={wrap}>
      <Head>
        <title>Storage labels · BagBee</title>
        <style>{printCss}</style>
      </Head>
      <div className="noprint" style={bar}>
        <span>{labels.length} label{labels.length === 1 ? '' : 's'} · 100 × 62 mm</span>
        <button onClick={() => window.print()} style={printBtn}>🖨 Print</button>
      </div>
      <div className="sheetWrap" style={sheet}>
        {!ready && <div style={{ padding: 24, color: '#888', fontSize: 14 }}>Loading labels…</div>}
        {ready && labels.length === 0 && <div style={{ padding: 24, color: '#888', fontSize: 14 }}>No matching bookings.</div>}
        {labels.map((b) => (
          <div key={b.id} className="label" style={label}>
            {/* header: reception note + logo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '3mm' }}>
              <div style={{ fontSize: '2.5mm', color: INK, fontWeight: 600, lineHeight: 1.25 }}>
                Reception closes at <span style={{ color: GREEN, fontWeight: 700 }}>17:00 (5pm)</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/bagbee-logo-green.svg" alt="BagBee" style={{ height: '8.5mm', flexShrink: 0 }} />
            </div>

            {/* body: info (left) + QR (right) */}
            <div style={{ display: 'flex', gap: '3mm', flex: 1, minHeight: 0, marginTop: '0.8mm' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '5mm', fontWeight: 700, color: INK, lineHeight: 1.05 }}>{b.name || '—'}</div>
                <div style={{ marginTop: '1mm' }}>
                  <Row k="Drop Off" date={dmy(b.arrivalDate)} time={b.arrivalTime} />
                  <Row k="Pick-up" date={dmy(b.departureDate)} time={b.departureTime} />
                </div>
                <div style={{ marginTop: '1.4mm', fontSize: '3.2mm', color: INK }}>
                  <div style={qline}><span style={qlabel}>Large:</span><b>{b.luggage || 0}</b></div>
                  <div style={qline}><span style={qlabel}>Small:</span><b>{b.backpacks || 0}</b></div>
                  <div style={{ ...qline, alignItems: 'center', marginTop: '0.6mm' }}>
                    <span style={qlabel}>Service:</span>
                    <span style={pill}>{b.type || 'Storage'}</span>
                  </div>
                </div>
              </div>
              {/* QR → customer self-service manage page (/storage/{id}) */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                <QRCodeSVG value={b.storagePageLink || `https://www.bagbee.is/storage/${b.id}`} size={70} level="M" includeMargin />
                <div style={{ fontSize: '2.2mm', color: GREEN, fontWeight: 600, marginTop: '0.4mm', textAlign: 'center' }}>Scan to manage</div>
              </div>
            </div>

            {/* footer */}
            <div style={{ fontSize: '2.5mm', lineHeight: 1.3 }}>
              <div style={{ color: GREEN }}>BagBee BSI reception: {RECEPTION_PHONE}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: GREEN }}>BagBee tel: {BAGBEE_PHONE}</span>
                <span style={{ color: INK, fontWeight: 600 }}>www.bagbee.is</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Row({ k, date, time }: { k: string; date: string; time?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', fontSize: '3.3mm', color: INK, marginTop: '0.4mm' }}>
      <span style={{ width: '17mm', color: '#555', flexShrink: 0 }}>{k}</span>
      <span style={{ fontWeight: 700 }}>{date}</span>
      <span style={{ marginLeft: 'auto', color: TIME, fontWeight: 700 }}>{time || ''}</span>
    </div>
  )
}

const wrap: React.CSSProperties = { fontFamily: 'Poppins, system-ui, sans-serif', background: '#f3f4f6', minHeight: '100vh' }
const bar: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e3e6ea', position: 'sticky', top: 0 }
const printBtn: React.CSSProperties = { background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }
const sheet: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16, alignContent: 'flex-start' }
const label: React.CSSProperties = {
  width: '100mm',
  height: '62mm',
  boxSizing: 'border-box',
  padding: '3.2mm 5mm',
  background: '#fff',
  border: '1px solid #d7dbe0',
  borderRadius: 4,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}
const qline: React.CSSProperties = { display: 'flex', gap: '2mm', alignItems: 'baseline' }
const qlabel: React.CSSProperties = { width: '17mm', color: '#555', flexShrink: 0 }
const pill: React.CSSProperties = { background: NAVY, color: '#fff', fontSize: '2.8mm', fontWeight: 600, padding: '0.8mm 2.5mm', borderRadius: '4mm' }

const printCss = `
@page { size: 100mm 62mm; margin: 0; }
html, body { margin: 0; padding: 0; }
@media print {
  html, body { margin: 0; padding: 0; background: #fff; width: 100mm; }
  .noprint { display: none !important; }
  .sheet, .sheetWrap { padding: 0 !important; gap: 0 !important; }
  .label {
    border: none !important;
    border-radius: 0 !important;
    margin: 0 !important;
    width: 100mm !important;
    height: 62mm !important;
    page-break-after: always;
    break-after: page;
    overflow: hidden;
  }
  .label:last-child { page-break-after: auto; break-after: auto; }
}
`

export async function getServerSideProps() {
  return { props: {} }
}
