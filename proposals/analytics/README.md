# Analytics — what's done and what you need to do

## ✅ Done (already live on www.bagbee.is)

- **Contentsquare/Hotjar** session recordings & heatmaps — collecting now.
- **GA4 ecommerce dataLayer events** wired into both booking flows:
  - `begin_checkout` — fires on `/book/bag-selection` Submit and on
    `/fast-track/personal-info` Submit.
  - `add_shipping_info` — fires on `/book/pick-up` Submit (Check-in only;
    Fast-Track has no shipping step).
  - `add_payment_info` — fires on both `/book/confirm-order` and
    `/fast-track/confirm-order` Submits, before the redirect to Rapyd.
  - `purchase` — fires on `/payment/success` (100% discount path) and on
    `/orders/<orderNo>?paid=true` / `?fast_track_paid=true` (after Rapyd
    redirects back). Idempotent — refresh won't double-count.
- All events emit standard GA4 ecommerce shape: `currency: 'ISK'`, numeric
  `value`, `items[]`, `transaction_id`, optional `coupon`. See
  [`utils/analytics.ts`](../../utils/analytics.ts).
- A `sessionStorage` bridge stores cart context on `add_payment_info` and
  pulls it back on the success page so `purchase` events have correct
  `value` and `items` even after the cross-domain Rapyd redirect.

You can verify the events fire right now: open www.bagbee.is, hit F12,
walk through a booking, and watch the **Application → Session Storage**
tab and the `dataLayer` array (`window.dataLayer`) accumulate events.

## 🎯 What you need to do

Two things, total. Both are click-through work in Google's web UIs — no
code, no dev environment.

### 1. Wire dataLayer events to GA4 inside GTM (~10 min)

Follow [`gtm-setup.md`](gtm-setup.md). It walks you through creating 7
data-layer variables, 4 triggers, and 4 GA4 event tags inside container
`GTM-PJNDJ33`.

If you'd rather paste-import instead of clicking through: there's
[`gtm-container-additions.json`](gtm-container-additions.json) — Admin →
Import → **Merge** mode (NOT Overwrite).

After importing or building manually: hit **Preview** in GTM, walk a
booking on www.bagbee.is, confirm the four event tags fire, then **Submit
+ Publish**.

### 2. Build the Looker Studio dashboard (~30 min)

Follow [`looker-studio-dashboard.md`](looker-studio-dashboard.md). Three
pages:

1. **Funnel** — bar chart, per-step counts, drop-off rate, broken down by
   Check-in vs Fast-Track.
2. **Revenue** — daily revenue time series, AOV, coupon usage, item-level
   revenue breakdown.
3. **Audience** (optional) — source/medium, device, geo.

The data won't show up for ~24 hours (GA4 standard reports have a delay).
Use **GA4 → Reports → Realtime** for immediate verification of step 1.

## 🧷 Reference

- Container: `GTM-PJNDJ33`
- GA4 measurement: `G-BKGCE0TJ3X`
- Code: [`utils/analytics.ts`](../../utils/analytics.ts) and the seven
  pages it imports from (search for `from '../../utils/analytics'`).
- Existing Contentsquare install: still working, untouched by this work.
- Original contractor scope: handed off from Vaskar (Avangard AI) on
  Fiverr — finished in-house April 2026.
