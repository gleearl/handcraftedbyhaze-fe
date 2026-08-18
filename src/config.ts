/* ─────────────────────────────────────────────────────────────────────────
   Shop details. Everything a new shop would need to change lives here or in
   .env — see .env.example.
   ───────────────────────────────────────────────────────────────────────── */

export const CONFIG = {
  shopName:       "Handcrafted by Haze",
  igHandle:       "handcraftedbyhaze",     // no "@"
  gcashName:      "HA**L S.",              // masked exactly as GCash shows it, so
                                           // customers can match it before sending
  gcashNumber:    "0966 415 3057",         // shown spaced; the Copy button strips
                                           // the spaces so it pastes cleanly
  gcashQr:        "/assets/gcash-qr.png",  // lower-case name on purpose: Netlify's
                                           // CDN is case-sensitive, macOS is not
  meetupLocation: "IT Park, Cebu City",
  leadTime:       "about 1 week",
  maxProofMB:     5,
} as const;

/* Which backend serves products and receives orders.
   "sheet"   — published Google Sheet CSV + Netlify Forms (the current setup)
   "laravel" — the API in the backend repo
   Flip it with VITE_ORDER_BACKEND in Netlify; no code change needed. */
export const ORDER_BACKEND =
  import.meta.env.VITE_ORDER_BACKEND === "laravel" ? "laravel" : "sheet";

export const SHEET_CSV_URL = (import.meta.env.VITE_SHEET_CSV_URL ?? "").trim();

export const API_URL = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");
