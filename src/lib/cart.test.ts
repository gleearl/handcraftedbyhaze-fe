import { describe, expect, it } from "vitest";
import { MAX_ADDONS, type Addon, type Product } from "./api/types";
import {
  cartCount, cartLines, clampCartToStock, extrasFromKey, extrasLabel, itemsAsText,
  limitFor, lineKeyFor, priceExtras, qtyOfProduct, sanitizeCart, subtotal, type Cart,
} from "./cart";

const make = (over: Partial<Product> & { id: string }): Product => ({
  name: over.id, price: 100, image: "", description: "",
  available: true, isNew: false, freeAddons: 0, addons: [], ...over,
});

const addon = (id: number, name: string, price: number): Addon =>
  ({ id, name, price, image: "" });

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

  it("resolves an extra by its slot however the catalogue is ordered", () => {
    /* The owner can drag the gift box above the flower. A basket keyed
       "c::0+2" was written before that and has to mean the same two extras
       after it — the slot is the identity, its place in the list is not. */
    const rearranged = make({
      id: "c", name: "Croissant", price: 175,
      addons: [addon(2, "Gift box", 50), addon(0, "Pink flower", 40), addon(1, "Note", 0)],
    });
    const [line] = cartLines(one("c", [0, 2], 1), [rearranged]);

    expect(line.unit).toBe(265);
    // …and read back in the order the picker offers them, not in slot order.
    expect(line.extras.map((a) => a.name)).toEqual(["Gift box", "Pink flower"]);
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

  it("keeps ids well past the number of extras a piece may offer", () => {
    /* The bound here used to be the slot bound, `i < MAX_ADDONS`. A library id
       is not a slot and has no upper limit, and reusing that bound would throw
       away every extra in a shop that has ever had more than twenty. */
    const cart = sanitizeCart({ "a::4207": { id: "a", extras: [4207], qty: 1 } });

    expect(cart["a::4207"]?.extras).toEqual([4207]);
  });

  it("drops more extras than a piece could ever offer", () => {
    const tooMany = Array.from({ length: MAX_ADDONS + 1 }, (_, i) => i + 1);
    const cart = sanitizeCart({ x: { id: "a", extras: tooMany, qty: 1 } });

    expect(Object.values(cart)[0]?.extras).toHaveLength(MAX_ADDONS);
  });

  it("drops an id that isn't a positive whole number", () => {
    const cart = sanitizeCart({ x: { id: "a", extras: [0, -3, 1.5, 7], qty: 1 } });

    expect(Object.values(cart)[0]?.extras).toEqual([7]);
  });

  it("merges two entries that normalise onto the same line", () => {
    // Rather than letting one silently win.
    const cart = sanitizeCart({
      x: { id: "a", extras: [2, 1], qty: 1 },
      y: { id: "a", extras: [1, 2], qty: 2 },
    });
    expect(cart).toEqual({ "a::1+2": { id: "a", extras: [1, 2], qty: 3 } });
  });
});

describe("cartLines with a library", () => {
  it("drops an extra the piece no longer offers and reprices the line", () => {
    const p = make({ id: "a", price: 100, addons: [addon(7, "Gift box", 50)] });
    // 12 was ticked when the basket was made and has since been unticked.
    const lines = cartLines(one("a", [7, 12]), [p]);

    expect(lines[0]?.extras.map((e) => e.id)).toEqual([7]);
    expect(lines[0]?.unit).toBe(150);
  });

  it("shows extras in the catalogue's order, not the order they were ticked", () => {
    const p = make({
      id: "a",
      addons: [addon(9, "Gift box", 50), addon(3, "Pink flower", 20)],
    });

    expect(cartLines(one("a", [3, 9]), [p])[0]?.extras.map((e) => e.name))
      .toEqual(["Gift box", "Pink flower"]);
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

describe("extras a piece includes for free", () => {
  const flower = addon(0, "Pink flower", 40);
  const box = addon(1, "Gift box", 50);
  const note = addon(2, "Note", 20);
  const gratis = addon(3, "Ribbon", 0);

  const charged = (extras: Addon[], free: number) =>
    priceExtras(extras, free).reduce((n, e) => n + e.charged, 0);

  it("waives the dearest ones, so the customer pays the cheapest", () => {
    // ₱50 + ₱40 waived, ₱20 charged.
    expect(charged([flower, box, note], 2)).toBe(20);
  });

  it("doesn't depend on the order they were ticked in", () => {
    expect(charged([note, box, flower], 2)).toBe(charged([flower, box, note], 2));
  });

  it("charges for everything when the piece includes none", () => {
    expect(charged([flower, box, note], 0)).toBe(110);
  });

  it("costs nothing when the allowance covers everything picked", () => {
    expect(charged([flower, box], 2)).toBe(0);
    // More free than were offered is not a discount on the piece itself.
    expect(charged([flower], 5)).toBe(0);
  });

  it("never spends an allowance on an extra that was already free", () => {
    /* A ₱0 ribbon has nothing to waive. The two paid ones take the allowance,
       or the customer would pay ₱40 for the privilege of a free ribbon. */
    expect(charged([gratis, flower, box], 2)).toBe(0);
    expect(charged([gratis, flower, box, note], 2)).toBe(20);
  });

  it("says which ones were waived, in the order they're shown", () => {
    const priced = priceExtras([flower, box, note], 2);

    expect(priced.map((e) => e.addon.name)).toEqual(["Pink flower", "Gift box", "Note"]);
    expect(priced.map((e) => e.waived)).toEqual([true, true, false]);
  });

  it("waives the earlier of two extras that cost the same", () => {
    const twin = addon(4, "Twin", 40);
    expect(priceExtras([flower, twin], 1).map((e) => e.waived)).toEqual([true, false]);
  });

  it("prices a cart line with the piece's own allowance", () => {
    const croissant = make({
      id: "c", price: 175, freeAddons: 2,
      addons: [flower, box, note],
    });
    const [line] = cartLines(one("c", [0, 1, 2], 2), [croissant]);

    expect(line.unit).toBe(195);   // 175 + ₱20, the cheapest of the three
    expect(line.line).toBe(390);   // per piece, so two of them is twice
  });

  it("writes a waived extra as Free, which is what the API parses back", () => {
    const croissant = make({ id: "c", name: "Croissant", price: 175, freeAddons: 2,
                             addons: [flower, box, note] });
    const lines = cartLines(one("c", [0, 1, 2], 1), [croissant]);

    expect(itemsAsText(lines, subtotal(lines))).toBe(
      "1 × Croissant — ₱195\n"
      + "    + Pink flower (Free)\n"
      + "    + Gift box (Free)\n"
      + "    + Note (₱20)\n"
      + "Subtotal: ₱195",
    );
  });
});
