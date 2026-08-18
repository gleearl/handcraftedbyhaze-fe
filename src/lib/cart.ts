import type { Product } from "./api/types";
import { peso } from "./format";

export type Cart = Record<string, number>;

export interface CartLine extends Product {
  qty: number;
  /** price × qty */
  line: number;
}

export const productById = (products: Product[], id: string): Product | undefined =>
  products.find((p) => p.id === id);

export function cartLines(cart: Cart, products: Product[]): CartLine[] {
  return Object.keys(cart)
    .filter((id) => cart[id] > 0 && productById(products, id))
    .map((id) => {
      const p = productById(products, id)!;
      const qty = cart[id];
      return { ...p, qty, line: p.price * qty };
    });
}

export const cartCount = (lines: CartLine[]): number =>
  lines.reduce((n, l) => n + l.qty, 0);

export const subtotal = (lines: CartLine[]): number =>
  lines.reduce((n, l) => n + l.line, 0);

/** Most that may go in one order. `stock` and `max` are each optional caps. */
export function limitFor(p: Product): number {
  const caps = [p.stock, p.max].filter((n): n is number => typeof n === "number");
  return caps.length ? Math.min(...caps) : Infinity;
}

/* Trim a restored cart down to what's actually orderable now: someone may have
   5 saved from yesterday against a stock the owner has since dropped to 2.
   Returns a new cart, and whether anything changed. */
export function clampCartToStock(
  cart: Cart,
  products: Product[],
): { cart: Cart; trimmed: boolean } {
  const next: Cart = { ...cart };
  let trimmed = false;

  Object.keys(next).forEach((id) => {
    const p = productById(products, id);
    const limit = p && p.available ? limitFor(p) : 0;
    if (next[id] <= limit) return;

    trimmed = true;
    if (limit > 0) next[id] = limit;
    else delete next[id];
  });

  return { cart: trimmed ? next : cart, trimmed };
}

/** Human-readable line items for the order record. */
export function itemsAsText(lines: CartLine[], total: number): string {
  return lines.map((l) => `${l.qty} × ${l.name} — ${peso(l.line)}`).join("\n")
    + `\nSubtotal: ${peso(total)}`;
}
