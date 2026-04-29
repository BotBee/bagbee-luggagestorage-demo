# Postal-code time-window rules — proposal v1

**Status:** Draft — for BagBee to review, edit, comment.
**Author:** Claude (engineering, draft)
**Last edited:** 2026-04-26

This is a proposal — nothing is built yet. The goal is to align on the rules, the data model, and the UX before any code changes. Comment inline (`<!-- like this -->`) or just rewrite sections.

---

## 1. Goal

Replace the current six-card 1-hour slot picker on `/book/pick-up` with the same draggable **TimeRangeSlider** we already use on the order-edit page (`/orders/[orderNo]`).

While we're swapping the UI, fix two real problems with how customers pick a window:

1. **No postal-code awareness.** A customer in 101 (downtown — first stop on every shift) can currently pick `21:00–22:00`. By 21:00 the driver is in 230 heading to KEF — there is no way back.
2. **Availability lives in two unrelated places.** Capacity (`Config` + `Matrix Pickup` tables) is in Airtable. Postal-code constraints (`common/postalCodeConstraints.ts`) are hard-coded in the repo and require a deploy to change. They should both live in Airtable so ops can edit them.

This proposal is about *what the rules should be* and *where they should live* — not about the slider itself, which already works.

---

## 2. Driver route reference

Single shift, every weekday evening, 17:00–22:00:

```
17:00  ──►  BSÍ (101)  ──►  170 (Seltjarnarnes)  ──►  102 / 105
                                                       │
                                                       ▼
                                                     200 (Kópavogur)
                                                       │
                                                       ▼
                                                     210 (Garðabær)
                                                       │
                                                       ▼
                                                     220 (Hafnarfjörður)
                                                       │
                                                       ▼
                                                     230 (Reykjanesbær / Vogar)
                                                       │
                                                       ▼
22:00  ──►  KEF Airport
```

Outliers — not on the main southbound route, picked up early or off-peak:

- **270** (Mosfellsbær) — north-east of Reykjavík
- **112** (Grafarvogur) — north-east, separate detour from BSÍ
- **113** (Grafarholt / Úlfarsárdalur) — same neighbourhood as 112

> ✏️ **BagBee, please confirm:**
> - Is the order *exactly* `101 → 170 → 102 → 105 → 200 → 210 → 220 → 230 → KEF`, or do you re-order based on bookings on the day?
> - When 270 / 112 / 113 are on the manifest, when do you usually do them? *Before* 101 (i.e. on the way in to BSÍ), or *interleaved* between 101 and 102?
> - Is the morning shift (09:00–12:00) routed the same way, or different? My current assumption: morning is less route-sensitive because there are fewer stops and no airport endpoint.

---

## 3. Postal-code rule table (v2 — confirmed)

Time format: hours past start of shift. Evening shift starts at 17:00, so `17:00 = 0`, `22:00 = 5`.

**Confirmed out-of-service** (block at booking with "outside service area" message):
**116** Kjalarnes, **233** Hafnir, **245/246** Sandgerði, **250/251** Garður, **271** Mosfellsbær (rural), **276** Kjós.

### Slider behaviour — three patterns

The existing `TimeRangeSlider` already supports the mechanics we need. Three behaviours per postal code:

| Pattern | What's locked       | Customer can adjust          | When to use                                                       |
| ------- | ------------------- | ---------------------------- | ----------------------------------------------------------------- |
| **A — Right-locked at 22:00** | Right handle pinned at 22:00 | Left handle slides between 17:00 and ~21:00 | **Late-route zones** — driver passes through right before KEF. Window MUST end at 22:00 because the driver cannot turn back. |
| **B — Bounded both sides** | Neither handle locked, but both have a min/max range | Both handles | **Mid-route zones** — driver has a flexible arrival window in this zone. |
| **C — Left-locked at 17:00** | Left handle pinned at 17:00 | Right handle slides between 18:00 and the zone cutoff | **Early-route zones** — driver is here at the start of shift; window MUST start at 17:00 because the driver leaves and doesn't return. *(See open question §8.7 — confirm if you want this for 101/170.)* |

**Examples** (Pattern A, e.g. Njarðvík 260 or Vogar 190):
- ✅ `17:00 – 22:00` (5-hour window, valid)
- ✅ `20:00 – 22:00` (2-hour window, valid)
- ✅ `21:00 – 22:00` (1-hour window, valid)
- ❌ `19:00 – 20:00` (window doesn't end at 22:00 — invalid)
- ❌ `17:00 – 19:00` (window doesn't end at 22:00 — invalid)

**Examples** (Pattern B, e.g. Garðabær 210):
- ✅ `18:00 – 21:30` (within bounds, valid)
- ✅ `19:00 – 20:30` (1.5h window inside the range, valid)
- ❌ `17:00 – 18:00` (left below minimum 18:00, invalid)
- ❌ `20:00 – 22:00` (right above maximum 21:30, invalid)

The **Service?** column is for BagBee to confirm — leave `✓` for postal codes you actively serve, change to `✗` for ones that should be blocked at booking time.

### Reykjavík (Höfuðborgarsvæðið — Reykjavík proper)

| Code    | Area / neighbourhood                          | Service? | Pattern | Earliest (left) | Latest (right) | Routing notes                                            |
| ------- | --------------------------------------------- | -------- | ------- | --------------- | -------------- | -------------------------------------------------------- |
| **101** | Miðborg (downtown)                            | ✓        | C? / B  | 17:00 (locked?) | **20:00**      | First stop. Driver leaves centre by ~20:00.              |
| **102** | Vesturbær (north) / Skuggahverfi              | ✓        | B       | 17:00           | **20:00**      | Same corridor as 101.                                    |
| **103** | Kringlan / Háaleiti                           | ✓        | B       | 17:00           | **20:30**      | Mid-corridor.                                            |
| **104** | Laugardalur / Sundahöfn                       | ✓        | B       | 17:00           | **20:30**      | Mid-corridor.                                            |
| **105** | Hlíðar / Laugardalur                          | ✓        | B       | 17:00           | **20:30**      | Driver passes through next.                              |
| **107** | Vesturbær (south)                             | ✓        | B       | 17:00           | **20:30**      | Same corridor as 105.                                    |
| **108** | Háaleiti / Bústaðir / Fossvogur               | ✓        | B       | 17:00           | **21:00**      | Mid-route.                                               |
| **109** | Neðra-Breiðholt                               | ✓        | B       | 17:00           | **21:00**      | Mid-route, on the way south.                             |
| **110** | Árbær / Bryggjuhverfi / Norðlingaholt         | ✓        | B       | 17:00           | **21:00**      | Mid-route.                                               |
| **111** | Efra-Breiðholt                                | ✓        | B       | 17:00           | **21:00**      | Mid-route.                                               |
| **112** | Grafarvogur                                   | ✓        | C? / B  | 17:00 (locked?) | **19:30**      | Off-route detour — must be done early.                   |
| **113** | Grafarholt / Úlfarsárdalur                    | ✓        | C? / B  | 17:00 (locked?) | **19:30**      | Same as 112.                                             |
| **116** | Kjalarnes                                     | **✗**    | —       | —               | —              | Not serviced.                                            |
| **121–132**, **150**, **155**, **161–162** | PO boxes / institutions | n/a   | —       | —               | —              | Not customer addresses — fall back to parent residential code. |

### Capital Region — outside Reykjavík city limits

| Code    | Area                                | Service? | Pattern | Earliest (left) | Latest (right) | Routing notes                                              |
| ------- | ----------------------------------- | -------- | ------- | --------------- | -------------- | ---------------------------------------------------------- |
| **170** | Seltjarnarnes                       | ✓        | C? / B  | 17:00 (locked?) | **20:00**      | Dead-end peninsula — done first to avoid backtracking.     |
| **172** | Seltjarnarnes (PO/rural)            | ✓        | C? / B  | 17:00           | 20:00          | Treat same as 170.                                         |
| **200** | Kópavogur (north)                   | ✓        | B       | 17:30           | **21:00**      | Mid-route south.                                           |
| **201** | Kópavogur (south)                   | ✓        | B       | 17:30           | **21:00**      | Mid-route south.                                           |
| **202**, **203** | Kópavogur (PO/rural)       | ✓        | B       | 17:30           | 21:00          | Treat same as 200.                                         |
| **206** | Kópavogur (Vatnsendi)               | ✓        | B       | 17:30           | **21:00**      | Edge of Kópavogur, slightly later in evening.              |
| **210** | Garðabær                            | ✓        | B       | 18:00           | **21:30**      | Late-mid route.                                            |
| **212** | Garðabær (PO/rural)                 | ✓        | B       | 18:00           | 21:30          | Treat same as 210.                                         |
| **225** | Álftanes (part of Garðabær)         | ✓        | B       | 18:00           | **21:00**      | Peninsula detour west of 220 — careful with timing.        |
| **220** | Hafnarfjörður                       | ✓        | B       | 18:30           | **21:30**      | Late-mid route.                                            |
| **221** | Hafnarfjörður (south)               | ✓        | B       | 18:30           | **21:30**      | Late-mid route.                                            |
| **222** | Hafnarfjörður (PO)                  | ✓        | B       | 18:30           | 21:30          | Treat same as 220.                                         |
| **270** | Mosfellsbær                         | ✓        | B       | 18:00           | **21:00**      | Off-route detour. Done early or as separate trip.          |
| **271** | Mosfellsbær (rural)                 | **✗**    | —       | —               | —              | Not serviced.                                              |
| **276** | Kjós                                | **✗**    | —       | —               | —              | Not serviced.                                              |

### Reykjanes Peninsula (Suðurnes)

| Code    | Area                                  | Service? | Pattern  | Earliest (left)            | Latest (right)        | Routing notes                                       |
| ------- | ------------------------------------- | -------- | -------- | -------------------------- | --------------------- | --------------------------------------------------- |
| **190** | Vogar (Sveitarfélagið Vogar)          | ✓        | **A**    | 17:00 → 21:00 (slidable)   | **22:00 (locked)**    | Window MUST end at 22:00. Last leg before airport.  |
| **191** | Vogar (rural)                         | ✓        | **A**    | 17:00 → 21:00              | **22:00 (locked)**    | Same as 190.                                        |
| **230** | Reykjanesbær (Keflavík)               | ✓        | **A**    | 17:00 → 21:00              | **22:00 (locked)**    | Penultimate stop before airport.                    |
| **232** | Reykjanesbær (PO)                     | ✓        | **A**    | 17:00 → 21:00              | **22:00 (locked)**    | Treat same as 230.                                  |
| **233** | Hafnir (Reykjanesbær)                 | **✗**    | —        | —                          | —                     | Not serviced.                                       |
| **235** | Keflavíkurflugvöllur (KEF)            | ✗        | —        | —                          | —                     | Airport itself — never a pickup origin.             |
| **240** | Grindavík                             | **?**    | —        | —                          | —                     | Confirm — south coast, off main route.              |
| **241** | Grindavík (rural)                     | **?**    | —        | —                          | —                     | Confirm.                                            |
| **245** | Sandgerði (Suðurnesjabær)             | **✗**    | —        | —                          | —                     | Not serviced.                                       |
| **246** | Sandgerði (rural)                     | **✗**    | —        | —                          | —                     | Not serviced.                                       |
| **250** | Garður (Suðurnesjabær)                | **✗**    | —        | —                          | —                     | Not serviced.                                       |
| **251** | Garður (rural)                        | **✗**    | —        | —                          | —                     | Not serviced.                                       |
| **260** | Reykjanesbær (Njarðvík)               | ✓        | **A**    | 17:00 → 21:00 (slidable)   | **22:00 (locked)**    | Adjacent to 230, on the way to airport.             |
| **262** | Reykjanesbær (PO/rural)               | ✓        | **A**    | 17:00 → 21:00              | **22:00 (locked)**    | Treat same as 260.                                  |
| *default* | Anywhere else (incl. typos)         | ✗        | —        | —                          | —                     | "Outside service area" message + flag in Airtable.  |

> ✏️ **Still to confirm:**
> - **240/241 Grindavík** — service or not? (Currently marked `?`.)
> - The pattern marked `C? / B` for 101, 112, 113, 170 — should the **left handle be locked at 17:00** the same way the right handle is locked at 22:00 for late-route zones? (See §8.7.) Locking left = window must START at 17:00. Not locking = customer can pick e.g. `18:00–19:30` for 112, even though the driver may have moved on by 18:00.
> - The **latest-pickup** numbers for Pattern B zones — are they realistic? They cap each zone at the time the driver leaves it.
> - **Min window size** — 1 hour or 2 hours? 1h = current default; 2h = better routing, slightly worse customer UX.
> - PO-box codes (121, 132, 232 etc) — fall back to the parent residential code (e.g. 232 → 230). OK?

---

## 4. Where the rules live (data model)

Three options, pick one:

### Option A — New `Postal Code Cutoffs` table (RECOMMENDED)

Create a new table in `appHB2bNYPAhfUcLv`:

| Field            | Type                                  | Notes                                                |
| ---------------- | ------------------------------------- | ---------------------------------------------------- |
| Postal Code      | Single line text (primary)            | e.g. "101", "170"                                    |
| Area Name        | Single line text                      | "Reykjavík downtown" — for staff readability         |
| Earliest Time    | Number (hours, 17–22)                 | When driver can first arrive in this zone            |
| Latest Time      | Number (hours, 17–22)                 | When driver leaves this zone                         |
| Min Window Hours | Number (default 1)                    | Minimum range customer must pick (1 = strict, 2 = relaxed) |
| Active           | Checkbox                              | Toggle off to disable a zone temporarily             |
| Notes            | Long text                             | Free-form for ops                                    |

**Pros:** Clean separation. One row per postal code. Easy to filter, easy to copy into views. Easy to disable a zone for a day (uncheck `Active`).
**Cons:** A second table for the API to fetch.

### Option B — Extend `Matrix Pickup`

Add `Postal Code` and `Earliest`/`Latest` columns to the existing capacity-override table.
**Pros:** One table.
**Cons:** Conflates two unrelated concerns (per-date capacity vs per-zone constraint). Hard to audit. I'd avoid this.

### Option C — Keep in code, expose admin page

Worst option. Skipping.

> ✏️ **BagBee, please confirm:** OK with Option A?

---

## 5. How the slider behaves with the rules

When the customer types their address in `/book/pick-up`:

1. Google Places autocomplete fires, customer picks a result.
2. We pull the **postal code** out of the `addressComponents` (Google Places API field — easy add to the existing component).
3. Frontend looks up that postal code in the `Postal Code Cutoffs` table (cached client-side via React Query, fetched once on page load).
4. Slider is rendered with **`minLeft = (Earliest - 17)`** and **`maxRight = (Latest - 17)`**, plus the `Min Window Hours` from the row.
5. The unavailable zones at either end of the bar get a hatched grey background (already supported in `TimeRangeSlider.tsx`).
6. We *also* AND-merge with **capacity** from `Config` + `Matrix Pickup`: if the customer's window overlaps a fully-booked hour, that hour is also greyed out. (Capacity is per-date, not per-postal-code.)
7. If the customer's address has **no postal code** (Google didn't return one, e.g. raw business name), we fall back to the default rule (full 17:00–22:00) and log it.
8. If the customer's postal code is **not in the table** (e.g. 240 Grindavík), we show a friendly inline message: *"This area is outside our regular service zone — please contact BagBee to confirm."* and disable the slider.

> ✏️ **BagBee, please confirm:**
> - For postal codes outside the table — block the customer entirely (with the message above), or let them book on the default 17:00–22:00 window with a flag in Airtable for staff review?
> - Do you ever do a single pickup window for multiple zones (e.g. "morning round through 112+113 only, evening round through everything else")? If yes, the rules need a "round" dimension.

---

## 6. Edge cases to decide

1. **Customer changes address after picking a window.** Reset the slider to the new postal code's bounds, or let them keep an out-of-bounds window with a warning?
   *Suggested:* Reset, with a one-line toast "Your previous time window was reset because it doesn't fit your new address."
2. **Customer's address resolves to a corner where two postal codes meet.** Google returns one — we trust it.
3. **Capacity says 19:00–20:00 is full but the customer's zone allows it.** The hour is greyed out inside the slider track (existing behaviour for capacity).
4. **Customer ignores the rules and books directly via API.** API-level validation rejects out-of-bounds windows the same way the UI does. Belt-and-braces — the same check runs in `pages/api/airtable/availability.ts` (or its successor).
5. **Holiday / off-day overrides.** Capacity already handles this via `Matrix Pickup` "Difference Value = -99" (sets max to -97 → false). Postal-code rules respect the `Active` checkbox; turn off a zone for a day by editing in Airtable.
6. **Driver shift is shorter today (e.g. one driver out sick).** Add an optional global `Shift End Override` in `Config` — if set, every postal code's `Latest Time` is clamped to that value.

---

## 7. Suggested implementation phases

**Phase 1 — Data + API (no UI change yet)**
- Create `Postal Code Cutoffs` table in Airtable, populate with the v1 numbers above (after BagBee approval).
- Add `getPostalCodeCutoffs()` helper in `utils/airtable.ts`.
- Extend `/api/airtable/availability` to also return postal-code rules (so the page makes one round-trip, not two).
- Extend `PlaceAutocompleteInput` to extract `postal_code` from Google's address components and surface it in `onPlaceSelect`.
- Store postal code in the booking store alongside `pickupLocation`.

**Phase 2 — Swap card grid for slider**
- Replace `<AvailablePickupTimes />` in `pages/book/pick-up.tsx` with two `<TimeRangeSlider />`s (morning + evening), gated by flight time.
- Wire `getSliderConstraints(postalCode)` to the new Airtable-backed rules instead of the hard-coded ones in `common/postalCodeConstraints.ts`.
- Keep capacity-greying inside the slider (use the same data the cards use today).
- Mirror the same change on `/orders/[orderNo]` edit flow so order-edits respect the postal-code rules too. (Currently passes empty string → no constraints.)

**Phase 3 — Server-side validation + cleanup**
- Validate the chosen window server-side at order creation (reject out-of-bounds).
- Delete `common/postalCodeConstraints.ts` once Airtable is the source of truth.
- Update `system-prompt.ts` (chat widget) so the chat can answer "what time can you pick up in 101?" correctly.

**Phase 4 — Admin niceties (optional)**
- Add a `Shift End Override` field in `Config` for short-staffed days.
- Build an Airtable view "Postal codes with most rejected bookings" to spot rules that are too tight.

---

## 8. Open questions for BagBee

1. ✏️ **Latest-time numbers for Pattern B zones** in §3 — adjust if any are wrong.
2. ✏️ **Option A for data model — go ahead and create the table?**
3. ✏️ **Min window size: 1 hour or 2 hours?**
4. ✏️ **Morning shift (09:00–12:00) — same postal-code rules or no postal-code constraints at all?**
5. ✏️ **Grindavík (240/241)** — serviced or not?
6. ✏️ **"Fully booked" — hard block, or waitlist?** (out of scope for v1, but flagging)
7. ✏️ **Pattern C — left handle locked at 17:00 for early-route zones?**
   The same way Pattern A locks the right handle at 22:00 for late-route zones (Vogar/Njarðvík/Keflavík), Pattern C would lock the LEFT handle at 17:00 for early-route zones (101 downtown, 170 Seltjarnarnes, 112/113 Grafarvogur/Grafarholt).
   - **Locked at 17:00 means:** customer's window MUST start at 17:00. Valid: `17:00–18:00`, `17:00–19:00`, `17:00–20:00`. Invalid: `18:00–19:00`, `18:30–20:00`.
   - **Not locked means:** customer can slide both handles within bounds. Valid: `17:00–19:00`, `18:00–20:00`. Driver may already have moved on, but window is "soft" — they'd come back if absolutely needed.
   - Pattern A is necessary because the driver physically can't return from the airport. Pattern C may not be — the driver could in theory loop back. So this is a routing-efficiency choice, not a hard physical constraint. **Your call.**

---

## 9. What I'm NOT proposing

- Changing the **15:00 cutoff** for tomorrow's bookings. Stays as-is.
- Changing the **morning vs evening** split logic. Stays as-is.
- Changing **capacity** numbers in `Config` / `Matrix Pickup`. Stays as-is, just composed with postal-code rules.
- Changing the **address autocomplete** UX or the **Google Places** integration. Just adding postal-code extraction to it.

---

*End of proposal v1. Edit, strike through, comment, send back.*
