import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import {
  createAddon, fetchAdminProducts, fetchLibrary, setAddonProducts, updateAddon,
} from "../lib/api/admin";
import { ApiError, GENERIC_ERROR } from "../lib/api/http";
import type { AddonFormInput, AdminProduct, LibraryAddon } from "../lib/api/types";
import { Button } from "../shop/components/Button";
import { ErrorText } from "../shop/components/ErrorText";
import { Field, INPUT } from "../shop/components/Field";
import { useAsync } from "./useAsync";
import { Loading, LoadError } from "./components/ui";
import { usedLabel } from "./Extras";

const EMPTY: AddonFormInput = {
  name: "", price: null, photo: null, image: "", removePhoto: false,
};

export function ExtraForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const addonId = isNew ? null : Number(id);

  /* Both halves at once: the pieces are needed either way, because ticking them
     is half of what this screen is for. Editing also wants the entry itself,
     which comes out of the library list rather than a by-id endpoint — the list
     is already the shape we need, and it keeps the API one endpoint smaller. */
  const { data, error, loading, reload } = useAsync(
    async (signal) => {
      const [products, library] = await Promise.all([
        fetchAdminProducts(signal),
        isNew ? Promise.resolve<LibraryAddon[]>([]) : fetchLibrary(signal),
      ]);
      return { products, library };
    },
    [id],
  );

  if (loading) return <Loading label={isNew ? "Loading pieces…" : "Loading extra…"} />;
  if (error) return <LoadError message={error} onRetry={reload} />;

  const existing = isNew ? null : data?.library.find((a) => a.id === addonId) ?? null;
  if (!isNew && !existing) {
    return <LoadError message="That extra isn't in the library any more." onRetry={reload} />;
  }

  return (
    <Form
      key={id ?? "new"}
      addonId={existing?.id ?? null}
      initial={
        existing
          ? {
              name: existing.name,
              // 0 is a price the owner set, and the field shows it as blank —
              // free either way, and re-saving keeps it free.
              price: existing.price || null,
              photo: null,
              image: existing.image,
              removePhoto: false,
            }
          : EMPTY
      }
      initialUsedOn={existing?.usedOn ?? []}
      products={data?.products ?? []}
    />
  );
}

function Form({
  addonId, initial, initialUsedOn, products,
}: {
  addonId: number | null;
  initial: AddonFormInput;
  initialUsedOn: string[];
  products: AdminProduct[];
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState<AddonFormInput>(initial);
  const [usedOn, setUsedOn] = useState<string[]>(initialUsedOn);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  /* Starts as the id we were opened with, and is filled in the moment a new
     entry is created. Saving is two calls, and the second one can fail on its
     own — remembering the id the first one returned is what keeps a second
     press of Save from adding the same extra to the library twice. */
  const [savedId, setSavedId] = useState<number | null>(addonId);

  const set = <K extends keyof AddonFormInput>(key: K, value: AddonFormInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /* One object URL at a time, revoked when replaced and on unmount. */
  useEffect(() => {
    if (!form.photo) { setPreview(null); return; }
    const url = URL.createObjectURL(form.photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.photo]);

  /** Blank means free, which is deliberately distinct from a price of nothing. */
  const toPrice = (raw: string): number | null => {
    const s = raw.trim();
    if (s === "") return null;
    const n = Math.floor(Number(s));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Give the extra a name.";
    if (form.price !== null && (!Number.isFinite(form.price) || form.price < 0)) {
      errors.price = "Enter what it adds in pesos, or leave it blank for free.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const toggle = (productId: string, on: boolean) =>
    setUsedOn((ids) => (on ? [...ids.filter((i) => i !== productId), productId] : ids.filter((i) => i !== productId)));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      /* Two calls, in this order. Nothing can be ticked onto an extra that
         doesn't exist yet, so on the create path the ticks go up against the id
         the save just handed back rather than one we chose. */
      const entry = savedId ? await updateAddon(savedId, form) : await createAddon(form);
      setSavedId(entry.id);
      await setAddonProducts(entry.id, usedOn);
      navigate("/admin/extras", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const mapped: Record<string, string> = {};
        for (const [key, message] of Object.entries(err.fieldErrors)) {
          /* Laravel names them snake_case, and a refused tick arrives either as
             `products` or as `products.3` for the one piece at fault. Both
             belong on the Used-on list, which shows one message — the first,
             because a later one would overwrite the piece actually named. */
          const field = key === "remove_photo" ? "removePhoto"
            : key === "products" || key.startsWith("products.") ? "products"
            : key;
          if (!(field in mapped)) mapped[field] = message;
        }
        setFieldErrors(mapped);
      } else {
        setFormError(err instanceof ApiError ? err.message : GENERIC_ERROR);
      }
    } finally {
      setSaving(false);
    }
  }

  const shownImage = preview ?? (form.removePhoto ? "" : form.image);

  /* Hiding a piece has never taken its extras away, so a hidden one still gets
     a tick — it just sits apart, where it can't be mistaken for a live piece. */
  const live = products.filter((p) => !p.archived);
  const archived = products.filter((p) => p.archived);

  return (
    <>
      <h1 className="mb-5 font-display text-2xl font-semibold leading-[1.3]">
        {addonId ? "Edit extra" : "Add an extra"}
      </h1>

      <form onSubmit={onSubmit} noValidate>
        <Field label="Name" htmlFor="x-name" error={fieldErrors.name}>
          <input
            type="text" id="x-name" value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className={`${INPUT} ${fieldErrors.name ? "border-danger" : ""}`}
          />
        </Field>

        <Field label="Adds (₱)" htmlFor="x-price" optional error={fieldErrors.price}
               hint="Changing this changes it on every piece that offers it. Blank means free.">
          <input
            type="number" id="x-price" inputMode="numeric" min={0} step={1}
            placeholder="Free"
            value={form.price ?? ""}
            onChange={(e) => set("price", toPrice(e.target.value))}
            className={`${INPUT} ${fieldErrors.price ? "border-danger" : ""}`}
          />
        </Field>

        <Field label="Photo" htmlFor="x-photo" optional error={fieldErrors.photo}
               hint="A little one, shown beside the name in the picker.">
          <div className="flex items-center gap-3">
            {shownImage && (
              <img src={shownImage} alt=""
                   className="size-20 flex-none rounded-sm bg-surface-brand-soft object-cover" />
            )}
            <input
              type="file" id="x-photo" accept="image/*"
              onChange={(e) => set("photo", e.target.files?.[0] ?? null)}
              className="min-w-0 flex-1 text-sm"
            />
            {shownImage && !form.photo && (
              <button
                type="button"
                onClick={() => set("removePhoto", true)}
                className="shrink-0 cursor-pointer border-0 bg-transparent text-xs text-fg-muted underline"
              >
                Remove
              </button>
            )}
          </div>
        </Field>

        <fieldset className="mt-1 mb-5 border-0 p-0">
          <legend className="mb-1 font-display text-[1.0625rem] font-semibold">Used on</legend>
          <p className="mt-0 mb-3 text-[.8125rem] text-fg-muted">
            Tick every piece this can be ordered with. A newly ticked one offers it
            after the extras it already has, so nothing you arranged on a piece moves.
          </p>

          {/* The server refuses a piece already offering all twenty and names it, so
              this is the message rather than a generic one. */}
          <ErrorText>{fieldErrors.products}</ErrorText>

          <div className="mt-1.5 grid gap-2">
            {live.map((p) => (
              <Tick
                key={p.id} id={`x-on-${p.id}`} label={p.name}
                checked={usedOn.includes(p.id)}
                onChange={(on) => toggle(p.id, on)}
              />
            ))}
          </div>

          {archived.length > 0 && (
            <>
              <h2 className="mt-5 mb-1.5 text-xs font-semibold uppercase tracking-[.12em] text-fg-muted">
                Hidden from the shop
              </h2>
              <p className="mt-0 mb-2 text-[.8125rem] text-fg-muted">
                These aren't listed in the shop, and hiding one never took its extras
                away. Untick it here and it loses this one for good.
              </p>
              <div className="grid gap-2">
                {archived.map((p) => (
                  <Tick
                    key={p.id} id={`x-on-${p.id}`} label={p.name} sub="Hidden"
                    checked={usedOn.includes(p.id)}
                    onChange={(on) => toggle(p.id, on)}
                  />
                ))}
              </div>
            </>
          )}

          <p className="mt-2.5 mb-0 text-[.8125rem] text-fg-muted">
            This extra is {usedLabel(usedOn.length)}.
          </p>
        </fieldset>

        <ErrorText>{formError}</ErrorText>

        <div className="mt-2 flex gap-2.5">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : addonId ? "Save changes" : "Add extra"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/admin/extras")}>
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}

function Tick({
  id, label, sub, checked, onChange,
}: {
  id: string; label: string; sub?: string; checked: boolean; onChange: (on: boolean) => void;
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
