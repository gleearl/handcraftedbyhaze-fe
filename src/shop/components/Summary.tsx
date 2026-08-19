import type { ReactNode } from "react";
import { peso } from "../../lib/format";
import type { CartLine } from "../../lib/cart";

export function Summary({ children }: { children: ReactNode }) {
  return <div className="grid gap-2.5 text-[.9375rem]">{children}</div>;
}

/* Prices stay on one line with tabular figures; free-text values (addresses,
   notes) must be free to wrap, which is why they're a separate row shape. */
function AmountRow({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  return (
    <div className={`flex justify-between gap-3.5 ${
      total ? "border-t border-moss-200 pt-2.5 text-[1.0625rem] font-bold" : ""
    }`}>
      <span>{label}</span>
      <span className="tabular-nums whitespace-nowrap">{value}</span>
    </div>
  );
}

export function ItemRows({ lines, subtotal }: { lines: CartLine[]; subtotal: number }) {
  return (
    <Summary>
      {lines.map((l) => (
        <div key={l.key} className="flex justify-between gap-3.5">
          <span className="min-w-0">
            {l.qty} × {l.name}
            {/* Under the piece rather than run onto the end of it: the pieces
                are what's being counted, the extras are what they're wearing. */}
            {l.extras.length > 0 && (
              <span className="block text-[.8125rem] text-fg-muted">
                with {l.extras.map((a) => a.name).join(", ")}
              </span>
            )}
          </span>
          <span className="tabular-nums whitespace-nowrap">{peso(l.line)}</span>
        </div>
      ))}
      <AmountRow label="Total to send" value={peso(subtotal)} total />
    </Summary>
  );
}

export function DetailRows({ rows }: { rows: [string, string][] }) {
  return (
    <Summary>
      {rows.map(([key, value]) => (
        <div key={key} className="grid gap-0.5">
          <span className="text-fg-muted">{key}</span>
          <span className="text-left whitespace-pre-line [overflow-wrap:anywhere]">{value}</span>
        </div>
      ))}
    </Summary>
  );
}
