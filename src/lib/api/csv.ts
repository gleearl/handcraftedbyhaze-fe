import type { Product } from "./types";

/* A published Google Sheet hands back CSV, so we parse it ourselves. Quoted
   fields are the whole reason this isn't a one-line split: descriptions have
   commas in them, and a quoted field can even contain a newline. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c !== '"') { field += c; continue; }
      if (text[i + 1] === '"') { field += '"'; i++; }  // "" inside quotes is one quote
      else quoted = false;
      continue;
    }

    if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    }
    else field += c;
  }
  row.push(field);
  rows.push(row);

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/* Anything that isn't a clear "no" counts as available — a blank cell means
   you didn't say, and the friendly reading of that is "yes". */
const SAYS_NO = ["no", "n", "false", "0", "sold out", "soldout", "hidden"];

/* "new" defaults the other way: only a clear yes earns the badge, so a sheet
   that has never heard of the column simply has no new pieces. */
const SAYS_YES = ["yes", "y", "true", "1", "new"];

/* Blank → undefined, which downstream means "no limit". */
function optionalCount(raw: string): number | undefined {
  const s = raw.trim();
  if (s === "") return undefined;
  const n = Math.floor(Number(s));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function rowsToProducts(rows: string[][]): Product[] {
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const idx: Record<string, number> = {};
  (["id", "name", "price", "image", "description", "available", "stock", "max", "new"] as const)
    .forEach((key) => { idx[key] = header.indexOf(key); });

  if (idx.id < 0 || idx.name < 0 || idx.price < 0) {
    throw new Error('The sheet needs at least "id", "name", and "price" columns.');
  }

  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] || "").trim() : "");
  const seen = new Set<string>();

  return rows.slice(1).map((row): Product | null => {
    const id = cell(row, idx.id);
    // Tolerate "₱250" and "1,200" — people type what looks right to them.
    const price = Math.round(Number(cell(row, idx.price).replace(/[₱,\s]/g, "")));
    if (!id || seen.has(id) || !Number.isFinite(price) || price < 0) return null;
    seen.add(id);

    const stock = optionalCount(cell(row, idx.stock));

    return {
      id,
      name: cell(row, idx.name) || id,
      price,
      image: cell(row, idx.image),
      description: cell(row, idx.description),
      // Sold out either because you said so, or because stock hit zero.
      available: !SAYS_NO.includes(cell(row, idx.available).toLowerCase()) && stock !== 0,
      stock,
      max: optionalCount(cell(row, idx.max)),
      // The sheet column is "new"; `p.new` reads badly at the call site.
      isNew: SAYS_YES.includes(cell(row, idx.new).toLowerCase()),
    };
  }).filter((p): p is Product => p !== null);
}
