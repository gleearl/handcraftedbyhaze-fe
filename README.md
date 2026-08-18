# Handcrafted by Haze — order form (frontend)

A mobile-first, six-step order form for the Instagram bio link. Customers pick
miniatures, leave their details, pay via GCash, and upload proof of payment.

React 19 + Vite + TypeScript + Tailwind v4, built as a static SPA. The backend
lives in a **separate repo** (Laravel); this app talks to it through one adapter
interface, so it can also run against the original Google Sheet + Netlify Forms
setup with no code change.

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the built `dist/` |
| `npm test` | Vitest — CSV parsing, cart maths, validation, persistence |
| `npm run lint:contrast` | Fails if a light palette step is used as text (see [Branding](#branding)) |

---

## Two backends, one switch

Everything that fetches or submits goes through `OrderSource` in
`src/lib/api/types.ts`. There are two implementations:

| `VITE_ORDER_BACKEND` | Products from | Orders to | Status |
|---|---|---|---|
| `sheet` *(default)* | Published Google Sheet CSV | Netlify Forms | The current live setup |
| `laravel` | `GET {VITE_API_URL}/api/products` | `POST {VITE_API_URL}/api/orders` | Ready for the backend repo |

Switching is an environment variable in Netlify, not a code change. Copy
`.env.example` to `.env` to configure locally.

```bash
VITE_ORDER_BACKEND=sheet
VITE_SHEET_CSV_URL=https://docs.google.com/…&output=csv
VITE_API_URL=http://localhost:8000
```

**If the product source can't be reached**, the page falls back to
`src/lib/fallback-products.ts` and logs a warning, so the shop is never empty.
Keep that list roughly current for exactly this reason.

### Local submits

With `sheet`, orders are **not** posted on localhost — Netlify Forms only exists
on Netlify, so the adapter logs the payload and skips to the thank-you screen.
With `laravel`, orders always post for real, because a local API is the normal
way to develop against it.

---

## The API contract

What the Laravel repo needs to serve. Both endpoints must allow this site's
origin via CORS.

### `GET /api/products`

Returns `{ "data": [...] }` (a bare array also works):

```jsonc
{
  "id": "bunny",              // required, unique, never changes once orders exist
  "name": "Bunny Buddy",      // falls back to id if empty
  "price": 250,               // required, pesos, whole numbers
  "image": "assets/bunny.jpg",// a path served from public/, or a full https:// URL
  "description": "Palm-sized bunny with floppy ears.",
  "available": true,          // false renders "Sold out" rather than hiding it
  "stock": 3,                 // optional. "Only N left" at ≤3, sold out at 0
  "max": 2,                   // optional. Cap per customer per order
  "is_new": false             // optional. "New" badge; `isNew` also accepted
}
```

A row with `stock: 0` is treated as sold out even if `available` is `true` — the
frontend reconciles the contradiction rather than showing an unbuyable `+`.
Rows with no `id` or an unusable `price` are dropped.

### `POST /api/orders`

`multipart/form-data` (there's a file), 2xx on success:

| Field | Notes |
|---|---|
| `name` | |
| `instagram` | No leading `@` |
| `fulfillment` | `Meetup` or `Delivery` |
| `address` | Empty string when `Meetup` |
| `notes` | May be empty |
| `items` | Human-readable lines: `2 × Bunny Buddy — ₱500\nSubtotal: ₱500` |
| `subtotal` | A number, e.g. `500` — not `"₱500"` |
| `reference` | GCash reference. Optional for the customer, so often empty |
| `proof` | The receipt image. Max 5 MB, `image/*`, validated client-side too |

**Stock is not decremented by this endpoint's caller.** The frontend never
assumed it could, and the backend shouldn't infer it should: every GCash receipt
is verified by hand before the order is confirmed in a DM, so decrementing on an
unverified submission would let anyone zero out the shop with junk orders.
Whatever the backend does here is a product decision, not a frontend one.

---

## Managing products from a spreadsheet

With `VITE_ORDER_BACKEND=sheet`, the catalogue is a published Google Sheet, so
prices and stock change without a commit or a deploy — from a phone, even.

Header row, lower case, exactly these names:

| id | name | price | image | description | available | stock | max | new |
|---|---|---|---|---|---|---|---|---|
| bunny | Bunny Buddy | 250 | assets/bunny.jpg | Palm-sized bunny. | yes | | | |
| bear | Sleepy Bear | 280 | assets/bear.jpg | Round little bear. | yes | 2 | | yes |

Only **id**, **name**, and **price** are required; delete the other columns if
you don't want them. `price` accepts `250`, `₱250`, and `1,250`.

`new` is the one column that reads a blank cell as **no** — every other column
treats "you didn't say" as yes. Nothing expires the badge, so clear the cell when
a piece stops being new. A sold-out piece never shows it.

To connect it: **File → Share → Publish to web**, pick the specific sheet (not
"Entire document"), choose **CSV**, and put the link in `VITE_SHEET_CSV_URL`.

Two things worth knowing: Google caches the published CSV, so edits usually
appear within about five minutes; and the sheet is public to anyone with the
link, so keep anything private in a different document — not just a different tab.

---

## Deploying

Netlify, building from this repo: command `npm run build`, publish `dist`.
Both are already in `netlify.toml`. Set the `VITE_*` variables under
**Site configuration → Environment variables**.

### While on `sheet`: the hidden form

`index.html` contains a hidden `<form name="order" data-netlify="true">`. That
block is the only way Netlify learns which fields exist — Vite copies it into
`dist/` verbatim. **If you add a field, add it there too**, and keep the names in
sync with the `FormData` keys in `src/lib/api/sheet-netlify.ts`. A field missing
from that form has its answers silently dropped.

Turn on notifications under **Forms → Form notifications**, and after deploying,
place one real order and check it appears under **Forms → order** *with the image
attached*. That's the one thing that can't be tested locally.

---

## How the flow works

1. **Welcome** — what you make, lead time, meetup and delivery info
2. **Products** — add pieces, adjust quantities, running total
3. **Details** — name, IG handle, meetup or delivery (address only if delivery), notes
4. **Payment** — GCash details, total to send, upload the receipt
5. **Review** — a last look at everything
6. **Done** — "I'll confirm in your DM"

The cart and details are saved to `sessionStorage` as they type, so switching to
GCash and coming back to a reloaded page doesn't lose the order. Two rules there,
both deliberate: a reload **never resumes past payment**, because the receipt file
can't survive it and a review screen listing a file that's gone would be a lie;
and nothing is saved once the order is sent.

## Business rules baked into the page

- Made to order, ready in **about a week** — stated on the welcome and done screens.
- **Meetup at IT Park, Cebu City**, or **delivery with the courier fee shouldered
  by the customer**.
- Customers send the **item total only**. Delivery fees are quoted and settled in
  DM, so nobody has to guess shipping costs up front.
- Confirmation always happens in an Instagram DM, never on the page.

Wording lives in the step components under `src/steps/`. The validation messages
in `src/lib/validate.ts` are written in the shop owner's voice on purpose — they
aren't generic form copy, so don't replace them with "This field is required".

## Branding

Colors come from the Moss palette, defined in two layers in
`src/styles/theme.css`: the raw ramps, then semantic aliases. Tailwind v4's
`@theme` *is* CSS custom properties, so those tokens are also the utility
vocabulary — `bg-surface-brand`, `text-fg-muted`, `border-field`. Everything
outside that file uses the semantic layer only, so retheming means editing one
block.

Two rules the palette enforces, worth knowing before you tweak anything:

- **`--color-moss-500` (`#84B067`) is a fill, never text.** It's 2.5:1 on white,
  which fails contrast. Green text uses `moss-700` (`text-fg-brand`). Buttons are
  `moss-700` with white labels (4.82:1) — never white on the lighter green.
  `npm run lint:contrast` fails the build if a light ramp step is used as text.
- **Control outlines need 3:1.** Inputs, buttons, and radio cards use
  `border-field` (`grey-500`). Decorative rules use `border-rule` (`grey-300`),
  which is deliberately too faint for anything meaningful.

Headings, product names, and the GCash name use **Playpen Sans**, self-hosted at
`public/assets/fonts/playpen-sans-latin.woff2` (latin subset, variable 400–700).
Nothing is fetched from Google. Body text stays on the system sans, so it renders
instantly while the display font loads.

## Files

```
index.html              entry + the hidden form Netlify reads
src/
  App.tsx               step routing, validation, submit
  config.ts             shop details + which backend to use
  steps/                one component per screen
  components/           card, stepper, upload box, bars, fields
  store/order.tsx       useReducer + Context, sessionStorage rules
  lib/
    api/types.ts        the contract the backend must satisfy
    api/sheet-netlify.ts  Google Sheet + Netlify Forms
    api/laravel.ts        the API in the backend repo
    api/csv.ts          CSV parser for the published sheet
    cart.ts             line items, totals, stock clamping
    validate.ts         rules and their exact wording
  styles/theme.css      the palette; edit this to retheme
  styles/base.css       @font-face, keyframes, element defaults
public/assets/          photos, GCash QR, favicon, font
```

`public/assets/` is served as-is rather than bundled, on purpose: the Google
Sheet's `image` column hardcodes those paths, and `index.html` preloads the font
by its exact URL. Hashing them would break both.
