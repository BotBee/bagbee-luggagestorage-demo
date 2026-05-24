import styled from '@emotion/styled'
import {
  GoogleMap,
  Marker,
  useJsApiLoader,
} from '@react-google-maps/api'
import { useEffect, useMemo, useState } from 'react'

// Mirrors @react-google-maps's loader options — pin the libraries list so
// every callsite shares the same loader instance and the SDK doesn't warn
// about re-initialisation.
const LIBRARIES: ('places' | 'geometry')[] = ['geometry']

const Wrapper = styled.div`
  background: white;
  border-radius: 18px;
  border: 1px solid #ecedf0;
  padding: 22px;
  font-family: 'Poppins', sans-serif;
`

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  gap: 12px;
  flex-wrap: wrap;
`

const Title = styled.h2`
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: #000929;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  margin: 0;
`

const Chip = styled.span<{ kind: 'ok' | 'muted' | 'saving' }>`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  background: ${({ kind }) =>
    kind === 'ok' ? '#e7f6ec' : kind === 'saving' ? '#fef3c7' : '#eef0f3'};
  color: ${({ kind }) =>
    kind === 'ok' ? '#176c2c' : kind === 'saving' ? '#92400e' : '#5b626c'};
`

const MapShell = styled.div<{ compact?: boolean }>`
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #ecedf0;
  height: ${({ compact }) => (compact ? '220px' : '420px')};
  background: #f6f7f9;
`

const Empty = styled.div<{ compact?: boolean }>`
  height: ${({ compact }) => (compact ? '220px' : '420px')};
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
  border-radius: 14px;
  border: 1px dashed #d9dde2;
  color: #696f79;
  font-size: 13px;
  background: #fafbfc;
`

const Hint = styled.p`
  margin: 12px 0 0;
  font-size: 11px;
  color: #696f79;
  line-height: 1.5;
`

const ResetButton = styled.button`
  margin-left: 8px;
  background: none;
  border: none;
  color: #2d7ff9;
  font-family: 'Poppins', sans-serif;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  &:hover { text-decoration: underline; }
`

type Props = {
  orderId: string
  // When true, render the slim sidebar variant (shorter map, no hint).
  compact?: boolean
  // Optional callback when either pin is dragged + persisted, so the
  // parent can refresh its order state if needed.
  // eslint-disable-next-line no-unused-vars
  onPickupMoved?: (coords: { lat: number; lng: number }) => void
  // eslint-disable-next-line no-unused-vars
  onDeliveryMoved?: (coords: { lat: number; lng: number }) => void
}

type TrackingPayload = {
  pickup: { lat: number; lng: number } | null
  delivery: { lat: number; lng: number } | null
  driver: { lat: number; lng: number; reportedAt: number } | null
  provider: string
}

const ICELAND_DEFAULT_CENTER = { lat: 64.13, lng: -21.94 }

export const OrderTrackingMap = ({
  orderId,
  compact = false,
  onPickupMoved,
  onDeliveryMoved,
}: Props) => {
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
    id: 'google-map-script-partner-tracking',
  })

  const [tracking, setTracking] = useState<TrackingPayload | null>(null)
  const [loadingTracking, setLoadingTracking] = useState(true)
  // Local overrides during a drag so the marker doesn't snap back while
  // the server is saving (optimistic UI). When non-null, these win.
  const [localPickup, setLocalPickup] = useState<{ lat: number; lng: number } | null>(
    null,
  )
  const [localDelivery, setLocalDelivery] = useState<
    { lat: number; lng: number } | null
  >(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(
          `/api/partners/iceland-travel/orders/${orderId}/tracking`,
        )
        if (!res.ok) {
          if (!cancelled) setLoadingTracking(false)
          return
        }
        const data = await res.json()
        if (cancelled) return
        setTracking({
          pickup: data.tracking.pickup,
          delivery: data.tracking.delivery,
          driver: data.tracking.driver,
          provider: data.tracking.provider,
        })
        setLoadingTracking(false)
      } catch {
        if (!cancelled) setLoadingTracking(false)
      }
    }
    load()
    // No polling: this map is a placement tool today, not a live feed.
    // When the dispatch backend gains a positions API we'll reintroduce a
    // refresh interval here.
    return () => {
      cancelled = true
    }
  }, [orderId])

  const effectivePickup = localPickup ?? tracking?.pickup ?? null
  const effectiveDelivery = localDelivery ?? tracking?.delivery ?? null

  const fitPoints = useMemo(() => {
    const pts: Array<{ lat: number; lng: number }> = []
    if (effectivePickup) pts.push(effectivePickup)
    if (effectiveDelivery) pts.push(effectiveDelivery)
    return pts
  }, [effectivePickup, effectiveDelivery])

  // One save path for either end of the trip — the only thing that
  // differs is the pair of Airtable field keys we PATCH and the
  // optimistic-UI cache we update on the client.
  type PinKind = 'pickup' | 'delivery'

  const savePin = async (
    kind: PinKind,
    coords: { lat: number; lng: number },
  ) => {
    setSaveState('saving')
    try {
      const changes =
        kind === 'pickup'
          ? { pickupLatOverride: coords.lat, pickupLngOverride: coords.lng }
          : { deliveryLatOverride: coords.lat, deliveryLngOverride: coords.lng }
      const res = await fetch(`/api/partners/iceland-travel/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes, actor: `${kind}-pin-drag` }),
      })
      if (!res.ok) {
        setSaveState('error')
        return
      }
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
      if (kind === 'pickup') onPickupMoved?.(coords)
      else onDeliveryMoved?.(coords)
    } catch {
      setSaveState('error')
    }
  }

  const resetPin = async (kind: PinKind) => {
    setSaveState('saving')
    try {
      const changes =
        kind === 'pickup'
          ? { pickupLatOverride: null, pickupLngOverride: null }
          : { deliveryLatOverride: null, deliveryLngOverride: null }
      const res = await fetch(`/api/partners/iceland-travel/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes, actor: `${kind}-pin-reset` }),
      })
      if (!res.ok) {
        setSaveState('error')
        return
      }
      // Refetch so the server's re-geocoded coords replace our optimistic one.
      const fresh = await fetch(
        `/api/partners/iceland-travel/orders/${orderId}/tracking`,
      )
      if (fresh.ok) {
        const data = await fresh.json()
        setTracking({
          pickup: data.tracking.pickup,
          delivery: data.tracking.delivery,
          driver: data.tracking.driver,
          provider: data.tracking.provider,
        })
      }
      if (kind === 'pickup') setLocalPickup(null)
      else setLocalDelivery(null)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
    }
  }

  if (!apiKey || loadError) {
    return (
      <Wrapper>
        <Title>Pickup map</Title>
        <Empty compact={compact}>
          Map cannot load — Google Maps key missing or unauthorised.
        </Empty>
      </Wrapper>
    )
  }

  const noKnownLocation = !effectivePickup && !effectiveDelivery

  return (
    <Wrapper>
      <HeaderRow>
        <Title>Pickup &amp; delivery map</Title>
        {saveState === 'saving' && <Chip kind="saving">Saving location…</Chip>}
        {saveState === 'saved' && <Chip kind="ok">Location saved</Chip>}
        {saveState === 'error' && (
          <Chip kind="saving">Could not save — try again</Chip>
        )}
        {saveState === 'idle' && localPickup && (
          <Chip kind="muted">
            Pickup manually placed
            <ResetButton
              onClick={() => resetPin('pickup')}
              title="Use geocoded pickup address again"
            >
              reset
            </ResetButton>
          </Chip>
        )}
        {saveState === 'idle' && localDelivery && (
          <Chip kind="muted">
            Delivery manually placed
            <ResetButton
              onClick={() => resetPin('delivery')}
              title="Use geocoded delivery address again"
            >
              reset
            </ResetButton>
          </Chip>
        )}
      </HeaderRow>

      {!isLoaded || loadingTracking ? (
        <Empty compact={compact}>Loading map…</Empty>
      ) : noKnownLocation ? (
        <Empty compact={compact}>
          Pickup couldn&rsquo;t be geocoded. Make sure the pickup address on
          the order is a recognisable Iceland location.
        </Empty>
      ) : (
        <MapShell compact={compact}>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={effectivePickup ?? ICELAND_DEFAULT_CENTER}
            zoom={14}
            options={{
              disableDefaultUI: true,
              zoomControl: true,
              streetViewControl: false,
              fullscreenControl: false,
              mapTypeControl: false,
              clickableIcons: false,
              styles: [
                {
                  featureType: 'poi',
                  elementType: 'labels',
                  stylers: [{ visibility: 'off' }],
                },
              ],
            }}
            onLoad={(map) => {
              // Always center on the pickup at a fixed zoom — the partner's
              // project manager is primarily checking where the driver is
              // stopping, so the pickup point is the focal point. Delivery
              // is still rendered as a pin; the user can pan/zoom out to
              // see it. Falls back to fitting bounds only when there's no
              // pickup at all (rare).
              if (effectivePickup) {
                map.setCenter(effectivePickup)
                map.setZoom(15)
                return
              }
              if (fitPoints.length === 0) return
              const bounds = new window.google.maps.LatLngBounds()
              for (const p of fitPoints) bounds.extend(p)
              map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 })
            }}
          >
            {effectivePickup && (
              <Marker
                position={effectivePickup}
                draggable
                onDragEnd={(e) => {
                  const lat = e.latLng?.lat()
                  const lng = e.latLng?.lng()
                  if (lat == null || lng == null) return
                  const next = { lat, lng }
                  setLocalPickup(next)
                  void savePin('pickup', next)
                }}
                label={{
                  text: 'P',
                  color: 'white',
                  fontWeight: '700',
                  fontSize: '13px',
                }}
                icon={{
                  // Map-pin silhouette (Material "place" path), anchored at
                  // the bottom point so the tip sits exactly on the address.
                  path: 'M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z',
                  fillColor: '#3d7165',
                  fillOpacity: 1,
                  strokeColor: 'white',
                  strokeWeight: 2.5,
                  scale: 1.4,
                  anchor: new window.google.maps.Point(12, 36),
                  labelOrigin: new window.google.maps.Point(12, 13),
                }}
                title="Pickup — drag to adjust"
              />
            )}
            {effectiveDelivery && (
              <Marker
                position={effectiveDelivery}
                draggable
                onDragEnd={(e) => {
                  const lat = e.latLng?.lat()
                  const lng = e.latLng?.lng()
                  if (lat == null || lng == null) return
                  const next = { lat, lng }
                  setLocalDelivery(next)
                  void savePin('delivery', next)
                }}
                label={{
                  text: 'D',
                  color: 'white',
                  fontWeight: '700',
                  fontSize: '13px',
                }}
                icon={{
                  path: 'M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z',
                  fillColor: '#2d7ff9',
                  fillOpacity: 1,
                  strokeColor: 'white',
                  strokeWeight: 2.5,
                  scale: 1.4,
                  anchor: new window.google.maps.Point(12, 36),
                  labelOrigin: new window.google.maps.Point(12, 13),
                }}
                title="Delivery — drag to adjust"
              />
            )}
          </GoogleMap>
        </MapShell>
      )}

      {!compact && (
        <Hint>
          Drag the green pickup pin or the blue delivery pin to fine-tune where
          the driver should stop (e.g. an entrance the geocoder gets wrong).
          Your placement is saved to the order automatically.
        </Hint>
      )}
    </Wrapper>
  )
}

export default OrderTrackingMap
