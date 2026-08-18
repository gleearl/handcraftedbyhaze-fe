import { describe, expect, it } from "vitest";
import type { Product } from "./api/types";
import { cartCount, cartLines, clampCartToStock, itemsAsText, limitFor, subtotal } from "./cart";

const make = (over: Partial<Product> & { id: string }): Product => ({
  name: over.id, price: 100, image: "", description: "", available: true, isNew: false, ...over,
});

describe("limitFor", () => {
  it("is unbounded when nothing caps it", () => {
    expect(limitFor(make({ id: "a" }))).toBe(Infinity);
  });

  it("takes the lower of stock and max", () => {
    expect(limitFor(make({ id: "a", stock: 5, max: 2 }))).toBe(2);
    expect(limitFor(make({ id: "a", stock: 1, max: 3 }))).toBe(1);
  });
});

describe("cart totals", () => {
  const products = [make({ id: "a", price: 150 }), make({ id: "b", price: 200 })];

  it("multiplies price by quantity per line", () => {
    const lines = cartLines({ a: 2, b: 1 }, products);
    expect(lines.map((l) => l.line)).toEqual([300, 200]);
    expect(cartCount(lines)).toBe(3);
    expect(subtotal(lines)).toBe(500);
  });

  it("ignores ids the catalogue no longer has", () => {
    expect(cartLines({ a: 1, gone: 4 }, products)).toHaveLength(1);
  });

  it("writes line items with a subtotal", () => {
    const lines = cartLines({ a: 2 }, products);
    expect(itemsAsText(lines, subtotal(lines))).toBe("2 × a — ₱300\nSubtotal: ₱300");
  });
});

describe("clampCartToStock", () => {
  it("trims a quantity down to what's left", () => {
    const { cart, trimmed } = clampCartToStock({ a: 5 }, [make({ id: "a", stock: 2 })]);
    expect(cart).toEqual({ a: 2 });
    expect(trimmed).toBe(true);
  });

  it("drops the line entirely at stock 0", () => {
    const { cart, trimmed } = clampCartToStock({ a: 5 }, [make({ id: "a", stock: 0 })]);
    expect(cart).toEqual({});
    expect(trimmed).toBe(true);
  });

  it("drops a line that has become unavailable", () => {
    const { cart } = clampCartToStock({ a: 1 }, [make({ id: "a", available: false })]);
    expect(cart).toEqual({});
  });

  it("drops a line whose product has vanished from the catalogue", () => {
    const { cart } = clampCartToStock({ gone: 1 }, [make({ id: "a" })]);
    expect(cart).toEqual({});
  });

  it("leaves a cart within limits untouched, and keeps the same object", () => {
    const original = { a: 2 };
    const { cart, trimmed } = clampCartToStock(original, [make({ id: "a", stock: 5 })]);
    expect(trimmed).toBe(false);
    expect(cart).toBe(original);
  });
});
