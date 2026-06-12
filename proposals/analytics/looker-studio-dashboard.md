# Looker Studio dashboard — Bagbee booking funnel

This guide builds the dashboard Vaskar originally proposed: a booking-funnel
view (drop-off between each step) plus a revenue / coupon / device breakdown
on top of GA4 measurement `G-BKGCE0TJ3X`.

Wait until events show up in **GA4 → Reports → Realtime** before starting —
fresh GA4 events take ~24 hours to appear in standard reports, but they show
in Realtime immediately. The dashboard pulls from standard reports, so you
won't see numbers for the first 24h.

---

## Step 1 — Connect Looker Studio to GA4

1. Open **https://lookerstudio.google.com/** and sign in with the Google
   account that owns the GA4 property.
2. **Create → Report**.
3. **Add data → Google Analytics → bagbee.is** (whatever the GA4 property
   is named) → choose the `G-BKGCE0TJ3X` web stream → **Add**.
4. Title the report **"Bagbee — Booking funnel & revenue"**.

You now have a blank canvas with a default GA4 data source attached.

---

## Step 2 — Page 1: Funnel

The funnel chart isn't a native Looker Studio chart type, but you can build
a horizontal-bar version that tells the same story.

### 2a. Add a Date range control (top of page)
- **Insert → Date range control**. Default: Last 28 days. This filters
  every chart on the page.

### 2b. Add the funnel as a horizontal bar chart

**Insert → Bar chart → Horizontal stacked bar**.

- **Dimension**: Event name
- **Metric**: Event count
- **Filter**: Event name **In list** `begin_checkout`, `add_shipping_info`,
  `add_payment_info`, `purchase`
- **Sort**: Custom — drag events into the order above (begin_checkout at
  top, purchase at bottom).
- **Style → Bars**: turn on data labels.

This gives you the "100 → 80 → 50 → 30" look at a glance.

### 2c. Add per-step conversion-rate scorecards

Underneath the bar chart, add four scorecards using **Insert → Scorecard**.
Each shows the count of one event:

- Scorecard A — Filter: Event name = `begin_checkout`. Metric: Event count.
- Scorecard B — same, `add_shipping_info`.
- Scorecard C — same, `add_payment_info`.
- Scorecard D — same, `purchase`.

Optional: add three calculated-field scorecards for the **per-step
conversion rate**. In the data source, click the field list **+ Add field**:

```
Step 1→2 rate = SUM(CASE WHEN Event name = "add_shipping_info" THEN Event count ELSE 0 END)
              / SUM(CASE WHEN Event name = "begin_checkout" THEN Event count ELSE 0 END)
```

Format as **Percent**. Repeat for `add_payment_info / add_shipping_info` and
`purchase / add_payment_info`. The third one is the "checkout-to-paid"
conversion rate — the most actionable number on the dashboard.

(GA4's Funnel Exploration in **Explore → Funnel exploration** gives the
same view as a built-in feature; build the Looker version as a shareable
snapshot.)

### 2d. Funnel by service type

Duplicate the bar chart from 2b. Add **Item category** as a breakdown
dimension. This splits each step into Check-in vs Fast-Track stacked bars,
so you can see whether one funnel is leakier than the other.

---

## Step 3 — Page 2: Revenue & purchases

**Page → New page**. Title it "Revenue".

### 3a. Time-series chart — daily revenue

**Insert → Time series**.
- **Date dimension**: Date.
- **Metric**: Total revenue (built-in GA4 metric — this is the sum of
  `value` from `purchase` events).
- Add a **Comparison date range**: Previous period. This shows
  week-over-week / month-over-month deltas.

### 3b. Scorecards row

Five scorecards across the top:
- **Total revenue** (metric = Total revenue)
- **Purchases** (metric = `Event count` filtered to `purchase`)
- **Average order value** (calculated: `Total revenue / Purchases`)
- **Discounts redeemed** (filter on `purchase` events where `coupon` is not
  null — see step 3d for the coupon breakdown)
- **Begin-checkout → purchase conversion rate** (the "Step 3→4 rate" from
  page 1)

### 3c. Revenue by service type

**Insert → Pie chart** or **Stacked column**.
- Dimension: Item category (your dataLayer items use `Check-in` or `Fast-Track`).
- Metric: Item revenue.

This answers "are we making more from Check-in or Fast-Track?".

### 3d. Coupon usage table

**Insert → Table**.
- Dimensions: `Coupon` (the GA4 dimension auto-created from
  `ecommerce.coupon`).
- Metrics: Purchases, Total revenue.
- Filter: Coupon **is not null**.

Sort by Purchases DESC. This tells you which discount codes actually drive
revenue vs. just sit unused. Add a date filter so you can see weekly trends.

### 3e. Top items

**Insert → Table**.
- Dimensions: Item name (so `Standard bag pickup`, `Odd-size bag pickup`,
  `Fast-Track service`).
- Metrics: Items purchased, Item revenue.

---

## Step 4 — Page 3: Acquisition / device / geo (optional but cheap)

**Page → New page**. Title it "Audience".

### 4a. Source / medium table

Dimensions: Session source / medium.
Metrics: Sessions, Begin-checkouts (custom: Event count filtered to
`begin_checkout`), Purchases, Total revenue.

### 4b. Device category pie

Dimension: Device category.
Metric: Total revenue (or Purchases).

### 4c. Country geo map

**Insert → Geo chart** (Google Maps).
Dimension: Country.
Metric: Purchases.

This is the chart Vaskar's "where are users coming from" requirement maps to.

---

## Step 5 — Share

- **Share → Get link**. Set viewer access to **Anyone with the link can
  view** if you want the team to see numbers without Google sign-in. Set
  to **People in your domain** if you'd rather scope it.
- Pin to the Looker Studio Home as a favorite.
- Optional: schedule **a weekly email delivery of the report PDF** to
  `web@bagbee.is` and any stakeholders. (Share → Schedule delivery.)

---

## Notes on data freshness and caveats

- Standard GA4 reports lag ~24 hours. If you need real-time numbers, use
  **GA4 → Reports → Realtime** directly — Looker Studio won't show the same
  immediacy.
- `Total revenue` aggregates `value` from both `purchase` and any `refund`
  events. The Bagbee site doesn't fire `refund` (could be added later if
  the cancel-order flow needs to net out refunds in GA4).
- Item-level revenue (`Item revenue`) and order-level revenue (`Total
  revenue`) should match closely. If they diverge, it usually means an
  event went out without `items` populated. Check the dataLayer in DevTools
  on a real booking.
- The `coupon` dimension only appears in GA4 after the first event with a
  non-null coupon has been recorded. Until then, it'll show "(not set)" or
  not appear in the field picker at all.
- Currency: GA4 will record everything in ISK because the site sends
  `currency: 'ISK'` on every event. If you ever need USD/EUR conversion,
  GA4 has a built-in currency conversion at the property level — set it
  under **Admin → Property → Property settings → Reporting currency**.
