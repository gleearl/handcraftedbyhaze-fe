import { ProductCard } from "../components/ProductCard";
import { ErrorText } from "../components/ErrorText";
import { useOrder } from "../store/order";

export function Products({ error }: { error: string | null }) {
  const { state, dispatch } = useOrder();

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

      <div className="grid gap-3.5">
        {state.products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            qty={state.cart[p.id] || 0}
            onAdjust={(act) => dispatch({ type: "adjust", id: p.id, act })}
            focusAct={state.focusRequest?.id === p.id ? state.focusRequest.act : null}
            onFocusHandled={() => dispatch({ type: "focusHandled" })}
          />
        ))}
      </div>

      <ErrorText>{error}</ErrorText>
    </section>
  );
}
