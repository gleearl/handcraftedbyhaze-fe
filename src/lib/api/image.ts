import { API_URL } from "../../config";

/* An API hands back image paths written by a human or by Laravel's disk:
   "assets/bunny.jpg", "/storage/products/bunny.jpg", or a full "https://…".

   The relative ones are relative to *the API*, not to this page — the shop and
   the API are different origins now, so a bare "/storage/…" would resolve
   against the shop and 404. Prefixing with API_URL is what keeps a product
   photo and an auth-gated receipt pointing where they actually live. API_URL
   is empty when the two are served together, which leaves these untouched. */
export function normalizeImage(src: string): string {
  const s = src.trim();
  if (!s) return "";
  if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;

  return API_URL + (s.startsWith("/") ? s : "/" + s.replace(/^\.\//, ""));
}
