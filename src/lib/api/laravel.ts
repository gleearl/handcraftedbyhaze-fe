/* ==========================================================================
   The Laravel API in the backend repo. Switch to it with VITE_ORDER_BACKEND=laravel.

   It must serve, from VITE_API_URL, with CORS open to this site's origin:

     GET  /api/products  → { data: Product[] }  (a bare Product[] also works)
     POST /api/orders    ← multipart/form-data, fields as below, 2xx on success

   See README, "The API contract".
   ========================================================================== */

import { API_URL } from "../../config";
import { normalizeImage } from "./image";
import type { OrderPayload, OrderSource, Product } from "./types";

/* The API owns its own truth about availability, but a row that says stock 0
   and available true is a contradiction the UI shouldn't have to reconcile. */
function toProduct(raw: Record<string, unknown>): Product | null {
  const id = String(raw.id ?? "").trim();
  const price = Math.round(Number(raw.price));
  if (!id || !Number.isFinite(price) || price < 0) return null;

  const num = (v: unknown) => {
    const n = Math.floor(Number(v));
    return v === null || v === undefined || v === "" || !Number.isFinite(n) || n < 0
      ? undefined
      : n;
  };
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
    // Accept both spellings so the backend can use either.
    isNew: raw.is_new === true || raw.isNew === true,
  };
}

async function fetchProducts(signal: AbortSignal): Promise<Product[]> {
  if (!API_URL) throw new Error("VITE_API_URL is not set.");

  const res = await fetch(`${API_URL}/api/products`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error("HTTP " + res.status);

  const body = await res.json();
  const rows: unknown[] = Array.isArray(body) ? body : (body?.data ?? []);

  const products = rows
    .map((r) => toProduct(r as Record<string, unknown>))
    .filter((p): p is Product => p !== null);

  if (!products.length) throw new Error("The API returned no usable products.");
  return products;
}

async function submitOrder(payload: OrderPayload): Promise<void> {
  if (!API_URL) throw new Error("VITE_API_URL is not set.");

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

  // No Content-Type header on purpose — the browser must set the multipart
  // boundary itself, otherwise the file upload silently fails.
  const res = await fetch(`${API_URL}/api/orders`, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: data,
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
}

export const laravelSource: OrderSource = { fetchProducts, submitOrder };
