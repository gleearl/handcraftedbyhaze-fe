import type { ReactNode } from "react";

export function Card({
  children, tone = "plain", className = "",
}: { children: ReactNode; tone?: "plain" | "total"; className?: string }) {
  const toneClass = tone === "total"
    ? "bg-surface-brand-soft border-moss-200"
    : "bg-surface border-rule";
  return (
    <div className={`mb-4 rounded-card border p-4 shadow-card ${toneClass} ${className}`}>
      {children}
    </div>
  );
}

export function CardLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mt-0 mb-1.5 text-xs font-semibold tracking-[.12em] uppercase text-fg-muted">
      {children}
    </p>
  );
}

/* A dashed panel, deliberately not a control — it explains, it doesn't collect.
   "warm" is the clay accent, used where money needs attention. */
export function Callout({
  children, tone = "plain",
}: { children: ReactNode; tone?: "plain" | "warm" }) {
  const toneClass = tone === "warm"
    ? "bg-surface-accent border-clay-500 text-fg"
    : "bg-surface border-rule text-fg-muted";
  return (
    <div className={`mb-5 rounded-sm border border-dashed px-4 py-3.5 text-sm ${toneClass}`}>
      {children}
    </div>
  );
}
