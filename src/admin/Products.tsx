import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  archiveProduct, fetchAdminProducts, reorderProducts, restoreProduct,
} from "../lib/api/admin";
import { ApiError, GENERIC_ERROR } from "../lib/api/http";
import type { AdminProduct } from "../lib/api/types";
import { useAsync } from "./useAsync";
import { DRAG_HANDLE, dragLabel, useReorder, type DragProps } from "./useReorder";
import {
  CardList, EmptyState, Loading, LoadError, Money, PageHeader,
} from "./components/ui";
import { ErrorText } from "../shop/components/ErrorText";

export function Products() {
  const { data, error, loading, reload } = useAsync((signal) => fetchAdminProducts(signal));
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /* The live pieces are held here rather than read straight off the fetch,
     because dragging one has to show its new place immediately — before the
     server has agreed to it. `saved` is the last arrangement it did agree to,
     which is where a failed save puts the list back. */
  const [live, setLive] = useState<AdminProduct[]>([]);
  const saved = useRef<AdminProduct[]>([]);
  useEffect(() => {
    const arranged = (data ?? []).filter((p) => !p.archived);
    setLive(arranged);
    saved.current = arranged;
  }, [data]);

  const products = data ?? [];
  const archived = products.filter((p) => p.archived);

  /* Only the live list is arrangeable. Where an archived piece sits means
     nothing — the shop never lists it, and this screen lists it apart. */
  const { rowRef, drag } = useReorder(live, setLive, (next) => void save(next));

  /** Called once a piece has been let go somewhere new, not while it moves. */
  async function save(next: AdminProduct[]) {
    setActionError(null);
    try {
      await reorderProducts(next.map((p) => p.id));
      saved.current = next;
    } catch (err) {
      // Back the way it was, rather than leaving the screen showing an order
      // the shop isn't in.
      setLive(saved.current);
      setActionError(
        `The new order couldn't be saved. ${err instanceof ApiError ? err.message : GENERIC_ERROR}`,
      );
    }
  }

  /** Hide and unhide are the same shape, so they run through the same door. */
  async function setHidden(id: string, hidden: boolean) {
    setBusyId(id);
    setActionError(null);
    try {
      await (hidden ? archiveProduct(id) : restoreProduct(id));
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : GENERIC_ERROR);
    } finally {
      setBusyId(null);
    }
  }

  async function archive(id: string, name: string) {
    // Undoable now, but it still takes the piece out of the shop, so it's
    // worth one confirm rather than a silent surprise.
    if (!confirm(`Hide "${name}" from the shop? You can put it back later.`)) return;
    await setHidden(id, true);
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
        <>
          {live.length > 1 && (
            <p className="mt-0 mb-3 text-[.8125rem] text-fg-muted">
              Drag a piece by its handle to change the order the shop lists them in. The
              arrow keys move one too.
            </p>
          )}
          <CardList>
            {live.map((p, i) => (
              <li key={p.id} ref={rowRef(i)}>
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
                  onHide={() => void archive(p.id, p.name)}
                  drag={drag(i)}
                  dragLabel={dragLabel(p.name, i, live.length)}
                />
              </li>
            ))}
          </CardList>
        </>
      )}

      {archived.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-[.12em] text-fg-muted">
            Hidden from the shop
          </h2>
          <p className="mt-0 mb-3 text-[.8125rem] text-fg-muted">
            These aren't listed in the shop. Unhide one to put it back — it returns at
            the bottom of the list above, ready to be dragged where you want it.
          </p>
          <CardList>
            {archived.map((p) => (
              <li key={p.id} className="opacity-60">
                <Row
                  id={p.id}
                  name={p.name}
                  price={p.price}
                  image={p.image}
                  meta="Hidden"
                  busy={busyId === p.id}
                  onUnhide={() => void setHidden(p.id, false)}
                />
              </li>
            ))}
          </CardList>
        </>
      )}
    </>
  );
}

function Row({
  id, name, price, image, meta, busy, onHide, onUnhide, drag, dragLabel: label,
}: {
  id: string; name: string; price: number; image: string; meta: string;
  busy?: boolean; onHide?: () => void; onUnhide?: () => void;
  drag?: DragProps; dragLabel?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-card border bg-surface p-3 shadow-card
                  ${drag?.active ? "border-selected" : "border-rule"}`}
    >
      {drag && (
        <button type="button" aria-label={label} {...drag.handle} className={DRAG_HANDLE}>
          <span aria-hidden="true" className="text-base leading-none">⠿</span>
        </button>
      )}

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

      {/* The name is in the label because every row's button says the same
          word, and a screen reader reads them out of the row they sit in. */}
      {onHide && (
        <button
          type="button"
          onClick={onHide}
          disabled={busy}
          aria-label={`Hide ${name} from the shop`}
          className={ROW_ACTION}
        >
          {busy ? "Hiding…" : "Hide"}
        </button>
      )}

      {onUnhide && (
        <button
          type="button"
          onClick={onUnhide}
          disabled={busy}
          aria-label={`Unhide ${name} and put it back in the shop`}
          className={ROW_ACTION}
        >
          {busy ? "Unhiding…" : "Unhide"}
        </button>
      )}
    </div>
  );
}

const ROW_ACTION =
  `flex-none cursor-pointer border-0 bg-transparent text-sm text-fg-muted underline
   disabled:cursor-not-allowed disabled:opacity-50`;
