/* ─────────────────────────────────────────────────────────────────────────
   Shop details. Everything a new shop would need to change lives here.
   ───────────────────────────────────────────────────────────────────────── */

export const CONFIG = {
  shopName:       "Handcrafted by Haze",
  igHandle:       "handcraftedbyhaze",     // no "@"
  gcashName:      "HA**L S.",              // masked exactly as GCash shows it, so
                                           // customers can match it before sending
  gcashNumber:    "0966 415 3057",         // shown spaced; the Copy button strips
                                           // the spaces so it pastes cleanly
  gcashQr:        "/assets/gcash-qr.png",  // lower-case name on purpose: some CDNs
                                           // are case-sensitive, macOS is not
  meetupLocation: "IT Park, Cebu City",
  leadTime:       "about 1 week",
  maxProofMB:     5,
} as const;

/* Laravel serves this SPA and the API from one origin, so the default is empty
   — every path is relative and there is no CORS to configure. Point it at a
   full origin only when running the SPA on a different host from the API. */
export const API_URL = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");
