import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { CONFIG } from "../config";
import { submitOrder as postOrder } from "../lib/api/shop";
import { ApiError } from "../lib/api/http";
import { itemsAsText } from "../lib/cart";
import {
  SUBMIT_FAILED, validateDetails, validatePayment, validateProducts, type Invalid,
} from "../lib/validate";
import { clearSaved, PROGRESS_STEPS, STEPS, useOrder } from "./store/order";
import { TopBar } from "./components/TopBar";
import { ActionBar } from "./components/ActionBar";
import { Welcome } from "./steps/Welcome";
import { Products } from "./steps/Products";
import { Details } from "./steps/Details";
import { Payment } from "./steps/Payment";
import { Review } from "./steps/Review";
import { Done } from "./steps/Done";

const BAR_STEPS = ["products", "details", "payment", "review"];

export function App() {
  const { state, dispatch, stepName, lines, count, subtotal, goTo } = useOrder();
  const [invalid, setInvalid] = useState<Invalid | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => { document.title = `Order Form — ${CONFIG.shopName}`; }, []);

  /* Two scrolls on purpose: once now, once after the new step has laid out.
     Without the second, a taller step leaves the page mid-scroll. */
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    const id = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(id);
  }, [state.step]);

  /* Clear a stale error as soon as the customer changes the thing it was
     about — leaving it up while they type reads as the app not noticing. */
  useEffect(() => { setInvalid(null); }, [state.cart, state.details, state.proofFile]);

  const validateCurrent = useCallback((): Invalid | null => {
    if (stepName === "products") return validateProducts(count);
    if (stepName === "details") return validateDetails(state.details);
    if (stepName === "payment") return validatePayment(state.proofFile);
    return null;
  }, [stepName, count, state.details, state.proofFile]);

  /* Focus the field the message is about, and bring it into view. Without this
     an error below the fold looks like a button that simply didn't work. */
  function focusInvalid(problem: Invalid) {
    const id = { name: "f-name", ig: "f-ig", address: "f-address",
                 fulfillment: "f-meetup", proof: "", cart: "" }[problem.field];
    if (!id) return;
    const node = document.getElementById(id);
    node?.focus({ preventScroll: false });
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function submitOrder() {
    setSending(true);
    setSubmitError(null);

    const d = state.details;
    const payload = {
      name: d.name,
      instagram: d.instagram,
      fulfillment: (d.fulfillment || "Meetup") as "Meetup" | "Delivery",
      address: d.address,
      notes: d.notes,
      items: itemsAsText(lines, subtotal),
      subtotal,
      reference: d.reference,
      proof: state.proofFile,
    };

    try {
      await postOrder(payload);
      clearSaved();
      goTo(STEPS.indexOf("done"));
    } catch (err) {
      console.error(err);
      setSubmitError(err instanceof ApiError && err.status === 422
        ? Object.values(err.fieldErrors)[0] ?? SUBMIT_FAILED
        : SUBMIT_FAILED);
    } finally {
      setSending(false);
    }
  }

  function next() {
    const problem = validateCurrent();
    if (problem) {
      setInvalid(problem);
      focusInvalid(problem);
      return;
    }
    if (stepName === "review") { void submitOrder(); return; }
    goTo(state.step + 1);
  }

  function restart() {
    dispatch({ type: "reset" });
    clearSaved();
    setInvalid(null);
    setSubmitError(null);
  }

  const showBar = BAR_STEPS.includes(stepName);
  const showTopBar = state.step >= 1 && state.step <= PROGRESS_STEPS;

  return (
    <>
      {showTopBar && <TopBar step={state.step} onBack={() => goTo(state.step - 1)} />}

      <main className="mx-auto max-w-[480px] px-5 pt-5 pb-2 sm:pt-8">
        {stepName === "welcome" && <Welcome onStart={() => goTo(STEPS.indexOf("products"))} />}
        {stepName === "products" && <Products error={invalid?.field === "cart" ? invalid.message : null} />}
        {stepName === "details" && <Details invalid={invalid} />}
        {stepName === "payment" && <Payment invalid={invalid} />}
        {stepName === "review" && <Review error={submitError} />}
        {stepName === "done" && <Done fulfillment={state.details.fulfillment} onRestart={restart} />}
      </main>

      {showBar && (
        <ActionBar
          showTotal={stepName === "products"}
          count={count}
          subtotal={subtotal}
          label={sending ? "Sending…" : stepName === "review" ? "Place order" : "Continue"}
          disabled={sending || (stepName === "products" && count === 0)}
          onNext={next}
        />
      )}

      {/* Clears the sticky action bar so the last line is never trapped behind it. */}
      <footer className={`px-5 pt-7 text-center text-[.8125rem] text-fg-muted ${
        showBar
          ? "pb-[calc(var(--spacing-bar)+24px+env(safe-area-inset-bottom))]"
          : "pb-[calc(20px+env(safe-area-inset-bottom))]"
      }`}>
        <p className="m-0">Handmade in Cebu · @{CONFIG.igHandle}</p>
      </footer>
    </>
  );
}
