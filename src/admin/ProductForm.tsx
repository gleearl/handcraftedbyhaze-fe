import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { createProduct, fetchAdminProducts, updateProduct } from "../lib/api/admin";
import { ApiError, GENERIC_ERROR } from "../lib/api/http";
import type { ProductInput } from "../lib/api/types";
import { Button } from "../shop/components/Button";
import { ErrorText } from "../shop/components/ErrorText";
import { Field, INPUT, TEXTAREA } from "../shop/components/Field";
import { useAsync } from "./useAsync";
import { Loading, LoadError } from "./components/ui";

const EMPTY: ProductInput = {
  name: "", price: 0, description: "",
  available: true, stock: null, max: null, isNew: false, photo: null,
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
          isNew: existing.isNew,
          photo: null,
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
