# GTM setup for GA4 ecommerce funnel — `GTM-PJNDJ33`

This is the manual recipe for wiring the four `dataLayer` events the site now
pushes (`begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`)
into GA4 event tags inside the `GTM-PJNDJ33` container.

It takes ~10 minutes and is the safest route — importing a pre-baked container
JSON can collide with whatever Vaskar already configured. Manual setup gives
you full control.

A pre-baked JSON snippet is also provided in `gtm-container-additions.json` if
you'd rather paste-import; instructions for that are at the bottom.

---

## Prerequisites — confirm these first

1. Go to **https://tagmanager.google.com/** and open container `GTM-PJNDJ33`
   (Bagbee web container).
2. Open **Tags** and confirm there is exactly one **GA4 Configuration** tag
   firing on **All Pages**, with measurement ID `G-BKGCE0TJ3X`.
   - If yes: note the tag's name (e.g. "GA4 - Bagbee Config"). You'll reference
     it from the four event tags below.
   - If no: create one. Tag → New → Tag Configuration → Google Analytics →
     **Google Tag**. Tag ID `G-BKGCE0TJ3X`. Trigger: **All Pages**.

3. Confirm the workspace has no other event tags already named
   `GA4 Event - begin_checkout` etc. If something close exists (e.g. Vaskar
   started this work), inspect it before creating duplicates.

---

## Step 1 — Create 7 Data Layer Variables

**Variables** → **New** for each. Type: **Data Layer Variable**. Version: 2.
Default value: leave blank.

| Variable name              | Data Layer Variable Name        |
|----------------------------|---------------------------------|
| `DLV - ecom.currency`      | `ecommerce.currency`            |
| `DLV - ecom.value`         | `ecommerce.value`               |
| `DLV - ecom.transaction_id`| `ecommerce.transaction_id`      |
| `DLV - ecom.coupon`        | `ecommerce.coupon`              |
| `DLV - ecom.items`         | `ecommerce.items`               |
| `DLV - ecom.shipping_tier` | `ecommerce.shipping_tier`       |
| `DLV - ecom.payment_type`  | `ecommerce.payment_type`        |

Save each.

---

## Step 2 — Create 4 Custom Event Triggers

**Triggers** → **New** for each. Type: **Custom Event**. Use exact event names
(no regex). This event fires on: **All Custom Events**.

| Trigger name                          | Event name           |
|---------------------------------------|----------------------|
| `CE - begin_checkout`                 | `begin_checkout`     |
| `CE - add_shipping_info`              | `add_shipping_info`  |
| `CE - add_payment_info`               | `add_payment_info`   |
| `CE - purchase`                       | `purchase`           |

---

## Step 3 — Create 4 GA4 Event Tags

For each of the four events, create a new tag.

**Tags** → **New** → Tag Configuration → **Google Analytics: GA4 Event**.

Common settings for all four:

- **Configuration Tag**: select the GA4 Configuration tag from prereq step 1
  (or set Measurement ID directly: `G-BKGCE0TJ3X` — newer GTM allows either).
- **More Settings → Ecommerce → Send Ecommerce data**: ✅ **enabled**.
  **Data source: Data Layer**. (This auto-forwards `currency`, `value`,
  `items`, `transaction_id`, `coupon` from the `ecommerce` object — you
  don't need to map them manually.)

Then per-event:

### Tag 1 — `GA4 Event - begin_checkout`
- Event Name: `begin_checkout`
- Trigger: `CE - begin_checkout`
- No additional event parameters needed.

### Tag 2 — `GA4 Event - add_shipping_info`
- Event Name: `add_shipping_info`
- Event Parameters (one row):
  - `shipping_tier` → `{{DLV - ecom.shipping_tier}}`
- Trigger: `CE - add_shipping_info`

### Tag 3 — `GA4 Event - add_payment_info`
- Event Name: `add_payment_info`
- Event Parameters (one row):
  - `payment_type` → `{{DLV - ecom.payment_type}}`
- Trigger: `CE - add_payment_info`

### Tag 4 — `GA4 Event - purchase`
- Event Name: `purchase`
- No additional event parameters needed (transaction_id comes via the
  Send Ecommerce data setting).
- Trigger: `CE - purchase`

---

## Step 4 — Preview, then publish

1. Click **Preview** in the top right. A new window opens — paste
   `https://www.bagbee.is/book` and click **Connect**. The site opens with
   the GTM tag-assistant overlay.
2. Walk through a Check-in booking with a test discount code (or use 100%
   discount if you have one — **don't actually pay**). At each step, the
   left panel of the tag-assistant should show the corresponding event
   firing AND the GA4 event tag firing alongside it. Verify in this order:
   - On `/book/bag-selection` Submit → see `begin_checkout` + `GA4 Event - begin_checkout`.
   - On `/book/pick-up` Submit → see `add_shipping_info` + `GA4 Event - add_shipping_info`.
   - On `/book/confirm-order` Submit → see `add_payment_info` + `GA4 Event - add_payment_info`. Then either:
     - 100% discount → land on `/payment/success?recordId=...` → see `purchase` + `GA4 Event - purchase`.
     - Real payment → land on Rapyd → finish payment → land back on `/orders/<orderNo>?paid=true` → see `purchase` + `GA4 Event - purchase`.
3. Repeat once for the Fast-Track flow at `/fast-track/book`.
4. In another tab open **GA4 → Reports → Realtime** and confirm the events
   show up there too. (`begin_checkout`, `add_shipping_info`,
   `add_payment_info`, `purchase` should all appear with non-zero values.)
5. If everything works, hit **Submit** in the top right of GTM — give the
   version a name like `GA4 ecommerce funnel — Apr 2026` — and **Publish**.

---

## Step 5 — Mark events as Conversions in GA4 (optional)

In **GA4 → Admin → Events**, find `purchase` and toggle the **Mark as key
event** column on. (`begin_checkout`, `add_shipping_info`,
`add_payment_info` are useful funnel steps but not usually conversions.)

---

## Optional: import the JSON instead of clicking through Steps 1–3

If you'd rather skip the manual setup, the file `gtm-container-additions.json`
in this same folder contains the same variables, triggers and tags ready to
import.

1. **Admin → Import Container** in GTM.
2. Upload `gtm-container-additions.json`.
3. **Choose workspace**: Default Workspace (or create a new one).
4. **Choose import option**: **Merge** (NOT Overwrite — overwrite would wipe
   the existing GTM-PJNDJ33 setup).
5. **Conflict resolution**: Rename conflicting tags / triggers / variables.
6. Preview, then publish (same as Step 4 above).

The JSON references `G-BKGCE0TJ3X` directly, so it does not depend on the
existing GA4 Configuration tag.

---

## Troubleshooting

- **Events fire on the page but don't reach GA4 Realtime** — usually means
  the GA4 Configuration tag isn't on the page. Open Preview and check the
  left panel for "Container Loaded" — the GA4 Config tag should be in the
  fired-on-page list. If not, fix the GA4 config trigger to All Pages.
- **`items` is empty in GA4 reports** — verify in Preview that the
  `ecommerce.items` value is a non-empty array on the dataLayer event. The
  site code only includes items when bag/odd/passenger counts are > 0.
- **Duplicate `purchase` events** — the site dedupes via sessionStorage
  per-`transaction_id`, so reloading the success page does NOT re-fire.
  If duplicates still appear in GA4, check that you don't have a second
  `GA4 Event - purchase` tag (e.g. left over from Vaskar's work) firing on
  the same trigger.
- **Coupon shows "(not set)"** — only orders that actually applied a
  discount code will have a coupon value. Order without code → no coupon
  field. Expected.
