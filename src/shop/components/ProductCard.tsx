import { useEffect, useRef } from "react";
import type { Product } from "../../lib/api/types";
import { extrasLabel, hasAddons, limitFor, type CartLine } from "../../lib/cart";
import { peso } from "../../lib/format";

interface Props {
  product: Product;
  /** Every line in the order for this piece — more than one once it has extras. */
  lines: CartLine[];
  /** Across all its lines: the cap is the piece's, not the combination's. */
  qty: number;
  onAdjust: (key: string, act: "inc" | "dec") => void;
  /** Open the extras panel: no key to add a line, a key to change one. */
  onPick: (key: string) => void;
  /** Set right after this card's own stepper was pressed; see the effect below. */
  focusAct: "inc" | "dec" | "pick" | null;
  onFocusHandled: () => void;
}

export function ProductCard({
  product: p, lines, qty, onAdjust, onPick, focusAct, onFocusHandled,
}: Props) {
  const cardRef = useRef<HTMLElement>(null);

  /* Keep focus somewhere sensible after the controls are swapped out. The
     button just pressed may now be disabled — focus can't land there, and if
     we leave it alone it falls back to <body> and a keyboard user loses their
     place in the list. Runs after render, when the new controls exist. */
  useEffect(() => {
    if (!focusAct) return;
    const card = cardRef.current;
    const target =
      card?.querySelector<HTMLButtonElement>(`[data-act="${focusAct}"]:not([disabled])`)
      ?? card?.querySelector<HTMLButtonElement>("[data-act]:not([disabled])");
    target?.focus();
    onFocusHandled();
  }, [focusAct, onFocusHandled]);

  const added = qty > 0;
  const atLimit = qty >= limitFor(p);
  // A piece with extras can't be added by a single tap — there's a question to
  // ask first — so its control opens the panel and the quantities move down
  // into a row per combination underneath.
  const picks = hasAddons(p);

  return (
    <article
      ref={cardRef}
      data-product={p.id}
      className={`grid grid-cols-[112px_1fr] gap-x-3.5 gap-y-2.5 rounded-card border bg-surface p-3
                  transition-[border-color,box-shadow] duration-150
                  ${added ? "border-brand shadow-card-lg" : "border-rule shadow-card"}
                  ${p.available ? "" : "opacity-60"}`}
    >
      {/* Square, always — whatever the photo's own proportions. Centred, so
          whatever height the text has over it splits evenly above and below
          and reads as padding rather than a gap under the photo. */}
      <div className="relative self-center">
        {/* Out of flow on purpose: it rides on the photo's corner without adding
            a row or a pixel of height. Moss rather than the clay notice colour,
            so "New" and "Only N left" stay two distinct signals on a piece that
            happens to be both. Skipped when sold out — "New" on something nobody
            can order is just a tease. */}
        {p.isNew && p.available && (
          <span className="absolute top-1.5 left-1.5 z-1 rounded-full bg-action px-2 py-0.5
                           text-[.6875rem] font-semibold leading-[1.45] tracking-[.02em]
                           text-on-action shadow-card">
            New
          </span>
        )}
        {p.image ? (
          <img
            className="block size-28 rounded-sm bg-surface-brand-soft object-cover"
            src={p.image} alt={p.name} width={112} height={112} loading="lazy"
          />
        ) : (
          <div className="block size-28 rounded-sm bg-surface-brand-soft" aria-hidden="true" />
        )}
      </div>

      {/* One 4px rhythm for the whole body instead of a margin per child. */}
      <div className="flex min-w-0 flex-col justify-center gap-1">
        <h3 className="m-0 font-display text-[1.0625rem] font-semibold leading-[1.25]">{p.name}</h3>

        {/* Two lines is the card's budget: a long description truncates rather
            than pushing the price row past the photo's height. */}
        {p.description && (
          <p className="m-0 line-clamp-2 text-[.8125rem] text-fg-muted">{p.description}</p>
        )}

        {/* min-h-11 reserves the tallest control's height (the 44px add button)
            so the card keeps the same height once it's swapped for the 40px
            stepper — or for "Sold out". */}
        <div className="mt-1 flex min-h-11 items-center justify-between gap-2.5">
          <span className="flex min-w-0 flex-wrap items-baseline gap-1.5">
            <span className="font-semibold tabular-nums">{peso(p.price)}</span>

            {/* Scarcity, said quietly — next to the price, where the decision is
                made. It steps aside once the piece is in the order: the stepper
                is three times the width of the add button it replaces, and there
                isn't room for both. By then a disabled + says the same thing. */}
            {p.available && typeof p.stock === "number" && p.stock <= 3 && !added && (
              <span className="m-0 text-xs font-semibold text-notice
                               before:mr-1.5 before:text-fg-muted before:content-['·']">
                Only {p.stock} left
              </span>
            )}
          </span>

          <span>
            {!p.available ? (
              <span className="text-[.8125rem] italic text-fg-muted">Sold out</span>
            ) : picks ? (
              <button
                type="button"
                data-act="pick"
                onClick={() => onPick("")}
                disabled={atLimit}
                aria-label={atLimit
                  ? `No more ${p.name} available`
                  : `Add ${p.name} to your order and choose extras`}
                className="cursor-pointer rounded-full border border-action bg-action px-4 py-2.5
                           text-[.9375rem] font-semibold leading-none text-on-action
                           focus-visible:outline-moss-950
                           disabled:cursor-not-allowed disabled:opacity-35"
              >
                Add
              </button>
            ) : qty === 0 ? (
              <button
                type="button"
                data-act="inc"
                onClick={() => onAdjust(p.id, "inc")}
                aria-label={`Add ${p.name} to your order`}
                className="grid size-11 cursor-pointer place-items-center rounded-full border
                           border-action bg-action text-xl leading-none text-on-action
                           focus-visible:outline-moss-950"
              >
                +
              </button>
            ) : (
              <Stepper p={p} lineKey={p.id} qty={qty} atLimit={atLimit}
                       label="" onAdjust={onAdjust} />
            )}
          </span>
        </div>
      </div>

      {/* One row per combination, each priced per piece so the extras are
          visibly what's making the difference. The label is a button: tapping
          it reopens the panel on that row, which beats zeroing it out and
          starting again when someone picks the wrong flower. */}
      {picks && p.available && lines.length > 0 && (
        <div className="col-span-2 -mt-1 grid gap-1 border-t border-rule pt-2.5">
          {lines.map((l) => (
            <div key={l.key} className="flex min-h-10 items-center gap-2.5">
              <button
                type="button"
                onClick={() => onPick(l.key)}
                aria-label={`Change the extras on ${extrasLabel(l.extras)} ${p.name}`}
                className="min-w-0 flex-1 cursor-pointer text-left text-[.8125rem] leading-[1.35]
                           text-fg-secondary underline decoration-field decoration-dotted
                           underline-offset-[3px]"
              >
                {extrasLabel(l.extras)}
              </button>
              <span className="flex-none text-sm font-semibold tabular-nums">
                {peso(l.unit)}
              </span>
              <Stepper p={p} lineKey={l.key} qty={l.qty} atLimit={atLimit}
                       label={extrasLabel(l.extras)} onAdjust={onAdjust} />
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

/* `label` names the combination in the aria text — "2 With Gift box Bunny
   Buddy in your order" is a mouthful, but silence about which of two rows
   you're on is worse. Empty for a piece that only ever has one line. */
function Stepper({
  p, lineKey, qty, atLimit, label, onAdjust,
}: {
  p: Product; lineKey: string; qty: number; atLimit: boolean; label: string;
  onAdjust: (key: string, act: "inc" | "dec") => void;
}) {
  const what = label ? `${label} ${p.name}` : p.name;

  return (
    <span className="flex items-center gap-1">
      <StepperButton act="dec" onClick={() => onAdjust(lineKey, "dec")}
                     label={`Remove one ${what}`}>−</StepperButton>
      <span
        className="min-w-[30px] text-center font-semibold tabular-nums"
        aria-live="polite"
        aria-label={`${qty} ${what} in your order`}
      >
        {qty}
      </span>
      <StepperButton
        act="inc"
        onClick={() => onAdjust(lineKey, "inc")}
        disabled={atLimit}
        label={atLimit ? `No more ${p.name} available` : `Add one more ${what}`}
      >
        +
      </StepperButton>
    </span>
  );
}

function StepperButton({
  act, onClick, disabled, label, children,
}: {
  act: "inc" | "dec"; onClick: () => void; disabled?: boolean;
  label: string; children: string;
}) {
  return (
    <button
      type="button"
      data-act={act}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-10 cursor-pointer place-items-center rounded-full border border-field
                 bg-surface text-xl leading-none text-fg-brand active:bg-surface-brand-soft
                 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
