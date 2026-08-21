import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  createProduct, fetchAdminProducts, fetchLibrary, updateProduct,
} from "../lib/api/admin";
import { ApiError, GENERIC_ERROR } from "../lib/api/http";
import { MAX_ADDONS, type AdminProduct, type LibraryAddon, type ProductInput } from "../lib/api/types";
import { peso } from "../lib/format";
import { Button } from "../shop/components/Button";
import { ErrorText } from "../shop/components/ErrorText";
import { Field, INPUT, TEXTAREA } from "../shop/components/Field";
import { useAsync } from "./useAsync";
import { Loading, LoadError, Money, Tick } from "./components/ui";
import { DRAG_HANDLE, dragLabel, useReorder, type DragProps } from "./useReorder";

const EMPTY: ProductInput = {
  name: "", price: 0, description: "",
  available: true, stock: null, max: null, freeAddons: 0, isNew: false, photo: null,
  addons: [],
};

export function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";

  /* Both halves at once. The library is wanted on either path now — ticking
     from it is the only way a piece gets an extra — and editing also wants the
     piece itself, which comes out of the list rather than a by-id endpoint:
     the list is already the shape we need, and it keeps the API surface one
     endpoint smaller.

     A library that won't load stops an edit outright, because the form would
     otherwise draw an existing piece as offering nothing while still holding
     the ids it offers — and saving that would take every extra off it. Adding
     is different: a new piece has no extras to misdraw and they're optional
     anyway, so null means "couldn't load" and the fieldset says so on its own
     rather than standing between the owner and a piece they can still make. */
  const { data, error, loading, reload } = useAsync(
    async (signal) => {
      const [products, library] = await Promise.all([
        isNew ? Promise.resolve<AdminProduct[]>([]) : fetchAdminProducts(signal),
        isNew ? fetchLibrary(signal).catch(() => null) : fetchLibrary(signal),
      ]);
      return { products, library };
    },
    [id],
  );

  if (loading) return <Loading label={isNew ? "Loading extras…" : "Loading piece…"} />;
  if (error) return <LoadError message={error} onRetry={reload} />;

  const existing = isNew ? null : data?.products.find((p) => p.id === id) ?? null;
  if (!isNew && !existing) {
    return <LoadError message="That piece doesn't exist any more." onRetry={reload} />;
  }

  return <Form key={id ?? "new"} productId={existing?.id ?? null}
    initialLibrary={data?.library ?? null}
    initial={
      existing
        ? {
            name: existing.name,
            price: existing.price,
            description: existing.description,
            available: existing.available,
            stock: existing.stock ?? null,
            max: existing.max ?? null,
            freeAddons: existing.freeAddons,
            isNew: existing.isNew,
            photo: null,
            /* Just the ids, in the order the API sent them — which is the order
               the owner arranged. Everything else about an extra is read back
               out of the library, so there is nothing here to fall stale. */
            addons: existing.addons.map((a) => a.id),
          }
        : EMPTY
    } currentImage={existing?.image ?? ""} />;
}

function Form({
  productId, initial, currentImage, initialLibrary,
}: {
  productId: string | null;
  initial: ProductInput;
  currentImage: string;
  /** null on the add path when the library wouldn't load. */
  initialLibrary: LibraryAddon[] | null;
}) {
  const navigate = useNavigate();

  /* Held here rather than read straight off the prop, so the fieldset can
     retry a library that didn't load. Going back through the page-level reload
     would unmount this form while it refetched and throw away everything
     already typed into it, which is the thing not blocking the add path was
     for in the first place. */
  const [library, setLibrary] = useState(initialLibrary);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [form, setForm] = useState<ProductInput>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /* One object URL at a time, revoked when replaced and on unmount. */
  useEffect(() => {
    if (!form.photo) { setPreview(null); return; }
    const url = URL.createObjectURL(form.photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.photo]);

  /** Blank means "not tracking it", which is not the same as zero. */
  const toCount = (raw: string): number | null => {
    const s = raw.trim();
    if (s === "") return null;
    const n = Math.floor(Number(s));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Give the piece a name.";
    if (!Number.isFinite(form.price) || form.price < 0) {
      errors.price = "Enter the price in pesos, whole numbers.";
    }
    if (!productId && !form.photo) errors.photo = "Add a photo so it has something to show.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      if (productId) await updateProduct(productId, form);
      else await createProduct(form);
      navigate("/admin/products", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.fieldErrors)) {
          /* Laravel names them snake_case, and a refused extra arrives either
             as `addons` or as `addons.3` for the one at fault. Both belong on
             the picker, which shows one message — the first, because a later
             one would overwrite the extra actually named. */
          const field = k === "is_new" ? "isNew"
            : k === "addons" || k.startsWith("addons.") ? "addons"
            : k;
          if (!(field in mapped)) mapped[field] = v;
        }
        setFieldErrors(mapped);
      } else {
        setFormError(err instanceof ApiError ? err.message : GENERIC_ERROR);
      }
    } finally {
      setSaving(false);
    }
  }

  /* Failure leaves it null, which is what the notice is already saying — there
     is no second, louder way to say the same thing that would help. */
  async function retryLibrary() {
    setLoadingLibrary(true);
    try {
      setLibrary(await fetchLibrary());
    } catch {
      setLibrary(null);
    } finally {
      setLoadingLibrary(false);
    }
  }

  const shownImage = preview ?? currentImage;

  return (
    <>
      <h1 className="mb-5 font-display text-2xl font-semibold leading-[1.3]">
        {productId ? "Edit piece" : "Add a piece"}
      </h1>

      <form onSubmit={onSubmit} noValidate>
        <Field label="Name" htmlFor="p-name" error={fieldErrors.name}>
          <input
            type="text" id="p-name" value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className={`${INPUT} ${fieldErrors.name ? "border-danger" : ""}`}
          />
        </Field>

        <Field label="Price (₱)" htmlFor="p-price" error={fieldErrors.price}>
          <input
            type="number" id="p-price" inputMode="numeric" min={0} step={1}
            value={Number.isFinite(form.price) ? form.price : ""}
            onChange={(e) => set("price", Math.floor(Number(e.target.value)))}
            className={`${INPUT} ${fieldErrors.price ? "border-danger" : ""}`}
          />
        </Field>

        <Field label="Description" htmlFor="p-desc" optional
               hint="Two lines show on the card; longer text is trimmed.">
          <textarea
            id="p-desc" rows={3} value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className={TEXTAREA}
          />
        </Field>

        <Field label="Stock" htmlFor="p-stock" optional
               hint={'Leave blank if you\'re not counting. "Only N left" shows at 3 or fewer; 0 marks it sold out.'}>
          <input
            type="number" id="p-stock" inputMode="numeric" min={0} step={1}
            value={form.stock ?? ""}
            onChange={(e) => set("stock", toCount(e.target.value))}
            className={INPUT}
          />
        </Field>

        <Field label="Max per order" htmlFor="p-max" optional
               hint="The most one customer can order in a single go.">
          <input
            type="number" id="p-max" inputMode="numeric" min={0} step={1}
            value={form.max ?? ""}
            onChange={(e) => set("max", toCount(e.target.value))}
            className={INPUT}
          />
        </Field>

        <div className="mb-5 grid gap-2.5">
          <Toggle
            id="p-available" label="Available to order"
            sub="Off keeps it listed but marked Sold out."
            checked={form.available}
            onChange={(v) => set("available", v)}
          />
          <Toggle
            id="p-new" label={'Show the "New" badge'}
            sub="Nothing expires it for you — clear it when the piece isn't new any more."
            checked={form.isNew}
            onChange={(v) => set("isNew", v)}
          />
        </div>

        <Field label="Photo" htmlFor="p-photo" error={fieldErrors.photo}
               hint="Square photos look best — they're shown at 112×112.">
          <div className="flex items-center gap-3">
            {shownImage && (
              <img src={shownImage} alt=""
                   className="size-20 flex-none rounded-sm bg-surface-brand-soft object-cover" />
            )}
            <input
              type="file" id="p-photo" accept="image/*"
              onChange={(e) => set("photo", e.target.files?.[0] ?? null)}
              className="min-w-0 flex-1 text-sm"
            />
          </div>
        </Field>

        <fieldset className="mt-1 mb-5 border-0 p-0">
          <legend className="mb-1 font-display text-[1.0625rem] font-semibold">Extras</legend>
          <p className="mt-0 mb-3 text-[.8125rem] text-fg-muted">
            Up to twenty things this piece can be ordered with — a flower, a gift box. Give it
            any and its <b>+</b> becomes an <b>Add</b> button that asks first. Extras are shared:
            editing one on the <b>Extras</b> screen changes it on every piece that offers it.
            Dragging a row by its handle changes the order the picker lists them in.
          </p>

          <Field label="Free extras" htmlFor="p-free-addons" optional
                 hint="How many are included before the rest are charged. The dearest ones
                       are the ones waived, so someone picking three pays for the cheapest.
                       Blank charges for all of them.">
            <input
              type="number" id="p-free-addons" inputMode="numeric" min={0} max={MAX_ADDONS}
              step={1}
              value={form.freeAddons || ""}
              onChange={(e) => set("freeAddons", toCount(e.target.value) ?? 0)}
              className={INPUT}
            />
          </Field>

          {library === null ? (
            /* Inside the fieldset, not over the whole form: the extras are the
               only part of this screen the library is needed for, and a piece
               with none is a piece that saves perfectly well. */
            <p role="status"
               className="mt-0 mb-0 rounded-sm border border-rule bg-surface-subtle
                          px-3 py-2.5 text-[.8125rem] text-fg-muted">
              The list of extras couldn't be loaded, so there's nothing to tick here.
              You can add the piece anyway and give it extras afterwards.{" "}
              <button
                type="button"
                onClick={() => void retryLibrary()}
                disabled={loadingLibrary}
                className="cursor-pointer border-0 bg-transparent p-0 font-semibold
                           text-fg-brand underline disabled:cursor-not-allowed
                           disabled:opacity-50"
              >
                {loadingLibrary ? "Trying…" : "Try again"}
              </button>
            </p>
          ) : (
            <>
              {/* The server refuses a twenty-first extra and names it, so this
                  is the message rather than a generic one. */}
              <ErrorText>{fieldErrors.addons}</ErrorText>

              <AddonRows
                chosen={form.addons}
                library={library}
                onChange={(ids) => set("addons", ids)}
              />

              <p className="mt-2.5 mb-0 text-[.8125rem] text-fg-muted">
                {form.addons.length === MAX_ADDONS
                  ? `All ${MAX_ADDONS} extras are in use.`
                  : `${form.addons.length} of ${MAX_ADDONS}`}
              </p>
            </>
          )}
        </fieldset>

        <ErrorText>{formError}</ErrorText>

        <div className="mt-2 flex gap-2.5">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : productId ? "Save changes" : "Add piece"}
          </Button>
          <Button type="button" variant="ghost"
                  onClick={() => navigate("/admin/products")}>
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}

/* The extras this piece offers, and the rest of the library underneath.
   Nothing here edits an extra: the name, the price and the photo belong to the
   library and are shared, so this screen only chooses which ones and in what
   order. Editing one is a link away, and says out loud that it changes
   everywhere. */
function AddonRows({
  chosen, library, onChange,
}: {
  chosen: number[];
  library: LibraryAddon[];
  onChange: (ids: number[]) => void;
}) {
  /* Reordering the ids themselves, not the entries they name: the ids are what
     gets saved, and the arrangement is the whole of what this drag changes. */
  const { rowRef, drag } = useReorder(chosen, onChange);

  const byId = new Map(library.map((entry) => [entry.id, entry]));
  const rest = library.filter((entry) => !chosen.includes(entry.id));

  return (
    <>
      {chosen.length > 0 && (
        <div className="grid gap-2">
          {chosen.map((id, index) => {
            const entry = byId.get(id);
            /* Offered by the piece but gone from the library — someone deleted
               it on the Extras screen while this form sat open. There is no
               name or price to draw a row with, and it keeps its place in the
               list so the index every other row drags on stays right. */
            if (!entry) return null;

            return (
              <AddonRow
                /* Keyed by the library id: dragging changes a row's index, and
                   keying on that would remount the row mid-drag and drop focus. */
                key={id}
                entry={entry}
                index={index}
                count={chosen.length}
                rowRef={rowRef(index)}
                drag={drag(index)}
                onRemove={() => onChange(chosen.filter((n) => n !== id))}
              />
            );
          })}
        </div>
      )}

      {chosen.length < MAX_ADDONS && (
        <div className="mt-3">
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="m-0 text-xs font-semibold uppercase tracking-[.12em] text-fg-muted">
              {chosen.length ? "Also in the library" : "In the library"}
            </h3>
            {/* Here rather than only on the Extras screen: needing one the
                library hasn't got is something you find out while filling this
                in, and sending the owner off to hunt for the other screen is
                how a piece gets saved without the extra it wanted. */}
            <Link to="/admin/extras/new"
                  className="text-[.8125rem] font-semibold text-fg-brand no-underline">
              New extra
            </Link>
          </div>

          {rest.length === 0 ? (
            <p className="m-0 text-[.8125rem] text-fg-muted">
              {library.length === 0
                ? "Nothing in the library yet — add one and every piece can offer it."
                : "This piece offers everything in the library."}
            </p>
          ) : (
            <div className="grid gap-2">
              {rest.map((entry) => (
                <Tick
                  key={entry.id} id={`p-addon-${entry.id}`} label={entry.name}
                  // A free extra says so in words — "₱0" reads like a price nobody set.
                  sub={entry.price === 0 ? "Free" : peso(entry.price)}
                  /* Never ticked: ticking one moves it up into the arranged
                     list above, which is where it can be dragged and where the
                     × takes it off again. Two ticked states for the same extra
                     would be two answers to one question. */
                  checked={false}
                  onChange={() => onChange([...chosen, entry.id])}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* One extra this piece offers. The number on it is where it sits in the
   customer's picker, which is the only thing about it this screen decides. */
function AddonRow({
  entry, index, count, rowRef, drag, onRemove,
}: {
  entry: LibraryAddon;
  index: number;
  count: number;
  rowRef: (el: HTMLDivElement | null) => void;
  drag: DragProps;
  onRemove: () => void;
}) {
  return (
    <div
      ref={rowRef}
      className={`flex items-center gap-2 rounded-sm border bg-surface p-2
                  ${drag.active ? "border-selected shadow-card" : "border-rule"}`}
    >
      <button
        type="button"
        aria-label={dragLabel(entry.name, index, count)}
        {...drag.handle}
        className={DRAG_HANDLE}
      >
        <span aria-hidden="true" className="text-base leading-none">⠿</span>
      </button>

      {entry.image
        ? <img src={entry.image} alt=""
               className="size-10 flex-none rounded-xs bg-surface-brand-soft object-cover" />
        : <div className="size-10 flex-none rounded-xs bg-surface-brand-soft" />}

      <div className="min-w-0 flex-1">
        <p className="m-0 truncate font-semibold">{entry.name}</p>
        <p className="m-0 truncate text-[.8125rem] text-fg-muted">
          {entry.price === 0 ? "Free" : <Money amount={entry.price} />}
        </p>
      </div>

      {/* "Take off", not "delete": the extra stays in the library and on every
          other piece offering it, and the label is the only place that
          difference can be said before the press rather than after. */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Take ${entry.name} off this piece`}
        className="grid size-9 flex-none cursor-pointer place-items-center rounded-xs
                   text-lg leading-none text-fg-muted hover:bg-surface
                   focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-focus-ring"
      >
        ×
      </button>
    </div>
  );
}

function Toggle({
  id, label, sub, checked, onChange,
}: { id: string; label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id}
           className="flex cursor-pointer items-start gap-3 rounded-sm border border-field
                      bg-surface px-4 py-3.5 has-checked:border-selected has-checked:bg-surface-brand-soft">
      <input
        type="checkbox" id={id} checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-[22px] flex-none accent-moss-600"
      />
      <span className="flex flex-col">
        <span className="font-semibold">{label}</span>
        <span className="text-[.8125rem] text-fg-muted">{sub}</span>
      </span>
    </label>
  );
}
