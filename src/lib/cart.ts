import { MAX_ADDONS, type Addon, type Product } from "./api/types";
import { peso } from "./format";

/* ==========================================================================
   The cart.

   A line is a product *plus the extras chosen for it*, so the same piece can
   sit in an order twice — once as it is, once with a flower. The key encodes
   that set: "n-sc" plain, "n-sc::0+2" with the first and third add-on.

   What's stored is the slot, never the name or the price. Everything about a
   piece is re-read from the live catalogue when lines are built, so a price
   edited in the admin reprices a cart already on screen.
   ========================================================================== */

/** What's kept: which piece, which slots, how many. Never a name or a price. */
export interface CartEntry {
  id: string;
  /** Slot indices into the product's `addons`, ascending. */
  extras: number[];
  qty: number;
}

export type Cart = Record<string, CartEntry>;

export interface CartLine extends Product {
  /** The cart key this line came from. */
  key: string;
  /** The extras actually chosen — not `product.addons`, which is what's offered. */
  extras: Addon[];
  /** The same extras with the piece's free allowance applied. */
  priced: PricedExtra[];
  qty: number;
  /** One of this combination: the piece plus its extras. */
  unit: number;
  /** unit × qty */
  line: number;
}

export function lineKeyFor(id: string, extras: number[]): string {
  return extras.length
    ? id + "::" + [...extras].sort((a, b) => a - b).join("+")
    : id;
}

export function extrasFromKey(key: string): number[] {
  const at = key.indexOf("::");
  if (at < 0) return [];
  return key.slice(at + 2).split("+").map(Number).filter(Number.isInteger);
}

export const hasAddons = (p: Product): boolean => p.addons.length > 0;

/** One chosen extra, and what it actually costs after the piece's allowance. */
export interface PricedExtra {
  addon: Addon;
  /** Its price, or 0 when the allowance covered it. */
  charged: number;
  /** True when this is one the piece includes at no charge. */
  waived: boolean;
}

/* What a set of chosen extras costs on one piece, given how many that piece
   includes for free.

   The allowance goes to the dearest, which is the answer a customer would pick
   for themselves — and sorting that way also means an extra already priced at
   ₱0 sorts last and never burns an allowance a paid one could have used.
   Sorting indices rather than the extras keeps the result in the order the
   picker shows them, which is the order the owner arranged. */
export function priceExtras(extras: Addon[], free: number): PricedExtra[] {
  const waived = new Set(
    extras
      .map((_, i) => i)
      // Dearest first; equal prices keep their order, so the earlier one wins.
      .sort((a, b) => (extras[b]!.price - extras[a]!.price) || (a - b))
      .slice(0, Math.max(0, free)),
  );

  return extras.map((addon, i) => ({
    addon,
    charged: waived.has(i) ? 0 : addon.price,
    waived: waived.has(i),
  }));
}

export const productById = (products: Product[], id: string): Product | undefined =>
  products.find((p) => p.id === id);

/* Stock counts the piece, not the combination: one croissant is one croissant
   whether or not it's wearing a flower. */
export const qtyOfProduct = (cart: Cart, id: string): number =>
  Object.values(cart).reduce((n, l) => n + (l.id === id ? l.qty : 0), 0);

export function cartLines(cart: Cart, products: Product[]): CartLine[] {
  return Object.keys(cart)
    .map((key): CartLine | null => {
      const entry = cart[key];
      const p = entry && entry.qty > 0 ? productById(products, entry.id) : undefined;
      if (!p) return null;

      /* Matched by slot, never by position — a slot emptied in the admin
         mid-session simply stops being an extra, and the ones left keep their
         own numbers rather than sliding onto somebody else's.

         Listed in the catalogue's order rather than the cart's, so a row reads
         in the order the picker offered it. What's stored stays sorted by slot
         either way: that's what the line's key is built from. */
      const extras = p.addons.filter((a) => entry.extras.includes(a.slot));
      const priced = priceExtras(extras, p.freeAddons);
      const unit = p.price + priced.reduce((n, e) => n + e.charged, 0);

      // `extras` after the spread on purpose: p.addons is what's *offered*,
      // entry.extras is what was *chosen*, and only the second belongs here.
      return { ...p, key, extras, priced, qty: entry.qty, unit, line: unit * entry.qty };
    })
    .filter((l): l is CartLine => l !== null);
}

/* The same words the picker uses for the same thing — a cart row saying one
   thing and the panel that made it saying another is a puzzle nobody needs. */
export const extrasLabel = (extras: Addon[]): string =>
  extras.length ? "With " + extras.map((a) => a.name).join(" + ") : "No add-on";

export const cartCount = (lines: CartLine[]): number =>
  lines.reduce((n, l) => n + l.qty, 0);

export const subtotal = (lines: CartLine[]): number =>
  lines.reduce((n, l) => n + l.line, 0);

/** Most that may go in one order. `stock` and `max` are each optional caps. */
export function limitFor(p: Product): number {
  const caps = [p.stock, p.max].filter((n): n is number => typeof n === "number");
  return caps.length ? Math.min(...caps) : Infinity;
}

/* sessionStorage is the customer's to edit, and a cart shape with more in it
   than a number is more to get wrong. Rebuild it rather than trusting it:
   anything unrecognisable is dropped, and two entries that normalise onto the
   same key merge instead of one silently winning. */
export function sanitizeCart(raw: unknown): Cart {
  const out: Cart = {};
  if (!raw || typeof raw !== "object") return out;

  Object.values(raw as Record<string, unknown>).forEach((value) => {
    const entry = value as Partial<CartEntry> | null;
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string") return;

    const qty = Math.floor(Number(entry.qty));
    if (!Number.isFinite(qty) || qty <= 0) return;

    /* Sorted, because the key is: an entry whose extras disagree with its own
       key would list them in a different order than an identical line built
       any other way. Ascending is the one order everything here assumes. */
    const extras = Array.isArray(entry.extras)
      ? [...new Set(entry.extras.filter(
          (i): i is number => Number.isInteger(i) && i >= 0 && i < MAX_ADDONS,
        ))].sort((a, b) => a - b)
      : [];

    const key = lineKeyFor(entry.id, extras);
    if (out[key]) out[key].qty += qty;
    else out[key] = { id: entry.id, extras, qty };
  });

  return out;
}

/* Trim a restored cart down to what's actually orderable now. Rebuilt rather
   than edited in place, because three things can happen at once here: a piece
   goes away, an extra goes away, and what's left has to fit under a stock
   number that counts the piece rather than the combination. */
export function clampCartToStock(
  cart: Cart,
  products: Product[],
): { cart: Cart; trimmed: boolean } {
  const next: Cart = {};
  const used: Record<string, number> = {};
  let trimmed = false;

  Object.keys(cart).forEach((key) => {
    const entry = cart[key];
    const p = productById(products, entry.id);
    if (!p || !p.available) { trimmed = true; return; }

    const extras = entry.extras.filter((slot) => p.addons.some((a) => a.slot === slot));
    if (extras.length !== entry.extras.length) trimmed = true;

    const qty = Math.min(entry.qty, limitFor(p) - (used[p.id] ?? 0));
    if (qty <= 0) { trimmed = true; return; }
    if (qty !== entry.qty) trimmed = true;

    // Losing an extra can land this line on one that's already here — two rows
    // both reading "No add-on" would be a puzzle, so they become one.
    const k = lineKeyFor(p.id, extras);
    if (next[k]) { next[k].qty += qty; trimmed = true; }
    else next[k] = { id: p.id, extras, qty };

    used[p.id] = (used[p.id] ?? 0) + qty;
  });

  return { cart: trimmed ? next : cart, trimmed };
}

/* What lands in the order record. Extras are indented under their piece rather
   than run onto the end of the line, because this is read on a phone while
   someone checks a GCash receipt, and the pieces are what's being counted. */
export function itemsAsText(lines: CartLine[], total: number): string {
  return lines.map((l) =>
    `${l.qty} × ${l.name} — ${peso(l.line)}`
    /* What was charged, not what it lists for: an extra the piece included
       reads "(Free)", which is what the API parses back as 0. The record has
       to say what somebody actually paid. */
    + l.priced.map((e) => `\n    + ${e.addon.name} (${e.charged > 0 ? peso(e.charged) : "Free"})`).join("")
  ).join("\n") + `\nSubtotal: ${peso(total)}`;
}
