/* Sheets and APIs hand back image paths written by a human: "assets/bunny.jpg",
   "/assets/bunny.jpg", or a full "https://…" link. Relative ones happen to
   resolve today because the app is served from the domain root — normalising
   them means that stays true if it ever moves to a sub-path. */
export function normalizeImage(src: string): string {
  const s = src.trim();
  if (!s) return "";
  if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:") || s.startsWith("/")) return s;
  return "/" + s.replace(/^\.\//, "");
}
