/* Small shared pieces for the admin screens. The shop's Button, Field, and
   ErrorText are reused directly — these are only the things the shop has no
   equivalent for: status pills, page chrome, async state, and the tick row that
   both halves of the extras feature put a list of pieces into. */

import type { ReactNode } from "react";
import { peso } from "../../lib/format";
import type { OrderStatus } from "../../lib/api/types";

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="m-0 font-display text-2xl font-semibold leading-[1.3]">{title}</h1>
      {action}
    </div>
  );
}

export function Money({ amount, className = "" }: { amount: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{peso(amount)}</span>;
}

/* Only "new" gets the loud treatment — it's the one status that means someone
   is waiting on you. The rest are quiet on purpose. */
const STATUS_STYLE: Record<OrderStatus, string> = {
  new:       "bg-action text-on-action",
  confirmed: "bg-surface-brand-soft text-fg-brand border border-brand",
  fulfilled: "bg-surface-subtle text-fg-muted border border-rule",
  cancelled: "bg-danger-bg text-danger border border-danger",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New", confirmed: "Confirmed", fulfilled: "Fulfilled", cancelled: "Cancelled",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs
                      font-semibold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p className="py-10 text-center text-sm text-fg-muted" aria-busy="true">{label}</p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-rule bg-surface p-8 text-center
                    text-[.9375rem] text-fg-muted">
      {children}
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-danger bg-danger-bg p-5 text-center">
      <p className="mt-0 mb-3 text-[.9375rem] text-danger">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer rounded-full border border-field bg-surface px-4 py-2
                   text-sm font-semibold text-fg-brand"
      >
        Try again
      </button>
    </div>
  );
}

/* Cards rather than a <table>: the shop owner reads this on a phone, where a
   four-column table would need horizontal scrolling to say very little. */
export function CardList({ children }: { children: ReactNode }) {
  return <ul className="m-0 grid list-none gap-2.5 p-0">{children}</ul>;
}


/* One row of a checkbox list — a piece to tick, an extra to tick. It lives here
   rather than beside either list because both halves of the extras feature need
   it: the library form ticks pieces onto an extra, and the product form ticks
   extras onto a piece. The same control for what is really the same question,
   asked from the two ends. */
export function Tick({
  id, label, sub, checked, onChange,
}: {
  id: string;
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label htmlFor={id}
           className="flex cursor-pointer items-center gap-3 rounded-sm border border-field
                      bg-surface px-4 py-3 has-checked:border-selected has-checked:bg-surface-brand-soft">
      <input
        type="checkbox" id={id} checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        /* accent-color moss-600 — moss-500 is under 3:1 */
        className="size-[22px] flex-none accent-moss-600"
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold">{label}</span>
        {sub && <span className="text-[.8125rem] text-fg-muted">{sub}</span>}
      </span>
    </label>
  );
}
