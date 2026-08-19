import { useState } from "react";
import { Link, useParams } from "react-router";
import { fetchOrder, setOrderStatus } from "../lib/api/admin";
import { ApiError, GENERIC_ERROR } from "../lib/api/http";
import { ORDER_STATUSES, type Order, type OrderStatus } from "../lib/api/types";
import { meetupPlace } from "../config";
import { peso } from "../lib/format";
import { useAsync } from "./useAsync";
import { Loading, LoadError, Money, StatusPill } from "./components/ui";
import { ErrorText } from "../shop/components/ErrorText";

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);

  const { data, error, loading, reload } = useAsync(
    (signal) => fetchOrder(orderId, signal), [orderId],
  );

  if (loading) return <Loading label="Loading order…" />;
  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return null;

  return <OrderView order={data} onChanged={reload} />;
}

function OrderView({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function changeStatus(status: OrderStatus) {
    setSaving(true);
    setSaveError(null);
    try {
      await setOrderStatus(order.id, status);
      onChanged();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : GENERIC_ERROR);
    } finally {
      setSaving(false);
    }
  }

  const rows: [string, string][] = [
    ["Name", order.customerName],
    ["Instagram", "@" + order.instagram],
    ["Handover", order.fulfillment === "Meetup"
      ? `Meetup · ${meetupPlace()}`
      : "Delivery"],
  ];
  if (order.fulfillment === "Delivery" && order.address) rows.push(["Address", order.address]);
  if (order.notes) rows.push(["Notes", order.notes]);
  if (order.reference) rows.push(["GCash ref.", order.reference]);

  return (
    <>
      <Link to="/admin/orders" className="mb-4 inline-block text-sm text-fg-brand no-underline">
        ← All orders
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="m-0 font-display text-2xl font-semibold leading-[1.3]">
          Order #{order.id}
        </h1>
        <StatusPill status={order.status} />
      </div>

      <section className="mb-4 rounded-card border border-rule bg-surface p-4 shadow-card">
        <h2 className="mt-0 mb-3 text-xs font-semibold uppercase tracking-[.12em] text-fg-muted">
          Items
        </h2>
        {/* Prices here are the snapshot taken when the order was placed, not
            today's. Repricing a product must never rewrite what was paid. */}
        <div className="grid gap-2.5 text-[.9375rem]">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between gap-3.5">
              <span>
                {item.quantity} × {item.name}
                {/* What they chose, under the piece. unitPrice already
                    includes these — they say what it's made of. */}
                {item.addons.length > 0 && (
                  <span className="block text-[.8125rem] text-fg-muted">
                    {item.addons.map((a) => a.name).join(", ")}
                  </span>
                )}
              </span>
              <span className="tabular-nums whitespace-nowrap">
                {peso(item.unitPrice * item.quantity)}
              </span>
            </div>
          ))}
          <div className="flex justify-between gap-3.5 border-t border-moss-200 pt-2.5
                          text-[1.0625rem] font-bold">
            <span>Total</span>
            <Money amount={order.subtotal} />
          </div>
        </div>
      </section>

      <section className="mb-4 rounded-card border border-rule bg-surface p-4 shadow-card">
        <h2 className="mt-0 mb-3 text-xs font-semibold uppercase tracking-[.12em] text-fg-muted">
          Customer
        </h2>
        <div className="grid gap-2.5 text-[.9375rem]">
          {rows.map(([key, value]) => (
            <div key={key} className="grid gap-0.5">
              <span className="text-fg-muted">{key}</span>
              <span className="whitespace-pre-line [overflow-wrap:anywhere]">{value}</span>
            </div>
          ))}
        </div>
        <a
          href={`https://instagram.com/${order.instagram}`}
          target="_blank" rel="noopener"
          className="mt-3 inline-block text-sm font-semibold text-fg-brand"
        >
          Message @{order.instagram} →
        </a>
      </section>

      <section className="mb-4 rounded-card border border-rule bg-surface p-4 shadow-card">
        <h2 className="mt-0 mb-3 text-xs font-semibold uppercase tracking-[.12em] text-fg-muted">
          Proof of payment
        </h2>
        {order.receiptUrl ? (
          /* Served through an auth-gated route, never the public disk — a
             receipt shows amounts and partial account details. */
          <a href={order.receiptUrl} target="_blank" rel="noopener">
            <img
              src={order.receiptUrl}
              alt={`Proof of payment for order ${order.id}`}
              className="max-h-[420px] w-auto rounded-sm border border-rule"
            />
          </a>
        ) : (
          <p className="m-0 text-[.9375rem] text-fg-muted">No receipt was attached.</p>
        )}
      </section>

      <section className="mb-4 rounded-card border border-rule bg-surface p-4 shadow-card">
        <h2 className="mt-0 mb-3 text-xs font-semibold uppercase tracking-[.12em] text-fg-muted">
          Status
        </h2>
        <div className="flex flex-wrap gap-2">
          {ORDER_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              disabled={saving || status === order.status}
              onClick={() => void changeStatus(status)}
              className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold
                          disabled:cursor-not-allowed
                          ${status === order.status
                            ? "border-brand bg-surface-brand-soft text-fg-brand"
                            : "border-field bg-surface text-fg hover:border-brand"}`}
            >
              {status[0].toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <ErrorText>{saveError}</ErrorText>
      </section>
    </>
  );
}
