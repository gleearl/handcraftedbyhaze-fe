import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { createProduct, fetchAdminProducts, updateProduct } from "../lib/api/admin";
import { ApiError, GENERIC_ERROR } from "../lib/api/http";
import { MAX_ADDONS, type AddonInput, type Product, type ProductInput } from "../lib/api/types";
import { Button } from "../shop/components/Button";
import { ErrorText } from "../shop/components/ErrorText";
import { Field, INPUT, TEXTAREA } from "../shop/components/Field";
import { useAsync } from "./useAsync";
import { Loading, LoadError } from "./components/ui";
import { DRAG_HANDLE, dragLabel, useReorder, type DragProps } from "./useReorder";

const emptyAddon = (slot: number): AddonInput => ({
  slot, name: "", price: null, photo: null, image: "", removePhoto: false,
});

/* One row per extra the piece actually has, in the order the API sent them —
   which is the order the owner arranged. No blank placeholders: a row carries
   its own slot now, so nothing has to hold a place in the list to keep its
   number. */
function addonsOf(product: Product | null): AddonInput[] {
  return (product?.addons ?? [])
    .filter((a) => a.slot >= 0 && a.slot < MAX_ADDONS)
    .map((a) => ({
      slot: a.slot, name: a.name, price: a.price,
      photo: null, image: a.image, removePhoto: false,
    }));
}

/* The lowest number nobody is using. Reusing a freed slot is safe — the extra
   that had it is gone from the catalogue, so a basket still holding it drops
   it on the next read rather than picking up the newcomer's name. */
function freeSlot(rows: AddonInput[]): number {
  const taken = new Set(rows.map((r) => r.slot));
  for (let n = 0; n < MAX_ADDONS; n++) if (!taken.has(n)) return n;
  return -1;
}

const EMPTY: ProductInput = {
  name: "", price: 0, description: "",
  available: true, stock: null, max: null, freeAddons: 0, isNew: false, photo: null,
  addons: addonsOf(null),
};

export function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";

  /* Editing loads the list rather than a by-id endpoint: the list is already
     the shape we need, and it keeps the API surface one endpoint smaller. */
  const { data, error, loading, reload } = useAsync(
    async (signal) => (isNew ? null : await fetchAdminProducts(signal)), [id],
  );

  if (!isNew && loading) return <Loading label="Loading piece…" />;
  if (!isNew && error) return <LoadError message={error} onRetry={reload} />;

  const existing = isNew ? null : data?.find((p) => p.id === id) ?? null;
  if (!isNew && !existing) {
    return <LoadError message="That piece doesn't exist any more." onRetry={reload} />;
  }

  return <Form key={id ?? "new"} productId={existing?.id ?? null} initial={
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
          addons: addonsOf(existing),
        }
      : EMPTY
  } currentImage={existing?.image ?? ""} />;
}

function Form({
  productId, initial, currentImage,
}: { productId: string | null; initial: ProductInput; currentImage: string }) {
  const navigate = useNavigate();
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
        // Laravel names them snake_case; the form knows them camelCase.
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.fieldErrors)) {
          mapped[k === "is_new" ? "isNew" : k] = v;
        }
        setFieldErrors(mapped);
      } else {
        setFormError(err instanceof ApiError ? err.message : GENERIC_ERROR);
      }
    } finally {
      setSaving(false);
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
            Up to ten things this piece can be ordered with — a flower, a gift box. Give it
            any and its <b>+</b> becomes an <b>Add</b> button that asks first. A blank price
            means free, and dragging a row by its handle changes the order the picker
            lists them in.
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

          <AddonRows
            rows={form.addons}
            errors={fieldErrors}
            onChange={(rows) => set("addons", rows)}
          />

          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            {form.addons.length < MAX_ADDONS && (
              <Button
                type="button" variant="ghost" size="sm"
                onClick={() => set("addons", [...form.addons, emptyAddon(freeSlot(form.addons))])}
              >
                {form.addons.length ? "Add another extra" : "Add an extra"}
              </Button>
            )}
            <span className="text-[.8125rem] text-fg-muted">
              {form.addons.length === MAX_ADDONS
                ? `All ${MAX_ADDONS} extras are in use.`
                : `${form.addons.length} of ${MAX_ADDONS}`}
            </span>
          </div>
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

/* The list of extras. The dragging itself lives in useReorder, which the
   products list uses too — what's local here is only that a moved row is not
   saved until the form is. */
function AddonRows({
  rows, errors, onChange,
}: {
  rows: AddonInput[];
  errors: Record<string, string>;
  onChange: (rows: AddonInput[]) => void;
}) {
  const { rowRef, drag } = useReorder(rows, onChange);

  return (
    <div className="grid gap-2.5">
      {rows.map((addon, i) => (
        <AddonFields
          /* Keyed by slot, not by index: dragging changes a row's index, and
             keying on that would remount the inputs mid-drag and drop focus. */
          key={addon.slot}
          rowRef={rowRef(i)}
          index={i}
          count={rows.length}
          addon={addon}
          drag={drag(i)}
          error={errors[`addons.${i}.name`] ?? errors[`addons.${i}.price`]}
          onChange={(patch) => onChange(rows.map((a, n) => (n === i ? { ...a, ...patch } : a)))}
          onRemove={() => onChange(rows.filter((_, n) => n !== i))}
        />
      ))}
    </div>
  );
}

/* One extra. The number on it is where it sits in the list, not its slot — the
   slot is an identity a customer's open basket depends on, and it would mean
   nothing to the person filling this in. */
function AddonFields({
  index, count, addon, error, rowRef, drag, onChange, onRemove,
}: {
  index: number;
  count: number;
  addon: AddonInput;
  error?: string;
  rowRef: (el: HTMLDivElement | null) => void;
  drag: DragProps;
  onChange: (patch: Partial<AddonInput>) => void;
  onRemove: () => void;
}) {
  const shown = addon.photo ? URL.createObjectURL(addon.photo)
    : addon.removePhoto ? "" : addon.image;
  const named = addon.name.trim() || `Extra ${index + 1}`;

  return (
    <div
      ref={rowRef}
      className={`rounded-sm border bg-surface-brand-soft/40 p-3
                  ${drag.active ? "border-selected shadow-card" : "border-rule"}`}
    >
      <div className="flex flex-wrap items-end gap-2.5">
        <button
          type="button"
          aria-label={dragLabel(named, index, count)}
          {...drag.handle}
          className={`mb-1.5 ${DRAG_HANDLE}`}
        >
          <span aria-hidden="true" className="text-base leading-none">⠿</span>
        </button>

        <label className="min-w-0 flex-1 text-[.8125rem]">
          <span className="mb-1 block text-fg-muted">Extra {index + 1}</span>
          <input
            type="text" value={addon.name} placeholder="Name it"
            onChange={(e) => onChange({ name: e.target.value })}
            className={INPUT}
          />
        </label>
        <label className="w-28 text-[.8125rem]">
          <span className="mb-1 block text-fg-muted">Adds (₱)</span>
          <input
            type="number" inputMode="numeric" min={0} value={addon.price ?? ""}
            placeholder="Free"
            onChange={(e) => {
              const n = Math.floor(Number(e.target.value.trim()));
              onChange({ price: e.target.value.trim() === "" || !Number.isFinite(n) || n < 0 ? null : n });
            }}
            className={INPUT}
          />
        </label>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${named}`}
          className="mb-1.5 grid size-9 flex-none cursor-pointer place-items-center rounded-xs
                     text-lg leading-none text-fg-muted hover:bg-surface
                     focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-focus-ring"
        >
          ×
        </button>
      </div>

      {/* Always here. It used to appear only once the extra had a name, which
          saved a line of markup and cost the one thing the row is for: with
          nothing typed yet there was no file input on screen at all, and no
          way to tell that from a photo field that doesn't work. */}
      <div className="mt-2.5 flex items-center gap-2.5">
        {shown && (
          <img src={shown} alt=""
               className="size-10 flex-none rounded-xs bg-surface object-cover" />
        )}
        {/* Labelled, because a bare file input announces itself as "Choose
            file" and nothing else — on a form with one of these per extra
            that names none of them. */}
        <input
          type="file" accept="image/*"
          aria-label={`Photo for ${named}`}
          onChange={(e) => onChange({ photo: e.target.files?.[0] ?? null, removePhoto: false })}
          className="min-w-0 flex-1 text-xs"
        />
        {shown && !addon.photo && (
          <button
            type="button"
            onClick={() => onChange({ removePhoto: true })}
            className="shrink-0 cursor-pointer text-xs text-fg-muted underline"
          >
            Remove
          </button>
        )}
      </div>

      {error && <ErrorText>{error}</ErrorText>}
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
