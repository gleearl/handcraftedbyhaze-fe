/* ==========================================================================
   What the customer-facing shop needs: the catalogue, and somewhere to send
   an order. Both endpoints are public.
   ========================================================================== */

import { request } from "./http";
import { normalizeImage } from "./image";
import { MAX_ADDONS, type Addon, type OrderPayload, type Product } from "./types";

const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/* Kept in the order the API sent them, which is slot order. Each carries its
   own slot, so dropping an unusable one here can't renumber the rest — a cart
   keys its extras by slot, not by where they happen to sit in this list. */
function toAddons(raw: unknown): Addon[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((value, i) => {
    const a = (value ?? {}) as Record<string, unknown>;
    const price = Math.round(Number(a.price));
    const slot = Math.floor(Number(a.slot));

    return {
      // Falling back to position keeps an API that doesn't send slots working.
      slot: Number.isInteger(slot) && slot >= 0 ? slot : i,
      name: String(a.name ?? "").trim(),
      // A blank or unreadable price is a free extra, which is a real thing to
      // want — "add a handwritten note" costs nothing.
      price: Number.isFinite(price) && price > 0 ? price : 0,
      image: normalizeImage(String(a.image ?? "")),
    };
  })
    // An unnamed slot isn't something anyone can choose, and two extras on the
    // same slot would make a cart key ambiguous.
    .filter((a, i, all) => a.name !== "" && a.slot < MAX_ADDONS
      && all.findIndex((b) => b.slot === a.slot) === i)
    .slice(0, MAX_ADDONS);
}

/* The API owns its own truth about availability, but a row saying stock 0 and
   available true is a contradiction the UI shouldn't have to reconcile. */
export function toProduct(raw: Record<string, unknown>): Product | null {
  const id = String(raw.id ?? "").trim();
  const price = Math.round(Number(raw.price));
  if (!id || !Number.isFinite(price) || price < 0) return null;

  const stock = num(raw.stock);

  return {
    id,
    name: String(raw.name ?? id),
    price,
    image: normalizeImage(String(raw.image ?? "")),
    description: String(raw.description ?? ""),
    available: raw.available !== false && stock !== 0,
    stock,
    max: num(raw.max),
    // Accept both spellings so the backend can use either convention.
    isNew: raw.is_new === true || raw.isNew === true,
    addons: toAddons(raw.addons),
  };
}

export function unwrap(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const data = (body as { data?: unknown })?.data;
  return Array.isArray(data) ? data : [];
}

export async function fetchProducts(signal: AbortSignal): Promise<Product[]> {
  const body = await request<unknown>("/api/products", { signal });
  return unwrap(body)
    .map((r) => toProduct(r as Record<string, unknown>))
    .filter((p): p is Product => p !== null);
}

export async function submitOrder(payload: OrderPayload): Promise<void> {
  const data = new FormData();
  data.append("name", payload.name);
  data.append("instagram", payload.instagram);   // no "@" — the API can add one
  data.append("fulfillment", payload.fulfillment);
  data.append("address", payload.fulfillment === "Delivery" ? payload.address : "");
  data.append("notes", payload.notes);
  data.append("items", payload.items);
  data.append("subtotal", String(payload.subtotal)); // a number, not "₱450"
  data.append("reference", payload.reference);
  if (payload.proof) data.append("proof", payload.proof, payload.proof.name);

  await request<unknown>("/api/orders", { method: "POST", body: data });
}
