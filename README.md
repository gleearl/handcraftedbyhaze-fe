# Handcrafted by Haze — order form

A one-page, mobile-first order form for the Instagram bio link. Customers pick
miniatures, leave their details, pay via GCash, and upload proof of payment.
Orders arrive in your Netlify dashboard with the receipt attached; you confirm
in a DM.

No frameworks, no build step. Three files do all the work.

---

## 1. Put in your real details

Open `app.js`. Everything you need to edit is in the two blocks at the very top.

**`CONFIG`** — your shop info:

| Field | What to put |
|---|---|
| `gcashName` | The name shown on your GCash account |
| `gcashNumber` | Your GCash number |
| `gcashQr` | Path to your QR image (see below) |
| `igHandle` | Your handle, without the `@` |
| `meetupLocation` | Currently "IT Park, Cebu City" |
| `sheetCsvUrl` | Optional — manage products from a spreadsheet instead ([below](#managing-products-from-a-spreadsheet)) |

**`PRODUCTS`** — one line per miniature:

```js
{ id: "bunny", name: "Bunny Buddy", price: 250, image: "assets/product-1.svg",
  description: "Palm-sized bunny with floppy ears.", available: true },
```

- `price` is in pesos, whole numbers, no commas or `₱`.
- `id` must be unique and never change once orders exist.
- `available: false` keeps a piece on the page but marks it **Sold out**.
- To add a piece, copy a line. To remove one, delete its line.

Three optional extras, all left off unless you want them:

- `stock: 3` — how many you have. Shows "Only 3 left" once it's down to 3 or
  fewer, caps the `+` button, and marks the piece **Sold out** at `0`.
- `max: 2` — the most one customer can order in a single go, regardless of stock.
- `isNew: true` — puts a **New** badge on the corner of the photo. Nothing
  expires it for you, so clear it when the piece isn't new anymore. A sold-out
  piece never shows the badge.

If you'd rather manage all this from a spreadsheet than from this file, see
[Managing products from a spreadsheet](#managing-products-from-a-spreadsheet).

## 2. Swap in your photos

Drop your images into `assets/` and point `image` at them:

```js
image: "assets/bunny.jpg",
```

Square photos look best (they're shown at 96×96). The `product-*.svg` files are
just placeholders — delete them once your own photos are in.

Same for your GCash QR: save a screenshot as `assets/gcash-qr.png` and set
`gcashQr: "assets/gcash-qr.png"` in `CONFIG`.

## 3. Preview it on your computer

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Use your browser's phone view to check it the
way customers will see it.

**On localhost, submitting doesn't actually send anything** — it skips straight
to the thank-you screen and logs the order to the browser console, so you can
test the whole flow. Real submissions only happen on the live Netlify site.

## 4. Put it online

1. Push this folder to a GitHub repo.
2. On [netlify.com](https://netlify.com): **Add new site → Import an existing
   project**, pick the repo. Leave the build command empty; publish directory `.`.
3. Deploy. You'll get a URL like `handcraftedbyhaze.netlify.app` — that's the
   link for your bio. (Site settings → Change site name to tidy it up.)

### Turn on order notifications

In your Netlify site: **Forms → Form notifications → Add notification → Email
notification**, and put in your email. Every order then emails you, and all of
them are listed under **Forms → order**, with the proof of payment attached to
each one.

Netlify's free tier includes 100 form submissions a month.

### Test it once, for real

After deploying, place one test order on the live URL and check it shows up
under **Forms** *with the image attached*. This is the one thing that can't be
tested locally.

---

## Managing products from a spreadsheet

Editing `app.js` means a commit and a deploy every time a price changes or a
piece sells out. Instead you can keep the list in a Google Sheet and have the
site read it — no commit, no deploy, and it works from your phone.

### Set up the sheet

Make a sheet with this header row, spelled exactly like this (lower case):

| id | name | price | image | description | available | stock | max | new |
|---|---|---|---|---|---|---|---|---|
| bunny | Bunny Buddy | 250 | assets/product-1.svg | Palm-sized bunny with floppy ears. | yes | | | |
| bear | Sleepy Bear | 280 | assets/product-2.svg | Round little bear. | yes | 2 | | yes |

Only **id**, **name**, and **price** are required — you can delete the other
columns entirely if you don't want them.

| Column | What it does |
|---|---|
| `id` | Unique, and never change it once orders exist |
| `price` | `250`, `₱250`, and `1,250` all work |
| `image` | Either `assets/bunny.jpg` (a file in this repo) or a full `https://…` link |
| `available` | `no` hides it as **Sold out**. Blank or anything else means yes |
| `stock` | How many left. Shows "Only N left" at 3 or fewer, **Sold out** at 0 |
| `max` | Most one customer can order at once |
| `new` | `yes` puts a **New** badge on the photo. Blank means no |

Leave `stock` blank for anything you're not limiting.

`new` is the one column that reads a blank cell as **no** — every other column
treats "you didn't say" as yes. Nothing expires the badge, so clear the cell
when a piece stops being new. A sold-out piece never shows it.

### Publish it and connect it

1. In the sheet: **File → Share → Publish to web**.
2. Pick the specific sheet (not "Entire document"), and choose **CSV**.
3. Copy the link it gives you.
4. Paste it into `sheetCsvUrl` in `CONFIG` at the top of `app.js`, then commit
   and deploy. That's the last deploy you need for product changes.

### How it behaves

- **Edits take a few minutes.** Google caches the published CSV; changes usually
  appear within about five minutes, occasionally longer. Reloading won't hurry it.
- **The sheet is public to anyone with the link.** Publish only the products
  sheet, and keep anything private in a different document — not just a
  different tab.
- **If the sheet can't be reached**, the page silently falls back to the
  `PRODUCTS` list in `app.js`, so the shop is never empty. Worth keeping that
  list roughly current for exactly this reason. When it happens there's an
  explanation in the browser console.
- **Carts get trimmed.** If someone has 5 in their cart and you drop stock to 2,
  their cart is quietly reduced to 2 the next time the page loads.

### About stock, honestly

`stock` is a number **you** control — the site never decrements it. Two people
can order your last bear, because there's no server keeping them in sync, and
nothing knows an order happened until you read it.

That's deliberate rather than unfinished. You verify every GCash receipt by hand
before confirming in a DM, so automatic decrementing would be reacting to
unverified orders — and anyone could zero out your shop with junk submissions.
Adjusting the number yourself while you're replying to the DM keeps you in
charge of it. Real inventory would need a database and a backend, which is a
much bigger change than this project is shaped for.

---

## How the flow works

1. **Welcome** — what you make, lead time, meetup and delivery info
2. **Products** — add pieces, adjust quantities, running total
3. **Details** — name, IG handle, meetup or delivery (address only if delivery), notes
4. **Payment** — GCash details, total to send, upload the receipt
5. **Review** — a last look at everything
6. **Done** — "I'll confirm in your DM"

The cart and details are saved in the browser as they type, so if someone
switches to GCash and comes back to a reloaded page, their order is still there.
The receipt image can't be saved that way, so they'll re-attach it.

## Business rules baked into the page

- Made to order, ready in **about a week** — stated on the welcome and done screens.
- **Meetup at IT Park, Cebu City**, or **delivery with the courier fee shouldered
  by the customer**.
- Customers send the **item total only**. Delivery fees are quoted and settled in
  DM, so nobody has to guess shipping costs up front.
- Confirmation always happens in an Instagram DM, never on the page.

To change any of that wording, search `index.html` for the sentence — it's plain
text in the markup.

## Branding

Colors come from the Moss palette. They're defined in two layers at the top of
`styles.css`: the raw ramps, then semantic aliases (`--action`, `--text`,
`--border`…). Everything below that block uses the semantic names only, so
retheming means editing one block and nothing else.

Headings, product names, and the GCash name use **Playpen Sans**, self-hosted at
`assets/fonts/playpen-sans-latin.woff2` (latin subset, variable 400–700, 192 KB).
Nothing is fetched from Google — to swap the font later, replace that file and
the `@font-face` block at the top of `styles.css`. Body text stays on the system
sans, so it renders instantly while the display font loads.

Two rules the palette enforces, worth knowing before you tweak anything:

- **`--moss-500` (`#84B067`) is a fill, never text.** It's 2.5:1 on white, which
  fails contrast. Green text uses `--moss-700`. Buttons are `--moss-700` with
  white labels (4.82:1) — never white on the lighter green.
- **Control outlines need 3:1.** Inputs, buttons, and radio cards use
  `--border-field` (`--grey-500`). Decorative rules use `--border`
  (`--grey-300`), which is deliberately too faint for anything meaningful.

## Files

```
index.html   the six screens + the hidden form Netlify reads
styles.css   all styling; colors live in the :root block at the top
app.js       CONFIG + PRODUCTS at the top, form logic below
netlify.toml deploy settings
assets/      product photos, GCash QR, favicon
```

### One thing not to touch

The hidden `<form name="order" data-netlify="true">` at the top of `index.html`
is how Netlify learns which fields exist. If you add a field to the form, add it
there too — otherwise its answers get silently dropped.
