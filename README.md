# Handcrafted by Haze — shop + admin

A mobile-first order form for the Instagram bio link, plus a private admin for
running the shop. Customers pick miniatures, leave their details, pay via GCash,
and upload proof of payment. Orders land in a database; you read them, check the
receipt, and confirm in a DM.

React 19 + Vite + TypeScript + Tailwind v4. This deploys to GitHub Pages at
**handcraftedbyhaze.com**; the API is a **Laravel app in a separate repo** at
**api.handcraftedbyhaze.com**.

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the built `dist/` |
| `npm test` | Vitest — cart maths, validation, persistence, HTTP layer, auth gate |
| `npm run lint:contrast` | Fails if a light palette step is used as text (see [Branding](#branding)) |

---

## How the pieces fit

Two origins, one site:

```
handcraftedbyhaze-fe       npm run build → dist/ → GitHub Pages
                           https://handcraftedbyhaze.com

handcraftedbyhaze-laravel  https://api.handcraftedbyhaze.com
  /api/products            public   the catalogue
  /api/orders              public   order submit (multipart, carries the receipt)
  /sanctum/csrf-cookie     session
  /admin/login|logout      session
  /api/admin/*             gated    orders, statuses, product CRUD
```

**Different origins, the same *site*, and that distinction is doing real work.**
The admin session is an httpOnly cookie, which JS can't read — so an XSS bug
can't walk off with it. That only survives a split because both hosts are under
`handcraftedbyhaze.com` and the cookie is scoped to `.handcraftedbyhaze.com`,
which keeps the browser treating it as first-party. Host the shop on a different
registrable domain — `*.github.io`, say — and Safari blocks the cookie outright:
the login returns 200 and everything after it returns 401.

Two consequences worth knowing before changing anything in `src/lib/api/`:

- **Requests use `credentials: "include"`**, not `"same-origin"`. The latter
  silently sends no cookie at all across origins.
- **`normalizeImage` prefixes `API_URL`.** A product photo or a receipt comes
  back as `/storage/…` or `/api/admin/…`, which is relative *to the API*. Left
  bare it would resolve against the shop and 404.

`VITE_API_URL` is fixed per mode, in two committed files — both public URLs,
neither a secret. `.env.production` holds the live origin, and without it in CI
the build ships pointing at nowhere. `.env.development` holds
`http://localhost:8000`, so `npm run dev` reaches a local API with no arguments
and no one has to remember the port. Vite loads one or the other by mode, so
the dev value cannot reach a production build.

### Deploying

Push to `main` and `.github/workflows/pages.yml` runs the tests, builds, and
publishes to Pages. `public/CNAME` is what holds the custom domain.

Pages serves a file or it 404s — it has no SPA fallback — so the build copies
`index.html` to `404.html`. That's what lets `/admin/orders/5` survive a hard
refresh: Pages hands back the app shell and React Router reads the URL.

For local work against a local API, `npm run dev` is the whole command:
`.env.development` already points at `http://localhost:8000`, and the dev server
port is pinned to 5173 in `vite.config.ts` rather than merely preferred — the
API's `FRONTEND_URL` names that port both for its `/` redirect and for the CORS
allow-list, so a server that slid to the next free port would be shut out of the
API it is talking to.

---

## The shop

1. **Welcome** — what you make, lead time, meetup and delivery info
2. **Products** — add pieces, adjust quantities, running total. A piece that
   offers extras opens a picker instead of adding straight away
3. **Details** — name, IG handle, meetup or delivery (address only if delivery), notes
4. **Payment** — GCash details, total to send, upload the receipt
5. **Review** — a last look at everything
6. **Done** — "I'll confirm in your DM"

The cart and details are saved to `sessionStorage` as they type, so switching to
GCash and coming back to a reloaded page doesn't lose the order. Two rules there,
both deliberate: a reload **never resumes past payment**, because the receipt file
can't survive it and a review screen listing a file that's gone would be a lie;
and nothing is saved once the order is sent.

There is no bundled fallback catalogue. There used to be, for when the Google
Sheet was unreachable — but now that one origin serves both the API and
`index.html`, an API that can't answer can't serve the page either, so a fallback
could only ever show stale data during an outage it couldn't mask. The products
step has real loading, empty, and error states instead.

## The admin

At `/admin`, behind a login.

| Route | |
|---|---|
| `/admin/orders` | Inbox, newest first, with a count of unread ones |
| `/admin/orders/:id` | Items, customer, receipt, and the status control |
| `/admin/products` | Live pieces, and archived ones in their own section |
| `/admin/products/:id` | Edit; `/admin/products/new` to add |

Order statuses are `new → confirmed → fulfilled`, plus `cancelled`.

Products are **archived, never deleted** — past orders still name them. An
archived piece disappears from the shop and stays visible to you, in its own
section, with an **Unhide** button that puts it back. It returns at the bottom
of the live list, not where it used to sit: while it was hidden the pieces
around it were renumbered, so its old spot is somebody else's now.

### About `/admin`

It is **not secret, and isn't treated as if it were.** Anyone can visit the URL
and get a login screen, and its JavaScript chunk is downloadable. What keeps your
data private is that every read and write is checked server-side against the
session — never client-side hiding.

What the split *does* buy is weight: the admin is a lazy-loaded chunk (~22 KB
raw, ~7 KB gzipped) that a customer opening the shop never downloads.

---

## The API contract

What the Laravel repo must serve.

### `GET /api/products` — public

Returns `{"data": [...]}` (a bare array also works). Only pieces that should
appear in the shop — not archived ones.

```jsonc
{
  "id": "bunny",              // required, unique, never changes once orders exist
  "name": "Bunny Buddy",      // falls back to id if empty
  "price": 250,               // required, pesos, whole numbers
  "image": "/assets/bunny.jpg", // absolute URL, or a path on this origin
  "description": "Palm-sized bunny with floppy ears.",
  "available": true,          // false renders "Sold out" rather than hiding it
  "stock": 3,                 // optional. "Only N left" at ≤3, sold out at 0
  "max": 2,                   // optional. Cap per customer per order
  "is_new": false,            // optional. "New" badge; `isNew` also accepted
  "addons": [                 // optional. Up to ten, in the order to show them
    { "slot": 0, "name": "Gift box", "price": 50, "image": "/assets/box.jpg" }
  ]
}
```

A row with `stock: 0` is treated as sold out even if `available` is `true` — the
frontend reconciles the contradiction rather than showing an unbuyable `+`. Rows
with no `id` or an unusable `price` are dropped.

### `POST /api/orders` — public

`multipart/form-data`, 2xx on success. A 422 with an `errors` bag surfaces the
first message to the customer; anything else shows generic copy.

| Field | Notes |
|---|---|
| `name` | |
| `instagram` | No leading `@` |
| `fulfillment` | `Meetup` or `Delivery` |
| `address` | Empty string when `Meetup` |
| `notes` | May be empty |
| `items` | Human-readable lines: `2 × Bunny Buddy — ₱500\nSubtotal: ₱500`. Extras are indented under their piece — see [Add-ons](#add-ons) |
| `subtotal` | A number, e.g. `500` — not `"₱500"` |
| `reference` | GCash reference. Optional for the customer, so often empty |
| `proof` | The receipt image. Max 5 MB, `image/*`, validated client-side too |

### Session

- `GET /sanctum/csrf-cookie`
- `POST /admin/login` ← `{email, password}` → `{"data": AdminUser}`
- `POST /admin/logout`

Return **401** for bad credentials or **422** with an `errors` bag — the login
screen shows the same vague message either way, on purpose, so it can't be used
to discover which accounts exist.

### Gated — `auth:sanctum`

| Endpoint | |
|---|---|
| `GET /api/admin/me` | `{"data": AdminUser}`, or 401 |
| `GET /api/admin/orders` | Newest first |
| `GET /api/admin/orders/{id}` | Adds `address`, `notes`, `items[]`, `receipt_url` |
| `PATCH /api/admin/orders/{id}` | `{status}` |
| *(whatever `receipt_url` points at)* | Streams the image, auth-gated |
| `GET/POST /api/admin/products` | List / create |
| `PATCH /api/admin/products/order` | `{ids: [...]}` — the new display order |
| `POST /api/admin/products/{id}` | Update, with `_method=PATCH` |
| `DELETE /api/admin/products/{id}` | Archive |
| `POST /api/admin/products/{id}/restore` | Unarchive, back at the bottom of the list |

Order fields are accepted in `snake_case` (`customer_name`, `placed_at`,
`item_count`, `unit_price`, `receipt_url`) or camelCase.

The frontend never builds the receipt path itself — it renders whatever
`receipt_url` the order detail returns, so you choose the route (something like
`/api/admin/orders/{id}/receipt`). Whatever it is, **it must require the session**;
returning a public storage URL here is the one mistake that leaks receipts.

`/products/order` has to be matched before `/products/{id}`, or `order` is read
as a slug. It takes every live piece's id, top to bottom, and gives each the
position of its index; ids it isn't sent keep the position they had, which is
how archived pieces — listed apart in the admin, and never listed at all in the
shop — stay out of it. The admin saves on drop and puts the list back if the
save fails, so the order on screen is always the order the shop is in.

Product writes are multipart because they carry a photo, and updates are sent as
`POST` with a `_method=PATCH` field — PHP does not parse a multipart body on a
real `PATCH`. `stock` and `max` are sent as empty strings when not set, which
means *"not tracking it"* and is deliberately distinct from `0`.

## Add-ons

A piece can be offered with up to ten extras, each priced on its own — a
flower on a croissant, a gift box, a handwritten note. Give a piece any and its
**+** becomes an **Add** button that opens a picker.

**`slot` is which extra it is; the array order is where to show it.** The two
are separate on purpose. A cart line is keyed by the slots chosen for it, so a
slot can never move — but the owner can drag the extras into any order in the
admin, and the API sends them already arranged. Everything here looks an extra
up by slot and renders in the order it arrived, so reordering in the admin
never touches a basket someone has open.

**The picker lists "No add-on" first, already ticked**, so the default is a
choice someone can see and point at rather than an empty state they have to
work out. Ticking an extra clears it; clearing the last extra brings it back;
it can't be turned off on its own. The confirm button carries the running
per-piece price, so nobody meets the total for the first time at payment.

**A piece can include some extras for free.** `freeAddons` says how many, and
the ones waived are the *dearest*, so picking a third moves the charge onto the
cheapest rather than the newest. An extra already priced at ₱0 sorts last and
never spends an allowance a paid one could have used. The picker says "any N
free" up front and strikes through the price of each row the allowance is
covering, recomputed as they tick — a discount nobody can see until checkout is
just a surprise. `priceExtras` in `cart.ts` is the only place this is decided,
and the picker, the cart and the order text all call it.

**Prices are per piece.** Two croissants with a ₱50 box is ₱400, not ₱350.

**One piece can be in an order more than once** — once plain, once with a
flower — each its own row under the card with its own quantity. That's what the
cart shape is for: an entry is keyed `"p-c"` or `"p-c::0+2"`, holding the
*slots* chosen, never a name or a price, so a price edited in the admin
reprices a cart already on screen.

**Stock counts the piece, not the combination.** `stock: 1` is one croissant
whether or not it's wearing a flower, so every row on a card runs out together.

`slot` is what a line keys by, and the API sends it rather than leaving it to be
inferred from position — emptying the middle slot must not shift the third onto
a number some open basket already chose.

Extras reach the API indented under their piece in `items`:

```
1 × Personalized Croissant — ₱255
    + Pink flower (₱40)
    + Handwritten note (Free)
2 × Pink Flower Croissant — ₱300
Subtotal: ₱555
```

The piece's line total already includes its extras — they itemise it rather
than adding to it. A free one is written `(Free)`, which is what the picker
showed.

### Four requirements that are expensive to retrofit

1. **`order_items` snapshots `name` and `unit_price` at purchase time.** If order
   lines point at live products, repricing a piece later silently rewrites what a
   customer already paid.
2. **Receipts live on a private disk**, streamed through the gated route above.
   They show amounts, reference numbers, and partial account details — on the
   public disk every customer's receipt is guessable by URL.
3. **Archive products, never hard-delete them**, because orders reference them.
4. **An order line snapshots its chosen add-ons too** — name and price, exactly
   like the piece itself. Renaming "Gift box" must not rewrite what somebody
   already paid for one.

Also on the backend: a one-off importer for the products that used to live in the
Google Sheet, and a notification when an order lands — Netlify used to email you,
and nothing does now.

---

## Business rules baked into the page

- Made to order, ready in **about a week** — stated on the welcome and done screens.
- **Meetup at IT Park or Cebu Business Park, Cebu City**, or **delivery with the
  courier fee shouldered by the customer**. The spots live in `CONFIG.meetupSpots`
  and `meetupPlace()` joins them — add or drop one freely, and every screen that
  names the place follows.
- Customers send the **item total only**. Delivery fees are quoted and settled in
  DM, so nobody has to guess shipping costs up front.
- Confirmation always happens in an Instagram DM, never on the page.

Wording lives in the step components under `src/shop/steps/`. The validation
messages in `src/lib/validate.ts` are written in the shop owner's voice on
purpose — they aren't generic form copy, so don't replace them with "This field
is required".

## Branding

Colors come from the Moss palette, defined in two layers in
`src/styles/theme.css`: the raw ramps, then semantic aliases. Tailwind v4's
`@theme` *is* CSS custom properties, so those tokens are also the utility
vocabulary — `bg-surface-brand`, `text-fg-muted`, `border-field`. Everything
outside that file uses the semantic layer only, so retheming means editing one
block. The admin reuses the same tokens.

Two rules the palette enforces, worth knowing before you tweak anything:

- **`--color-moss-500` (`#84B067`) is a fill, never text.** It's 2.5:1 on white,
  which fails contrast. Green text uses `moss-700` (`text-fg-brand`). Buttons are
  `moss-700` with white labels (4.82:1) — never white on the lighter green.
  `npm run lint:contrast` fails if a light ramp step is used as text.
- **Control outlines need 3:1.** Inputs, buttons, and radio cards use
  `border-field` (`grey-500`). Decorative rules use `border-rule` (`grey-300`),
  which is deliberately too faint for anything meaningful.

Headings, product names, and the GCash name use **Playpen Sans**, self-hosted at
`public/assets/fonts/playpen-sans-latin.woff2` (latin subset, variable 400–700).
Nothing is fetched from Google. Body text stays on the system sans, so it renders
instantly while the display font loads.

## Files

```
index.html            the entry Vite builds around
src/
  routes.tsx          "/" → shop, "/admin/*" → lazy-loaded admin chunk
  config.ts           shop details; API_URL
  shop/               the customer flow
    App.tsx           step routing, validation, submit
    steps/            one component per screen
    components/       card, stepper, upload box, bars, fields, add-on picker
    store/order.tsx   useReducer + Context, sessionStorage rules
  admin/              the private side (its own chunk)
    AdminApp.tsx      routes + the auth gate
    useAuth.tsx       session state; never holds a credential
    Orders  OrderDetail  Products  ProductForm  Login
  lib/
    api/http.ts       the only module that knows about transport
    api/types.ts      the contract above
    api/shop.ts       catalogue + order submit
    api/admin.ts      session, orders, product CRUD
    cart.ts           line items, combinations, totals, stock clamping
    validate.ts       rules and their exact wording
  styles/theme.css    the palette; edit this to retheme
  styles/base.css     @font-face, keyframes, element defaults
public/assets/        photos, GCash QR, favicon, font
```

`public/assets/` is served as-is rather than bundled: `index.html` preloads the
font by its exact URL, and product images referenced by path need stable ones.

### Error handling

`src/lib/api/http.ts` is the single place that maps status codes, so no component
handles one: **401** signs out and bounces to login, **419** (expired CSRF)
refreshes the cookie and retries once, **422** becomes per-field messages, and a
network failure becomes a friendly line. Multipart requests deliberately set no
`Content-Type` — the browser must write the boundary itself, or the upload
silently fails.
