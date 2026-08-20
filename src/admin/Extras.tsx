import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { deleteAddon, fetchLibrary } from "../lib/api/admin";
import { ApiError, GENERIC_ERROR } from "../lib/api/http";
import type { LibraryAddon } from "../lib/api/types";
import { useAsync } from "./useAsync";
import {
  CardList, EmptyState, Loading, LoadError, Money, PageHeader,
} from "./components/ui";
import { ErrorText } from "../shop/components/ErrorText";

/** "on 2 pieces" reads better than "0 pieces" ever does. */
export const usedLabel = (n: number): string =>
  n === 0 ? "not on anything yet" : `on ${n} ${n === 1 ? "piece" : "pieces"}`;

/* The library, which is not draggable on purpose. Where an entry sits here is
   invisible to a customer — the order that matters is the one inside a piece's
   picker, and that is arranged on the piece. The server sorts these by name. */
export function Extras() {
  const { data, error, loading, reload } = useAsync((signal) => fetchLibrary(signal));
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  /* Which row is asking, rather than a boolean: opening one confirmation has
     to close any other, or two rows sit there both offering to delete. */
  const [asking, setAsking] = useState<number | null>(null);

  const entries = data ?? [];

  async function remove(entry: LibraryAddon) {
    setBusyId(entry.id);
    setActionError(null);
    try {
      await deleteAddon(entry.id);
      setAsking(null);
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
        title="Extras"
        action={
          <Link
            to="/admin/extras/new"
            className="rounded-full bg-action px-5 py-2.5 text-sm font-semibold
                       text-on-action no-underline"
          >
            Add an extra
          </Link>
        }
      />

      {loading && <Loading label="Loading extras…" />}
      {error && !loading && <LoadError message={error} onRetry={reload} />}
      <ErrorText>{actionError}</ErrorText>

      {!loading && !error && entries.length === 0 && (
        <EmptyState>
          No extras yet. Add one here and you can put it on as many pieces as you like.
        </EmptyState>
      )}

      {entries.length > 0 && (
        <>
          <p className="mt-0 mb-3 text-[.8125rem] text-fg-muted">
            One extra, offered by any number of pieces. Editing it here changes it
            everywhere it's offered.
          </p>
          <CardList>
            {entries.map((entry) => (
              <li key={entry.id}>
                <Row
                  entry={entry}
                  busy={busyId === entry.id}
                  asking={asking === entry.id}
                  onAsk={() => { setActionError(null); setAsking(entry.id); }}
                  onKeep={() => setAsking(null)}
                  onDelete={() => void remove(entry)}
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
  entry, busy, asking, onAsk, onKeep, onDelete,
}: {
  entry: LibraryAddon;
  busy: boolean;
  asking: boolean;
  onAsk: () => void;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const count = entry.usedOn.length;
  const keepRef = useRef<HTMLButtonElement>(null);

  /* Asking inline costs what window.confirm gave away for free. Pressing Delete
     unmounts the button that was pressed, so without this the keyboard lands on
     <body> and the owner loses their place in the middle of the decision. It
     goes to "Keep it" rather than to the delete: the safe answer is the one that
     should be under the finger. */
  useEffect(() => { if (asking) keepRef.current?.focus(); }, [asking]);

  return (
    <div
      className={`flex items-center gap-3 rounded-card border bg-surface p-3 shadow-card
                  ${asking ? "border-danger" : "border-rule"}`}
    >
      {entry.image
        ? <img src={entry.image} alt="" className="size-14 flex-none rounded-sm bg-surface-brand-soft object-cover" />
        : <div className="size-14 flex-none rounded-sm bg-surface-brand-soft" />}

      <div className="min-w-0 flex-1">
        <p className="m-0 truncate font-display font-semibold">{entry.name}</p>

        {asking ? (
          /* Named, because deleting takes the extra off every piece at once — a
             count is the one thing that makes that consequence visible before
             it happens. It stands in for the usual line rather than sitting
             under it: the price is not what the owner is deciding about. */
          <p role="alert" className="m-0 text-[.8125rem] text-fg-muted">
            Delete {entry.name}? It's {usedLabel(count)}.{" "}
            {count > 0
              ? `This removes it from ${count === 1 ? "it" : "them"}.`
              : "Nothing else changes."}
          </p>
        ) : (
          <p className="m-0 truncate text-[.8125rem] text-fg-muted">
            {/* A free extra says so in words — "₱0" reads like a price nobody set. */}
            {entry.price === 0 ? "Free" : <Money amount={entry.price} />} · {usedLabel(count)}
          </p>
        )}
      </div>

      {asking ? (
        <>
          <button type="button" onClick={onDelete} disabled={busy} className={ROW_DANGER}>
            {busy ? "Deleting…" : "Delete everywhere"}
          </button>
          <button
            type="button" ref={keepRef} onClick={onKeep} disabled={busy}
            className={ROW_ACTION}
          >
            Keep it
          </button>
        </>
      ) : (
        <>
          <Link
            to={`/admin/extras/${entry.id}`}
            className="flex-none text-sm font-semibold text-fg-brand no-underline"
          >
            Edit
          </Link>

          {/* The name is in the label because every row's button says the same
              word, and a screen reader reads them out of the row they sit in. */}
          <button
            type="button"
            onClick={onAsk}
            aria-label={`Delete ${entry.name}`}
            className={ROW_ACTION}
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}

const ROW_ACTION =
  `flex-none cursor-pointer border-0 bg-transparent text-sm text-fg-muted underline
   disabled:cursor-not-allowed disabled:opacity-50`;

const ROW_DANGER =
  `flex-none cursor-pointer border-0 bg-transparent text-sm font-semibold text-danger underline
   disabled:cursor-not-allowed disabled:opacity-50`;
