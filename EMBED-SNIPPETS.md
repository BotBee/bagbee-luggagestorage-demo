# Partner booking-popup embed snippets

The Luggage Lockers and BikeRent booking forms are hosted on bagbee.is and
designed to replace the old Fillout popups on the partner sites. They:

- carry partner branding (partner wordmark + BagBee logo + "partner"),
- take payment through BagBee (Rapyd),
- and after payment send the customer to a self-service page where they can
  change quantities/dates (charged or refunded automatically) or cancel.

| Partner            | Embed URL                                      | After-payment manage page |
| ------------------ | ---------------------------------------------- | ------------------------- |
| Luggage Lockers    | `https://www.bagbee.is/embed/luggage-lockers`  | `/storage/{id}`           |
| Bike Rent Iceland  | `https://www.bagbee.is/embed/bikerent`         | `/bikerent/{id}`          |

The forms `postMessage` their content height to the parent so the iframe can
grow without an inner scrollbar. On "Book", the form navigates the **top**
window to Rapyd's hosted checkout (Rapyd refuses to be iframed), so the customer
leaves the partner site to pay and to manage their booking afterwards.

---

## Option A — inline iframe (recommended, simplest)

Paste where the booking form should appear. Swap the `src` for the BikeRent URL
on bikerent.is.

```html
<iframe
  id="bagbee-booking"
  src="https://www.bagbee.is/embed/luggage-lockers"
  title="Book luggage storage"
  style="width:100%;border:0;display:block;min-height:920px"
  loading="lazy"
></iframe>
<script>
  window.addEventListener('message', function (e) {
    // Only trust messages from bagbee.is
    if (!/^https:\/\/(www\.)?bagbee\.is$/.test(e.origin)) return;
    var d = e.data || {};
    if (d.type === 'bagbee-embed-height' && typeof d.height === 'number') {
      var f = document.getElementById('bagbee-booking');
      if (f) f.style.height = d.height + 'px';
    }
  });
</script>
```

## Option B — button that opens a popup overlay (Fillout-style)

```html
<button id="bagbee-open" type="button">Book now</button>

<div id="bagbee-modal" style="display:none;position:fixed;inset:0;z-index:99999;
     background:rgba(0,0,0,0.55);overflow:auto;">
  <div style="max-width:680px;margin:24px auto;background:#fff;border-radius:14px;
       overflow:hidden;position:relative;">
    <button id="bagbee-close" type="button" aria-label="Close"
      style="position:absolute;top:10px;right:10px;width:34px;height:34px;border:0;
      border-radius:50%;background:#111;color:#fff;font-size:18px;cursor:pointer;z-index:1">×</button>
    <iframe id="bagbee-booking" src="https://www.bagbee.is/embed/luggage-lockers"
      title="Book" style="width:100%;border:0;display:block;min-height:920px"></iframe>
  </div>
</div>

<script>
  var modal = document.getElementById('bagbee-modal');
  document.getElementById('bagbee-open').addEventListener('click', function () { modal.style.display = 'block'; });
  document.getElementById('bagbee-close').addEventListener('click', function () { modal.style.display = 'none'; });
  window.addEventListener('message', function (e) {
    if (!/^https:\/\/(www\.)?bagbee\.is$/.test(e.origin)) return;
    var d = e.data || {};
    if (d.type === 'bagbee-embed-height' && typeof d.height === 'number') {
      var f = document.getElementById('bagbee-booking');
      if (f) f.style.height = d.height + 'px';
    }
  });
</script>
```

---

## Notes

- The partner origins allowed to frame the popups are configured in
  `next.config.js` (`EMBED_HEADERS` → `Content-Security-Policy: frame-ancestors`).
  Add any new partner domain there.
- For local testing, open the URL directly (e.g. `http://localhost:3000/embed/luggage-lockers`)
  — `frame-ancestors 'self'` also lets you iframe it from another local page.
