import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "../../lib/api/types";
import { peso } from "../../lib/format";

interface Props {
  product: Product;
  /** Slots already on the line being edited; empty when adding a new one. */
  chosen: number[];
  /** True when changing a line already in the order rather than adding one. */
  editing: boolean;
  onConfirm: (extras: number[]) => void;
  onClose: () => void;
}

/* A native <dialog>, which brings the backdrop, Esc to close, the focus trap
   and an inert page behind it — all the parts of a modal that are tedious to
   get right by hand.

   It's a sheet on a phone, where the thumb is at the bottom of the screen, and
   a centred panel from 640px up where there's no thumb to reach with. */
export function AddonPicker({ product: p, chosen, editing, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState<number[]>(chosen);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }, []);

  /* Esc and a tap on the scrim both close the dialog without going through our
     buttons, so the state that opened it has to be told either way. */
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const close = () => onClose();
    dialog.addEventListener("close", close);
    return () => dialog.removeEventListener("close", close);
  }, [onClose]);

  const unit = useMemo(
    () => p.price + picked.reduce(
      (n, slot) => n + (p.addons.find((a) => a.slot === slot)?.price ?? 0), 0,
    ),
    [p, picked],
  );

  /* "No add-on" is a row rather than an unticked-everything state, because an
     empty set is something you have to infer and a labelled choice is something
     you can just pick. It's exclusive with the rest: ticking an extra clears
     it, clearing the last extra brings it back, and it can't be turned off on
     its own — there's no such thing as choosing neither. */
  const toggle = (slot: number) =>
    setPicked((prev) => prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]);

  return (
    <dialog
      ref={ref}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      aria-labelledby="addon-title"
      /* inset does the sizing, so the dialog is the whole viewport and the
         panel inside it is what's actually the sheet. */
      className="fixed inset-0 m-0 h-auto max-h-none w-auto max-w-none justify-center
                 overflow-hidden border-0 bg-transparent p-0 text-fg
                 open:flex items-end sm:items-center
                 backdrop:bg-moss-950/45 backdrop:backdrop-blur-[3px]"
    >
      <div
        className="flex max-h-full w-full max-w-[480px] animate-sheet flex-col rounded-t-card
                   bg-surface px-5 pt-2 pb-[calc(--spacing(5)+env(safe-area-inset-bottom))]
                   shadow-card-lg
                   sm:max-h-[calc(100%-3rem)] sm:rounded-card sm:p-5"
      >
        {/* Something to pull, on the edge a thumb reaches for. Nothing to grab
            once it's a centred panel, so it goes. */}
        <span aria-hidden="true"
              className="mx-auto mb-3.5 h-1 w-9 flex-none rounded-full bg-rule sm:hidden" />

        <header className="mb-3.5 flex flex-none items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="addon-title"
                className="m-0 font-display text-[1.125rem] font-semibold leading-[1.25]">
              {p.name}
            </h2>
            {/* Says the quiet part out loud: nothing here has to be ticked. */}
            <p className="mt-1 mb-0 text-sm text-fg-muted">
              Customize your charm
              <span className="ml-1.5 inline-block rounded-full bg-surface-subtle px-2 py-px
                               text-[.6875rem] font-semibold tracking-[.02em] text-fg-secondary">
                optional
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label={editing ? "Close without changing" : "Close without adding"}
            className="-mt-1.5 -mr-2 grid size-10 flex-none cursor-pointer place-items-center
                       rounded-full text-2xl leading-none text-fg-muted active:bg-surface-subtle"
          >
            ×
          </button>
        </header>

        <div className="grid min-h-0 gap-2.5 overflow-y-auto overscroll-contain">
          <Row
            label="No add-on"
            checked={picked.length === 0}
            /* Ticking it clears the extras; unticking it on its own would leave
               nothing chosen, so it simply stays ticked. */
            onChange={() => setPicked([])}
            autoFocus
            quiet
          />
          {p.addons.map((a) => (
            <Row
              key={a.slot}
              label={a.name}
              image={a.image}
              price={a.price}
              checked={picked.includes(a.slot)}
              onChange={() => toggle(a.slot)}
            />
          ))}
        </div>

        {/* The running price for one piece, so nobody meets the total for the
            first time on the payment screen. With nothing ticked it reads as
            the piece's own price, which is what makes the extras optional
            without a second button saying so. */}
        <div className="mt-4.5 flex flex-none">
          <button
            type="button"
            onClick={() => onConfirm([...picked].sort((a, b) => a - b))}
            className="flex min-h-[52px] flex-1 cursor-pointer items-center justify-center
                       rounded-full border border-action bg-action px-5 font-semibold
                       text-on-action focus-visible:outline-moss-950"
          >
            {editing ? "Save" : "Add"} · {peso(unit)}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function Row({
  label, image, price, checked, onChange, autoFocus, quiet,
}: {
  label: string; image?: string; price?: number; checked: boolean;
  onChange: () => void; autoFocus?: boolean;
  /** The "No add-on" row: set apart, because it answers a different question. */
  quiet?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-sm border bg-surface px-3.5 py-3
                  has-checked:border-selected has-checked:bg-surface-brand-soft
                  ${checked ? "border-selected bg-surface-brand-soft" : "border-field"}
                  ${quiet ? "mb-1" : ""}`}
    >
      {/* A drawn checkbox rather than the platform's. `accent-color` only
          repaints the fill — the box keeps whatever shape and weight the OS
          feels like, which is a hard square on Windows, a soft one on macOS,
          and something else again on Android.

          The input still is the input — appearance-none takes the paint off,
          not the semantics — so it stays focusable, tabbable and a checkbox to
          a screen reader, and the wrapping <label> keeps the row tappable. */}
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        autoFocus={autoFocus}
        className="size-[22px] flex-none cursor-pointer appearance-none rounded-[7px]
                   border-[1.5px] border-field bg-surface bg-center bg-no-repeat
                   transition-[background-color,border-color] duration-150
                   checked:border-action checked:bg-action
                   checked:bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27none%27%20stroke=%27%23ffffff%27%20stroke-width=%272.5%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M3.5%208.5l3%203%206-6%27/%3E%3C/svg%3E')]
                   checked:bg-[length:15px_15px]
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      />
      {image && (
        <img src={image} alt="" width={40} height={40} loading="lazy"
             className="size-10 flex-none rounded-[8px] bg-surface-brand-soft object-cover" />
      )}
      <span className={`min-w-0 flex-1 text-[.9375rem] font-semibold leading-[1.3]
                        ${quiet ? "text-fg-secondary" : ""}`}>
        {label}
      </span>
      {typeof price === "number" && (
        <span className="flex-none text-sm font-semibold tabular-nums text-fg-brand">
          {price > 0 ? "+" + peso(price) : "Free"}
        </span>
      )}
    </label>
  );
}
