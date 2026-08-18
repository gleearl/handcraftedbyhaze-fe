import { useState } from "react";
import { Link } from "react-router";
import { archiveProduct, fetchAdminProducts } from "../lib/api/admin";
import { ApiError, GENERIC_ERROR } from "../lib/api/http";
import { useAsync } from "./useAsync";
import {
  CardList, EmptyState, Loading, LoadError, Money, PageHeader,
} from "./components/ui";
import { ErrorText } from "../shop/components/ErrorText";

export function Products() {
  const { data, error, loading, reload } = useAsync((signal) => fetchAdminProducts(signal));
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const products = data ?? [];
  const live = products.filter((p) => !p.archived);
  const archived = products.filter((p) => p.archived);

  async function archive(id: string, name: string) {
    // Archiving is reversible in the database but not from this screen yet,
    // so it's worth one confirm rather than a silent surprise.
    if (!confirm(`Hide "${name}" from the shop? Past orders keep it.`)) return;
    setBusyId(id);
    setActionError(null);
    try {
      await archiveProduct(id);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : GENERIC_ERROR);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Products"
        action={
          <Link
            to="/admin/products/new"
            className="rounded-full bg-action px-5 py-2.5 text-sm font-semibold
                       text-on-action no-underline"
          >
            Add a piece
          </Link>
        }
      />

      {loading && <Loading label="Loading products…" />}
      {error && !loading && <LoadError message={error} onRetry={reload} />}
      <ErrorText>{actionError}</ErrorText>

      {!loading && !error && products.length === 0 && (
        <EmptyState>No pieces yet. Add your first one to open the shop.</EmptyState>
      )}

      {live.length > 0 && (
        <CardList>
          {live.map((p) => (
            <li key={p.id}>
              <Row
                id={p.id}
                name={p.name}
                price={p.price}
                image={p.image}
                meta={[
                  p.available ? null : "Sold out",
                  typeof p.stock === "number" ? `${p.stock} left` : null,
                  typeof p.max === "number" ? `max ${p.max}` : null,
                  p.isNew ? "New" : null,
                ].filter(Boolean).join(" · ")}
                busy={busyId === p.id}
                onArchive={() => void archive(p.id, p.name)}
              />
            </li>
          ))}
        </CardList>
      )}

      {archived.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-[.12em] text-fg-muted">
            Hidden from the shop
          </h2>
          <CardList>
            {archived.map((p) => (
              <li key={p.id} className="opacity-60">
                <Row id={p.id} name={p.name} price={p.price} image={p.image} meta="Archived" />
              </li>
            ))}
          </CardList>
        </>
      )}
    </>
  );
}

function Row({
  id, name, price, image, meta, busy, onArchive,
}: {
  id: string; name: string; price: number; image: string; meta: string;
  busy?: boolean; onArchive?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-rule bg-surface p-3 shadow-card">
      {image
        ? <img src={image} alt="" className="size-14 flex-none rounded-sm bg-surface-brand-soft object-cover" />
        : <div className="size-14 flex-none rounded-sm bg-surface-brand-soft" />}

      <div className="min-w-0 flex-1">
        <p className="m-0 truncate font-display font-semibold">{name}</p>
        <p className="m-0 truncate text-[.8125rem] text-fg-muted">
          <Money amount={price} /> {meta && `· ${meta}`}
        </p>
      </div>

      <Link to={`/admin/products/${id}`} className="flex-none text-sm font-semibold text-fg-brand no-underline">
        Edit
      </Link>

      {onArchive && (
        <button
          type="button"
          onClick={onArchive}
          disabled={busy}
          className="flex-none cursor-pointer border-0 bg-transparent text-sm text-fg-muted
                     underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Hiding…" : "Hide"}
        </button>
      )}
    </div>
  );
}
