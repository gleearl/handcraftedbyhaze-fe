import { describe, expect, it } from "vitest";
import type { Addon, Product } from "./api/types";
import {
  cartCount, cartLines, clampCartToStock, extrasFromKey, extrasLabel, itemsAsText,
  limitFor, lineKeyFor, qtyOfProduct, sanitizeCart, subtotal, type Cart,
} from "./cart";

const make = (over: Partial<Product> & { id: string }): Product => ({
  name: over.id, price: 100, image: "", description: "",
  available: true, isNew: false, addons: [], ...over,
});

const addon = (slot: number, name: string, price: number): Addon =>
  ({ slot, name, price, image: "" });

/** One of a combination, so a test reads as the cart it describes. */
const one = (id: string, extras: number[] = [], qty = 1): Cart =>
  ({ [lineKeyFor(id, extras)]: { id, extras, qty } });

describe("limitFor", () => {
  it("is unbounded when nothing caps it", () => {
    expect(limitFor(make({ id: "a" }))).toBe(Infinity);
  });

  it("takes the lower of stock and max", () => {
    expect(limitFor(make({ id: "a", stock: 5, max: 2 }))).toBe(2);
    expect(limitFor(make({ id: "a", stock: 1, max: 3 }))).toBe(1);
  });
});

describe("lineKeyFor", () => {
  it("is the bare id when nothing extra was chosen", () => {
    expect(lineKeyFor("a", [])).toBe("a");
  });

  it("sorts the slots, so the same choice is always the same line", () => {
    expect(lineKeyFor("a", [2, 0])).toBe("a::0+2");
    expect(lineKeyFor("a", [0, 2])).toBe("a::0+2");
  });

  it("round-trips through extrasFromKey", () => {
    expect(extrasFromKey(lineKeyFor("a", [1, 2]))).toEqual([1, 2]);
    expect(extrasFromKey("a")).toEqual([]);
  });
});

describe("cart totals", () => {
  const products = [make({ id: "a", price: 150 }), make({ id: "b", price: 200 })];

  it("multiplies price by quantity per line", () => {
    const lines = cartLines({ ...one("a", [], 2), ...one("b") }, products);
    expect(lines.map((l) => l.line)).toEqual([300, 200]);
    expect(cartCount(lines)).toBe(3);
    expect(subtotal(lines)).toBe(500);
  });

  it("ignores ids the catalogue no longer has", () => {
    expect(cartLines({ ...one("a"), ...one("gone", [], 4) }, products)).toHaveLength(1);
  });

  it("writes line items with a subtotal", () => {
    const lines = cartLines(one("a", [], 2), products);
    expect(itemsAsText(lines, subtotal(lines))).toBe("2 × a — ₱300\nSubtotal: ₱300");
  });
});

describe("extras on a line", () => {
  const croissant = make({
    id: "c", name: "Croissant", price: 175,
    addons: [addon(0, "Pink flower", 40), addon(1, "Handwritten note", 0), addon(2, "Gift box", 50)],
  });

  it("adds every chosen extra to the price of one piece", () => {
    const [line] = cartLines(one("c", [0, 2], 2), [croissant]);
    expect(line.unit).toBe(265);   // 175 + 40 + 50
    expect(line.line).toBe(530);   // the extras are per piece, so two is twice
  });

  it("holds the same piece twice, once plain and once with an extra", () => {
    const cart = { ...one("c", []), ...one("c", [0], 2) };
    const lines = cartLines(cart, [croissant]);

    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.unit)).toEqual([175, 215]);
    // Stock counts the piece, not the combination.
    expect(qtyOfProduct(cart, "c")).toBe(3);
  });

  it("looks an extra up by slot, not by position", () => {
    // Slot 1 was emptied in the admin; slot 2 must keep its own number.
    const gapped = make({ id: "c", price: 175, addons: [addon(0, "Pink", 40), addon(2, "Box", 50)] });
    const [line] = cartLines(one("c", [2]), [gapped]);
    expect(line.extras.map((a) => a.name)).toEqual(["Box"]);
  });

  it("drops an extra whose slot has gone, keeping the piece", () => {
    const bare = make({ id: "c", price: 175 });
    const [line] = cartLines(one("c", [0]), [bare]);
    expect(line.extras).toEqual([]);
    expect(line.unit).toBe(175);
  });

  it("names a combination the way the picker does", () => {
    expect(extrasLabel([])).toBe("No add-on");
    expect(extrasLabel([addon(0, "Pink flower", 40)])).toBe("With Pink flower");
    expect(extrasLabel([addon(0, "Pink", 40), addon(1, "Box", 50)])).toBe("With Pink + Box");
  });

  it("indents the extras under their piece in the order text", () => {
    const lines = cartLines({ ...one("c", [0, 1]), ...one("c", [], 2) }, [croissant]);
    expect(itemsAsText(lines, subtotal(lines))).toBe(
      "1 × Croissant — ₱215\n"
      + "    + Pink flower (₱40)\n"
      // A free extra says so, because that is what the picker showed.
      + "    + Handwritten note (Free)\n"
      + "2 × Croissant — ₱350\n"
      + "Subtotal: ₱565",
    );
  });
});

describe("sanitizeCart", () => {
  it("drops anything that isn't a line", () => {
    expect(sanitizeCart({ a: 3, b: null, c: "x", d: { qty: 1 } })).toEqual({});
  });

  it("drops a line with no quantity left", () => {
    expect(sanitizeCart({ a: { id: "a", extras: [], qty: 0 } })).toEqual({});
  });

  it("refuses a slot outside the three that exist", () => {
    const cart = sanitizeCart({ a: { id: "a", extras: [0, 9, -1, 1.5], qty: 1 } });
    expect(cart["a::0"]).toEqual({ id: "a", extras: [0], qty: 1 });
  });

  it("merges two entries that normalise onto the same line", () => {
    // Rather than letting one silently win.
    const cart = sanitizeCart({
      x: { id: "a", extras: [1, 0], qty: 1 },
      y: { id: "a", extras: [0, 1], qty: 2 },
    });
    expect(cart).toEqual({ "a::0+1": { id: "a", extras: [0, 1], qty: 3 } });
  });
});

describe("clampCartToStock", () => {
  it("trims a quantity down to what's left", () => {
    const { cart, trimmed } = clampCartToStock(one("a", [], 5), [make({ id: "a", stock: 2 })]);
    expect(cart).toEqual(one("a", [], 2));
    expect(trimmed).toBe(true);
  });

  it("drops the line entirely at stock 0", () => {
    const { cart, trimmed } = clampCartToStock(one("a", [], 5), [make({ id: "a", stock: 0 })]);
    expect(cart).toEqual({});
    expect(trimmed).toBe(true);
  });

  it("drops a line that has become unavailable", () => {
    const { cart } = clampCartToStock(one("a"), [make({ id: "a", available: false })]);
    expect(cart).toEqual({});
  });

  it("drops a line whose product has vanished from the catalogue", () => {
    const { cart } = clampCartToStock(one("gone"), [make({ id: "a" })]);
    expect(cart).toEqual({});
  });

  it("leaves a cart within limits untouched, and keeps the same object", () => {
    const original = one("a", [], 2);
    const { cart, trimmed } = clampCartToStock(original, [make({ id: "a", stock: 5 })]);
    expect(trimmed).toBe(false);
    expect(cart).toBe(original);
  });

  it("counts every combination against the one stock number", () => {
    // Two rows of the same piece, three in total, against a stock of 2.
    const cart = { ...one("a", [], 2), ...one("a", [0], 1) };
    const product = make({ id: "a", stock: 2, addons: [addon(0, "Flower", 40)] });
    const { cart: next, trimmed } = clampCartToStock(cart, [product]);

    expect(trimmed).toBe(true);
    expect(qtyOfProduct(next, "a")).toBe(2);
  });

  it("merges two rows that lose their extras onto the same line", () => {
    const cart = { ...one("a", [0], 1), ...one("a", [1], 2) };
    // Both slots gone: neither row has anything left to tell them apart.
    const { cart: next, trimmed } = clampCartToStock(cart, [make({ id: "a" })]);

    expect(trimmed).toBe(true);
    expect(next).toEqual({ a: { id: "a", extras: [], qty: 3 } });
  });
});
