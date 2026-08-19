import { AddonPicker } from "../components/AddonPicker";
import { ProductCard } from "../components/ProductCard";
import { ErrorText } from "../components/ErrorText";
import { Button } from "../components/Button";
import { extrasFromKey, productById, qtyOfProduct } from "../../lib/cart";
import { useOrder } from "../store/order";

export function Products({ error }: { error: string | null }) {
  const { state, dispatch, reloadCatalogue, lines } = useOrder();
  const picking = state.picking;
  const pickingProduct = picking ? productById(state.products, picking.id) : undefined;

  return (
    <section aria-labelledby="products-title" className="animate-rise">
      <h2 id="products-title" className="mb-3 font-display text-[1.375rem] font-semibold leading-[1.3]">
        Pick your pieces
      </h2>
      <p className="mb-4.5 text-[.9375rem] text-fg-muted">
        Tap{" "}
        <span
          aria-hidden="true"
          className="inline-grid size-[18px] place-items-center rounded-full bg-action
                     align-middle text-xs leading-none text-on-action"
        >
          +
        </span>{" "}
        to add. You can order more than one.
      </p>

      {/* The catalogue is the only source now — there's no bundled list to fall
          back on — so all three of these states have to be sayable. */}
      {state.catalogue === "loading" && <Skeletons />}

      {state.catalogue === "error" && (
        <div role="alert" className="rounded-card border border-dashed border-rule bg-surface p-6 text-center">
          <p className="mt-0 mb-4 text-[.9375rem] text-fg-muted">
            I couldn't load the shop just now. It's probably a hiccup on the way here.
          </p>
          <Button variant="ghost" size="sm" onClick={reloadCatalogue}>Try again</Button>
        </div>
      )}

      {state.catalogue === "ready" && state.products.length === 0 && (
        <div className="rounded-card border border-dashed border-rule bg-surface p-6 text-center">
          <p className="m-0 text-[.9375rem] text-fg-muted">
            Nothing's up for order right now — new pieces are on the way. Check back soon!
          </p>
        </div>
      )}

      {state.catalogue === "ready" && state.products.length > 0 && (
        <div className="grid gap-3.5">
          {state.products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              lines={lines.filter((l) => l.id === p.id)}
              qty={qtyOfProduct(state.cart, p.id)}
              onAdjust={(key, act) => dispatch({ type: "adjust", id: p.id, key, act })}
              onPick={(key) => dispatch({ type: "openPicker", id: p.id, key })}
              focusAct={state.focusRequest?.id === p.id ? state.focusRequest.act : null}
              onFocusHandled={() => dispatch({ type: "focusHandled" })}
            />
          ))}
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      {pickingProduct && picking && (
        <AddonPicker
          /* Keyed so reopening on a different row starts from that row's
             extras rather than the ones the panel last held. */
          key={picking.id + "|" + picking.key}
          product={pickingProduct}
          chosen={picking.key ? (state.cart[picking.key]?.extras ?? extrasFromKey(picking.key)) : []}
          editing={picking.key !== ""}
          onConfirm={(extras) => dispatch({ type: "commitPick", extras })}
          onClose={() => dispatch({ type: "closePicker" })}
        />
      )}
    </section>
  );
}

/* Card-shaped placeholders rather than a spinner, so the list doesn't jump
   when the real thing arrives. */
function Skeletons() {
  return (
    <div className="grid gap-3.5" aria-busy="true" aria-label="Loading the shop">
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid animate-pulse grid-cols-[112px_1fr] gap-3.5 rounded-card
                                border border-rule bg-surface p-3">
          <div className="size-28 rounded-sm bg-surface-brand-soft" />
          <div className="flex min-w-0 flex-col justify-center gap-2">
            <div className="h-4 w-2/3 rounded bg-surface-brand-soft" />
            <div className="h-3 w-1/2 rounded bg-surface-brand-soft" />
            <div className="mt-1 h-4 w-16 rounded bg-surface-brand-soft" />
          </div>
        </div>
      ))}
    </div>
  );
}
