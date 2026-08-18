/* ==========================================================================
   The current setup: products from a published Google Sheet CSV, orders into
   Netlify Forms. Kept live so the shop keeps taking orders until the Laravel
   API is ready — see src/lib/api/laravel.ts for the replacement.
   ========================================================================== */

import { SHEET_CSV_URL, CONFIG } from "../../config";
import { parseCSV, rowsToProducts } from "./csv";
import { normalizeImage } from "./image";
import type { OrderPayload, OrderSource, Product } from "./types";
import { peso } from "../format";

async function fetchProducts(signal: AbortSignal): Promise<Product[]> {
  if (!SHEET_CSV_URL) throw new Error("VITE_SHEET_CSV_URL is not set.");

  const res = await fetch(SHEET_CSV_URL, { cache: "no-store", signal });
  if (!res.ok) throw new Error("HTTP " + res.status);

  const products = rowsToProducts(parseCSV(await res.text()));
  if (!products.length) throw new Error("No usable product rows in the sheet.");

  return products.map((p) => ({ ...p, image: normalizeImage(p.image) }));
}

/* Netlify Forms only exists on Netlify — there is nothing at "/" to POST to on
   a dev server. Skipping it keeps the whole flow testable locally; on the live
   site this branch never runs. The Laravel adapter has no such problem: a local
   API is the normal way to develop against it, so it always posts for real. */
const isLocalPreview = () =>
  location.protocol === "file:" ||
  ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(location.hostname);

async function submitOrder(payload: OrderPayload): Promise<void> {
  const data = new FormData();
  // These keys must match the hidden <form name="order"> in index.html —
  // that block is how Netlify learns which fields exist. Add one here and
  // you must add it there, or its answers get silently dropped.
  data.append("form-name", "order");
  data.append("bot-field", "");
  data.append("name", payload.name);
  data.append("instagram", "@" + payload.instagram);
  data.append("fulfillment", payload.fulfillment === "Meetup"
    ? `Meetup · ${CONFIG.meetupLocation}`
    : "Delivery");
  data.append("address", payload.fulfillment === "Delivery" ? payload.address : "");
  data.append("notes", payload.notes);
  data.append("items", payload.items);
  data.append("subtotal", peso(payload.subtotal));
  data.append("reference", payload.reference);
  if (payload.proof) data.append("proof", payload.proof, payload.proof.name);

  if (isLocalPreview()) {
    console.warn("[local preview] Skipping the Netlify Forms POST. Order payload:",
      Object.fromEntries(Array.from(data.entries())
        .map(([k, v]) => [k, v instanceof File ? v.name : v])));
    return;
  }

  // No Content-Type header on purpose — the browser must set the multipart
  // boundary itself, otherwise the file upload silently fails.
  const res = await fetch("/", { method: "POST", body: data });
  if (!res.ok) throw new Error("HTTP " + res.status);
}

export const sheetNetlifySource: OrderSource = { fetchProducts, submitOrder };
