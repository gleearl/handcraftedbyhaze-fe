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
  meetupSpots:    ["IT Park", "Cebu Business Park"],  // add or drop spots freely
  meetupCity:     "Cebu City",             // said once, after the list of spots
  leadTime:       "about 1 week",
  maxProofMB:     5,
} as const;

/* Laravel serves this SPA and the API from one origin, so the default is empty
   — every path is relative and there is no CORS to configure. Point it at a
   full origin only when running the SPA on a different host from the API. */
/* "IT Park or Cebu Business Park, Cebu City" — the spots read as a choice, and
   the city is said once at the end because they're all in the same one. */
export function meetupPlace(): string {
  const spots = CONFIG.meetupSpots;
  const list = spots.length > 1
    ? spots.slice(0, -1).join(", ") + " or " + spots[spots.length - 1]
    : spots[0];
  return `${list}, ${CONFIG.meetupCity}`;
}

export const API_URL = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");
