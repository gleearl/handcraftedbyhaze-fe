import { Link } from "react-router";
import { fetchOrders } from "../lib/api/admin";
import { useAsync } from "./useAsync";
import { CardList, EmptyState, Loading, LoadError, Money, PageHeader, StatusPill } from "./components/ui";

/* Dates are for a person deciding what to do today, so "2h ago" beats a
   timestamp until it stops being useful, then the date takes over. */
function whenText(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";

  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  if (mins < 60 * 24 * 7) return `${Math.round(mins / (60 * 24))}d ago`;
  return then.toLocaleDateString("en-PH", { day: "numeric", month: "short" });
}

export function Orders() {
  const { data, error, loading, reload } = useAsync((signal) => fetchOrders(signal));

  const orders = data ?? [];
  const unread = orders.filter((o) => o.status === "new").length;

  return (
    <>
      <PageHeader
        title="Orders"
        action={unread > 0 && (
          <span className="rounded-full bg-action px-3 py-1 text-sm font-semibold text-on-action">
            {unread} new
          </span>
        )}
      />

      {loading && <Loading label="Loading orders…" />}
      {error && !loading && <LoadError message={error} onRetry={reload} />}

      {!loading && !error && orders.length === 0 && (
        <EmptyState>No orders yet. They'll show up here the moment one lands.</EmptyState>
      )}

      {!loading && !error && orders.length > 0 && (
        <CardList>
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                to={`/admin/orders/${o.id}`}
                className={`flex items-center gap-3 rounded-card border bg-surface p-4 no-underline
                            text-fg shadow-card transition-[border-color] hover:border-brand
                            ${o.status === "new" ? "border-brand" : "border-rule"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{o.customerName || "—"}</span>
                    <StatusPill status={o.status} />
                  </span>
                  <span className="mt-0.5 block truncate text-[.8125rem] text-fg-muted">
                    @{o.instagram} · {o.itemCount} {o.itemCount === 1 ? "item" : "items"} ·{" "}
                    {o.fulfillment} · {whenText(o.placedAt)}
                  </span>
                </span>
                <Money amount={o.subtotal} className="flex-none font-semibold" />
              </Link>
            </li>
          ))}
        </CardList>
      )}
    </>
  );
}
