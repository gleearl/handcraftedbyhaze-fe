/* ==========================================================================
   Handcrafted by Haze — order form
   No frameworks, no build step. Just edit the two blocks below.
   ========================================================================== */

/* ─────────────────────────────────────────────────────────────────────────
   EDIT ME #1 — your shop details
   ───────────────────────────────────────────────────────────────────────── */
const CONFIG = {
  shopName:       "Handcrafted by Haze",
  igHandle:       "handcraftedbyhaze",     // no "@"
  gcashName:      "HA**L S.",              // masked exactly as GCash shows it, so
                                           // customers can match it before sending
  gcashNumber:    "0966 415 3057",         // shown spaced; the Copy button strips
                                           // the spaces so it pastes cleanly
  gcashQr:        "assets/gcash-qr.png",   // lower-case name on purpose: Netlify's
                                           // CDN is case-sensitive, macOS is not
  meetupLocation: "IT Park, Cebu City",
  leadTime:       "about 1 week",
  maxProofMB:     5,

  // Paste your published Google Sheet CSV link here to manage products from a
  // spreadsheet instead of this file. Leave it "" to use the list below.
  // See "Managing products from a spreadsheet" in the README.
  sheetCsvUrl:    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSEtbg-fj5416tvkz3_QUl0KlEw7wyyQylsw-ZYNAaXoYAgiju786ovNjU2cww8q5u4GLRt6SyFhPaz/pub?gid=848857453&single=true&output=csv",
};

/* ─────────────────────────────────────────────────────────────────────────
   EDIT ME #2 — your products
   Add, remove, or rename freely. `price` is in pesos, whole numbers.
   Set `available: false` to keep a piece listed but not orderable.
   Photos: drop your own into /assets and point `image` at them, or use a
   full https:// link to a photo hosted elsewhere.

   Optional, all left off unless you want them:
     stock — how many you have. Shows "Only N left", hides the piece at 0.
     max   — most one customer can order in a single go.
     isNew — true puts a "New" badge on the photo. Clear it when it isn't
             new anymore; nothing expires it for you. (In the spreadsheet
             this column is just called "new".)

   If CONFIG.sheetCsvUrl is set, the spreadsheet replaces this list at load
   time and this becomes the fallback for when the sheet can't be reached.
   Keep it roughly current so a bad day at Google still shows a real shop.
   ───────────────────────────────────────────────────────────────────────── */
let PRODUCTS = [
  { id: "p-c", name: "Pink Flower Croissant",     price: 150,
    image: "assets/pink-flower-croissant.png",     description: "", available: true, stock: 5 },
  { id: "w-c", name: "White Flower Croissant",    price: 150,
    image: "assets/white-flower-croissant.png",    description: "", available: true, stock: 1, max: 1 },
  { id: "l-c", name: "Lavender Flower Croissant", price: 150,
    image: "assets/lavender-flower-croissant.png", description: "", available: true, stock: 5 },
];

/* ═════════════════════════════════════════════════════════════════════════
   Below here is the form itself. You shouldn't need to change it.
   ═════════════════════════════════════════════════════════════════════════ */

const STEPS = ["welcome", "products", "details", "payment", "review", "done"];
const STORAGE_KEY = "hbh-order-v1";
const PROGRESS_STEPS = 4; // products → details → payment → review

const state = {
  step: 0,
  cart: {},        // { productId: quantity }
  details: { name: "", instagram: "", fulfillment: "", address: "", notes: "", reference: "" },
  proofFile: null, // never persisted — a File can't survive a reload
};

const $ = (id) => document.getElementById(id);
const el = {
  topbar: $("topbar"), backBtn: $("backBtn"), progress: $("progress"),
  progressFill: $("progressFill"), stepLabel: $("stepLabel"),
  startBtn: $("startBtn"), productList: $("productList"),
  actionbar: $("actionbar"), actionbarTotal: $("actionbarTotal"),
  cartCount: $("cartCount"), cartTotal: $("cartTotal"), nextBtn: $("nextBtn"),
  meetupNote: $("meetupNote"), addressWrap: $("addressWrap"),
  paySummary: $("paySummary"), reviewItems: $("reviewItems"), reviewDetails: $("reviewDetails"),
  uploadBox: $("uploadBox"), uploadInner: $("uploadInner"), proof: $("f-proof"),
  copyBtn: $("copyBtn"), igLink: $("igLink"), restartBtn: $("restartBtn"),
  doneFulfillment: $("doneFulfillment"),
};

/* --- Helpers -------------------------------------------------------------- */

const peso = (n) => "₱" + n.toLocaleString("en-PH");

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const productById = (id) => PRODUCTS.find((p) => p.id === id);

function cartLines() {
  return Object.keys(state.cart)
    .filter((id) => state.cart[id] > 0 && productById(id))
    .map((id) => {
      const p = productById(id);
      const qty = state.cart[id];
      return { ...p, qty, line: p.price * qty };
    });
}

const cartCount = () => cartLines().reduce((n, l) => n + l.qty, 0);
const subtotal  = () => cartLines().reduce((n, l) => n + l.line, 0);

function showError(id, message) {
  const node = $("err-" + id);
  if (node) node.textContent = message || "";
}

function clearErrors() {
  document.querySelectorAll(".err").forEach((n) => { n.textContent = ""; });
  document.querySelectorAll(".is-invalid").forEach((n) => n.classList.remove("is-invalid"));
}

function fail(errId, message, fieldEl, markEl) {
  showError(errId, message);
  (markEl || fieldEl)?.classList.add("is-invalid");
  fieldEl?.focus({ preventScroll: false });
  fieldEl?.scrollIntoView({ block: "center", behavior: "smooth" });
  return false;
}

/* --- Persistence ---------------------------------------------------------- */

function save() {
  // The order is already sent — never leave it lying around to be resumed.
  if (STEPS[state.step] === "done") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      cart: state.cart,
      details: state.details,
      // Never resume past payment: the proof file is gone after a reload.
      step: Math.min(state.step, STEPS.indexOf("payment")),
    }));
  } catch (_) { /* private mode — the form still works, it just won't resume */ }
}

function restore() {
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null"); } catch (_) { return; }
  if (!saved) return;

  state.cart = saved.cart && typeof saved.cart === "object" ? saved.cart : {};
  Object.assign(state.details, saved.details || {});

  $("f-name").value    = state.details.name || "";
  $("f-ig").value      = state.details.instagram || "";
  $("f-address").value = state.details.address || "";
  $("f-notes").value   = state.details.notes || "";
  $("f-ref").value     = state.details.reference || "";
  if (state.details.fulfillment === "Meetup")   $("f-meetup").checked = true;
  if (state.details.fulfillment === "Delivery") $("f-delivery").checked = true;
  syncFulfillmentUI();

  if (typeof saved.step === "number" && saved.step > 0 && cartCount() > 0) {
    state.step = Math.min(saved.step, STEPS.indexOf("payment"));
  }
}

function clearSaved() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
}

/* --- Catalogue from a spreadsheet ----------------------------------------- */

/* A published Google Sheet hands back CSV, so we parse it ourselves. Quoted
   fields are the whole reason this isn't a one-line split: descriptions have
   commas in them, and a quoted field can even contain a newline. */
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c !== '"') { field += c; continue; }
      if (text[i + 1] === '"') { field += '"'; i++; }  // "" inside quotes is one quote
      else quoted = false;
      continue;
    }

    if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    }
    else field += c;
  }
  row.push(field);
  rows.push(row);

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/* Anything that isn't a clear "no" counts as available — a blank cell means
   you didn't say, and the friendly reading of that is "yes". */
const SAYS_NO = ["no", "n", "false", "0", "sold out", "soldout", "hidden"];

/* "new" defaults the other way: only a clear yes earns the badge, so a sheet
   that has never heard of the column simply has no new pieces. */
const SAYS_YES = ["yes", "y", "true", "1", "new"];

/* Blank → undefined, which downstream means "no limit". */
function optionalCount(raw) {
  const s = raw.trim();
  if (s === "") return undefined;
  const n = Math.floor(Number(s));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function rowsToProducts(rows) {
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {};
  ["id", "name", "price", "image", "description", "available", "stock", "max", "new"]
    .forEach((key) => { idx[key] = header.indexOf(key); });

  if (idx.id < 0 || idx.name < 0 || idx.price < 0) {
    throw new Error('The sheet needs at least "id", "name", and "price" columns.');
  }

  const cell = (row, i) => (i >= 0 ? (row[i] || "").trim() : "");
  const seen = new Set();

  return rows.slice(1).map((row) => {
    const id = cell(row, idx.id);
    // Tolerate "₱250" and "1,200" — people type what looks right to them.
    const price = Math.round(Number(cell(row, idx.price).replace(/[₱,\s]/g, "")));
    if (!id || seen.has(id) || !Number.isFinite(price) || price < 0) return null;
    seen.add(id);

    const stock = optionalCount(cell(row, idx.stock));

    return {
      id,
      name: cell(row, idx.name) || id,
      price,
      image: cell(row, idx.image),
      description: cell(row, idx.description),
      // Sold out either because you said so, or because stock hit zero.
      available: !SAYS_NO.includes(cell(row, idx.available).toLowerCase()) && stock !== 0,
      stock,
      max: optionalCount(cell(row, idx.max)),
      // The sheet column is "new"; `p.new` reads badly at the call site.
      isNew: SAYS_YES.includes(cell(row, idx.new).toLowerCase()),
    };
  }).filter(Boolean);
}

/* Deliberately not awaited by init(): the welcome screen shouldn't wait on
   Google. Products aren't on screen yet, so swapping them in is invisible. */
async function loadProducts() {
  const url = (CONFIG.sheetCsvUrl || "").trim();
  if (!url) return;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);

  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);

    const products = rowsToProducts(parseCSV(await res.text()));
    if (!products.length) throw new Error("No usable product rows in the sheet.");

    PRODUCTS = products;
    clampCartToStock();   // a resumed cart may now exceed what's left
    renderProducts();
    updateActionBar();
  } catch (err) {
    // Never leave the shop empty — fall through to the list in this file.
    console.warn("[products] Couldn't load the sheet; using the built-in list.", err);
  } finally {
    clearTimeout(timer);
  }
}

/* --- Products ------------------------------------------------------------- */

/* Most that may go in one order. `stock` and `max` are each optional caps. */
function limitFor(p) {
  const caps = [p.stock, p.max].filter((n) => typeof n === "number");
  return caps.length ? Math.min(...caps) : Infinity;
}

/* Trim a restored cart down to what's actually orderable now. */
function clampCartToStock() {
  let trimmed = false;

  Object.keys(state.cart).forEach((id) => {
    const p = productById(id);
    const limit = p && p.available ? limitFor(p) : 0;
    if (state.cart[id] <= limit) return;

    trimmed = true;
    if (limit > 0) state.cart[id] = limit;
    else delete state.cart[id];
  });

  if (trimmed) save();
  return trimmed;
}

/* Sits on the corner of the photo — absolutely, inside .product__media, so it
   costs the card no height. Skipped on sold-out pieces — "New" on something
   nobody can order is just a tease. */
function newBadgeHTML(p) {
  if (!p.isNew || !p.available) return "";
  return '<span class="product__new">New</span>';
}

/* Only worth saying when the number is low enough to mean something. Rides on
   the price row, so it's a span — a <p> inside that row's span wouldn't be. */
function stockNoteHTML(p) {
  if (!p.available || typeof p.stock !== "number" || p.stock > 3) return "";
  return `<span class="product__stock">Only ${p.stock} left</span>`;
}

function stepperHTML(p) {
  if (!p.available) return '<span class="product__soldout">Sold out</span>';
  const qty = state.cart[p.id] || 0;
  if (qty === 0) {
    return `<button type="button" class="stepper__btn stepper__btn--add" data-act="inc" data-id="${esc(p.id)}"
              aria-label="Add ${esc(p.name)} to your order">+</button>`;
  }
  const atLimit = qty >= limitFor(p);
  return `<span class="stepper">
      <button type="button" class="stepper__btn" data-act="dec" data-id="${esc(p.id)}"
              aria-label="Remove one ${esc(p.name)}">−</button>
      <span class="stepper__qty" aria-live="polite" aria-label="${qty} ${esc(p.name)} in your order">${qty}</span>
      <button type="button" class="stepper__btn" data-act="inc" data-id="${esc(p.id)}" ${atLimit ? "disabled" : ""}
              aria-label="${atLimit ? `No more ${esc(p.name)} available` : `Add one more ${esc(p.name)}`}">+</button>
    </span>`;
}

function renderProducts() {
  el.productList.innerHTML = PRODUCTS.map((p) => `
    <article class="product ${p.available ? "" : "is-out"} ${(state.cart[p.id] || 0) > 0 ? "is-added" : ""}"
             data-product="${esc(p.id)}">
      <div class="product__media">
        ${newBadgeHTML(p)}
        ${p.image
          ? `<img class="product__img" src="${esc(p.image)}" alt="${esc(p.name)}" width="112" height="112" loading="lazy">`
          : `<div class="product__img" aria-hidden="true"></div>`}
      </div>
      <div class="product__body">
        <h3 class="product__name">${esc(p.name)}</h3>
        ${p.description ? `<p class="product__desc">${esc(p.description)}</p>` : ""}
        <div class="product__row">
          <span class="product__meta">
            <span class="product__price">${peso(p.price)}</span>
            ${stockNoteHTML(p)}
          </span>
          <span class="product__controls">${stepperHTML(p)}</span>
        </div>
      </div>
    </article>`).join("");
}

function updateProductCard(id) {
  const card = el.productList.querySelector(`[data-product="${CSS.escape(id)}"]`);
  if (!card) return;
  card.querySelector(".product__controls").innerHTML = stepperHTML(productById(id));
  card.classList.toggle("is-added", (state.cart[id] || 0) > 0);
}

el.productList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;

  const id = btn.dataset.id;
  const p = productById(id);
  if (!p) return;

  const current = state.cart[id] || 0;
  state.cart[id] = btn.dataset.act === "inc"
    ? Math.min(current + 1, limitFor(p))   // Infinity when nothing caps it
    : Math.max(0, current - 1);
  if (state.cart[id] === 0) delete state.cart[id];

  updateProductCard(id);
  updateActionBar();
  showError("cart", "");
  save();

  // Keep focus somewhere sensible after the controls are swapped out. The
  // button just pressed may now be disabled — focus can't land there.
  const card = el.productList.querySelector(`[data-product="${CSS.escape(id)}"]`);
  const target = card?.querySelector(`[data-act="${btn.dataset.act}"]:not([disabled])`)
              || card?.querySelector("[data-act]:not([disabled])");
  target?.focus();
});

/* --- Action bar ----------------------------------------------------------- */

function updateActionBar() {
  const stepName = STEPS[state.step];
  const onProducts = stepName === "products";
  const showBar = ["products", "details", "payment", "review"].includes(stepName);

  el.actionbar.hidden = !showBar;
  document.body.classList.toggle("has-bar", showBar);

  el.actionbarTotal.hidden = !onProducts;
  el.cartCount.textContent = cartCount() === 1 ? "1 item" : `${cartCount()} items`;
  el.cartTotal.textContent = peso(subtotal());

  el.nextBtn.textContent = stepName === "review" ? "Place order" : "Continue";
  el.nextBtn.disabled = onProducts && cartCount() === 0;
}

/* --- Fulfillment toggle --------------------------------------------------- */

function syncFulfillmentUI() {
  const choice = document.querySelector('input[name="fulfillment"]:checked')?.value || "";
  el.addressWrap.hidden = choice !== "Delivery";
  el.meetupNote.hidden = choice !== "Meetup";
}

document.querySelectorAll('input[name="fulfillment"]').forEach((r) => {
  r.addEventListener("change", () => {
    showError("fulfillment", "");
    syncFulfillmentUI();
    state.details.fulfillment = r.value;
    save();
  });
});

["f-name", "f-ig", "f-address", "f-notes", "f-ref"].forEach((id) => {
  $(id).addEventListener("input", () => {
    state.details = {
      name: $("f-name").value.trim(),
      instagram: $("f-ig").value.trim().replace(/^@+/, ""),
      fulfillment: document.querySelector('input[name="fulfillment"]:checked')?.value || "",
      address: $("f-address").value.trim(),
      notes: $("f-notes").value.trim(),
      reference: $("f-ref").value.trim(),
    };
    save();
  });
});

/* --- Proof of payment ----------------------------------------------------- */

let previewUrl = null;

el.proof.addEventListener("change", () => {
  const file = el.proof.files[0];
  showError("proof", "");
  el.uploadBox.classList.remove("is-invalid");

  if (!file) { resetUploadBox(); return; }

  if (!file.type.startsWith("image/")) {
    state.proofFile = null;
    resetUploadBox();
    el.proof.value = "";
    return fail("proof", "That's not an image. Please upload a screenshot or photo of your receipt.",
                el.proof, el.uploadBox);
  }
  if (file.size > CONFIG.maxProofMB * 1024 * 1024) {
    state.proofFile = null;
    resetUploadBox();
    el.proof.value = "";
    return fail("proof", `That file is too big (max ${CONFIG.maxProofMB} MB). Try a screenshot instead of a photo.`,
                el.proof, el.uploadBox);
  }

  state.proofFile = file;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);

  el.uploadBox.classList.add("has-file");
  el.uploadInner.innerHTML = `
    <span class="preview">
      <img src="${previewUrl}" alt="Your uploaded proof of payment">
      <span class="preview__meta">
        <span class="preview__name">${esc(file.name)}</span>
        <span class="preview__sub">${(file.size / 1024 / 1024).toFixed(1)} MB · tap to change</span>
      </span>
    </span>`;
});

function resetUploadBox() {
  el.uploadBox.classList.remove("has-file");
  el.uploadInner.innerHTML = `
    <span class="upload__icon" aria-hidden="true">🧾</span>
    <span class="upload__text">Upload your GCash screenshot</span>
    <span class="upload__sub">JPG or PNG · up to ${CONFIG.maxProofMB}&nbsp;MB</span>`;
}

/* --- Summaries ------------------------------------------------------------ */

function itemRowsHTML() {
  return cartLines().map((l) => `
    <div class="summary__row">
      <span>${l.qty} × ${esc(l.name)}</span>
      <span>${peso(l.line)}</span>
    </div>`).join("") + `
    <div class="summary__row summary__row--total">
      <span>Total to send</span>
      <span>${peso(subtotal())}</span>
    </div>`;
}

function detailRowsHTML() {
  const d = state.details;
  const rows = [
    ["Name", d.name],
    ["Instagram", "@" + d.instagram],
    ["Handover", d.fulfillment === "Meetup" ? `Meetup · ${CONFIG.meetupLocation}` : "Delivery"],
  ];
  if (d.fulfillment === "Delivery") rows.push(["Address", d.address]);
  if (d.notes) rows.push(["Notes", d.notes]);
  if (d.reference) rows.push(["GCash ref.", d.reference]);
  rows.push(["Proof", state.proofFile ? state.proofFile.name : "—"]);

  return rows.map(([k, v]) => `
    <div class="summary__row summary__row--stack">
      <span class="summary__key">${esc(k)}</span>
      <span class="summary__val">${esc(v)}</span>
    </div>`).join("");
}

/* --- Validation ----------------------------------------------------------- */

function validateStep(stepName) {
  clearErrors();

  if (stepName === "products") {
    if (cartCount() === 0) {
      showError("cart", "Add at least one piece to continue.");
      return false;
    }
    return true;
  }

  if (stepName === "details") {
    const d = state.details;
    if (!d.name) return fail("name", "Please tell me your name.", $("f-name"));
    if (!d.instagram) {
      return fail("ig", "I need your Instagram handle to confirm your order.",
                  $("f-ig"), $("f-ig").parentElement);
    }
    if (!d.fulfillment) {
      showError("fulfillment", "Choose meetup or delivery.");
      $("f-meetup").focus();
      return false;
    }
    if (d.fulfillment === "Delivery" && !d.address) {
      return fail("address", "Please enter the full delivery address.", $("f-address"));
    }
    return true;
  }

  if (stepName === "payment") {
    if (!state.proofFile) {
      return fail("proof", "Please upload your proof of payment.", el.proof, el.uploadBox);
    }
    return true;
  }

  return true;
}

/* --- Navigation ----------------------------------------------------------- */

function goTo(index) {
  state.step = Math.max(0, Math.min(STEPS.length - 1, index));
  const name = STEPS[state.step];

  STEPS.forEach((s, i) => { $("step-" + s).hidden = i !== state.step; });

  const progressIndex = state.step; // 1..4 map onto the four progress steps
  const showTopbar = progressIndex >= 1 && progressIndex <= PROGRESS_STEPS;
  el.topbar.hidden = !showTopbar;
  if (showTopbar) {
    el.progressFill.style.width = (progressIndex / PROGRESS_STEPS) * 100 + "%";
    el.progress.setAttribute("aria-valuenow", String(progressIndex));
    el.stepLabel.textContent = `Step ${progressIndex} of ${PROGRESS_STEPS}`;
  }

  if (name === "payment") el.paySummary.innerHTML = itemRowsHTML();
  if (name === "review") {
    el.reviewItems.innerHTML = itemRowsHTML();
    el.reviewDetails.innerHTML = detailRowsHTML();
  }

  updateActionBar();
  save();
  window.scrollTo(0, 0);
  requestAnimationFrame(() => window.scrollTo(0, 0)); // after the new step lays out
}

el.startBtn.addEventListener("click", () => goTo(STEPS.indexOf("products")));
el.backBtn.addEventListener("click", () => goTo(state.step - 1));

el.nextBtn.addEventListener("click", () => {
  const name = STEPS[state.step];
  if (!validateStep(name)) return;
  if (name === "review") { submitOrder(); return; }
  goTo(state.step + 1);
});

el.restartBtn.addEventListener("click", () => {
  state.cart = {};
  state.details = { name: "", instagram: "", fulfillment: "", address: "", notes: "", reference: "" };
  state.proofFile = null;
  el.proof.value = "";
  resetUploadBox();
  ["f-name", "f-ig", "f-address", "f-notes", "f-ref"].forEach((id) => { $(id).value = ""; });
  document.querySelectorAll('input[name="fulfillment"]').forEach((r) => { r.checked = false; });
  syncFulfillmentUI();
  clearErrors();
  renderProducts();
  clearSaved();
  goTo(0);
});

/* --- Copy GCash number ---------------------------------------------------- */

el.copyBtn.addEventListener("click", async () => {
  // Digits only — a pasted "0966 415 3057" gets rejected by some number fields.
  const number = CONFIG.gcashNumber.replace(/\s+/g, "");
  try {
    await navigator.clipboard.writeText(number);
  } catch (_) {
    const tmp = document.createElement("textarea");
    tmp.value = number;
    tmp.setAttribute("readonly", "");
    tmp.style.position = "absolute";
    tmp.style.left = "-9999px";
    document.body.appendChild(tmp);
    tmp.select();
    try { document.execCommand("copy"); } catch (__) {}
    document.body.removeChild(tmp);
  }
  el.copyBtn.textContent = "Copied!";
  setTimeout(() => { el.copyBtn.textContent = "Copy"; }, 1600);
});

/* --- Submit --------------------------------------------------------------- */

const isLocalPreview = () =>
  location.protocol === "file:" ||
  ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(location.hostname);

function itemsAsText() {
  return cartLines().map((l) => `${l.qty} × ${l.name} — ${peso(l.line)}`).join("\n")
    + `\nSubtotal: ${peso(subtotal())}`;
}

async function submitOrder() {
  const d = state.details;
  el.nextBtn.disabled = true;
  el.nextBtn.textContent = "Sending…";
  showError("submit", "");

  const data = new FormData();
  data.append("form-name", "order");
  data.append("bot-field", "");
  data.append("name", d.name);
  data.append("instagram", "@" + d.instagram);
  data.append("fulfillment", d.fulfillment === "Meetup" ? `Meetup · ${CONFIG.meetupLocation}` : "Delivery");
  data.append("address", d.fulfillment === "Delivery" ? d.address : "");
  data.append("notes", d.notes);
  data.append("items", itemsAsText());
  data.append("subtotal", peso(subtotal()));
  data.append("reference", d.reference);
  if (state.proofFile) data.append("proof", state.proofFile, state.proofFile.name);

  try {
    if (isLocalPreview()) {
      // Netlify Forms only exists on Netlify. Locally we skip the POST so the
      // whole flow stays testable; on the live site this branch never runs.
      console.warn("[local preview] Skipping the Netlify Forms POST. Order payload:",
        Object.fromEntries(Array.from(data.entries()).map(([k, v]) => [k, v instanceof File ? v.name : v])));
    } else {
      // No Content-Type header on purpose — the browser must set the multipart
      // boundary itself, otherwise the file upload silently fails.
      const res = await fetch("/", { method: "POST", body: data });
      if (!res.ok) throw new Error("HTTP " + res.status);
    }
    finishOrder();
  } catch (err) {
    console.error(err);
    showError("submit", "Something went wrong sending your order. Check your connection and try again — or DM me the details and I'll take it from there.");
    el.nextBtn.disabled = false;
    el.nextBtn.textContent = "Place order";
  }
}

function finishOrder() {
  el.doneFulfillment.innerHTML = state.details.fulfillment === "Meetup"
    ? `<strong>Meetup.</strong> We'll agree on a time and spot at ${esc(CONFIG.meetupLocation)} once it's ready.`
    : `<strong>Delivery.</strong> I'll quote the courier fee in your DM before shipping — that part's shouldered by you.`;

  clearSaved();
  el.nextBtn.disabled = false;
  el.nextBtn.textContent = "Continue";
  goTo(STEPS.indexOf("done"));
}

/* --- Boot ----------------------------------------------------------------- */

/* Any of these can be commented out of the markup while you're tweaking the
   page — that shouldn't take the whole form down with it. */
const setText = (id, value) => { const node = $(id); if (node) node.textContent = value; };

function init() {
  document.title = `Order Form — ${CONFIG.shopName}`;
  setText("shopName", CONFIG.shopName);
  setText("footerHandle", "@" + CONFIG.igHandle);
  setText("gcashName", CONFIG.gcashName);
  setText("gcashNumber", CONFIG.gcashNumber);
  setText("meetupNote",
    `We'll agree on the exact spot and time at ${CONFIG.meetupLocation} over DM once your piece is ready.`);

  if ($("gcashQr")) $("gcashQr").src = CONFIG.gcashQr;
  if (el.igLink) el.igLink.href = "https://instagram.com/" + CONFIG.igHandle;

  renderProducts();
  resetUploadBox();
  restore();
  clampCartToStock();
  goTo(state.step);

  // Not awaited on purpose — see loadProducts().
  loadProducts();
}

init();
