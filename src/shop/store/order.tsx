/* ==========================================================================
   Order state: step, cart, details, proof file. useReducer + Context — the
   shape is four fields, which is well short of needing a state library.

   The persistence rules below are each a deliberate choice, not incidental.
   ========================================================================== */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef,
  type Dispatch, type ReactNode,
} from "react";
import { fetchProducts } from "../../lib/api/shop";
import type { Fulfillment, Product } from "../../lib/api/types";
import {
  cartCount as countOf, cartLines, clampCartToStock, limitFor, productById,
  subtotal as subtotalOf, type Cart, type CartLine,
} from "../../lib/cart";

export const STEPS = ["welcome", "products", "details", "payment", "review", "done"] as const;
export type StepName = (typeof STEPS)[number];

const STORAGE_KEY = "hbh-order-v1";
export const PROGRESS_STEPS = 4; // products → details → payment → review

/** Never resume past payment: the proof file is gone after a reload. */
const MAX_RESUMABLE_STEP = STEPS.indexOf("payment");

export interface Details {
  name: string;
  instagram: string;
  fulfillment: Fulfillment | "";
  address: string;
  notes: string;
  reference: string;
}

export const EMPTY_DETAILS: Details = {
  name: "", instagram: "", fulfillment: "", address: "", notes: "", reference: "",
};

interface State {
  step: number;
  cart: Cart;
  details: Details;
  /** Never persisted — a File can't survive a reload. */
  proofFile: File | null;
  products: Product[];
  /* There is no bundled fallback any more, so the products step has to be able
     to render all three of these rather than always having something to show. */
  catalogue: "loading" | "ready" | "error";
  /** Set after a stepper press so the card can put focus somewhere sensible. */
  focusRequest: { id: string; act: "inc" | "dec" } | null;
}

type Action =
  | { type: "goTo"; index: number }
  | { type: "adjust"; id: string; act: "inc" | "dec" }
  | { type: "setDetails"; patch: Partial<Details> }
  | { type: "setProof"; file: File | null }
  | { type: "setProducts"; products: Product[] }
  | { type: "catalogueFailed" }
  | { type: "reloadCatalogue" }
  | { type: "restore"; cart: Cart; details: Details; step: number }
  | { type: "focusHandled" }
  | { type: "reset" };

const initialState: State = {
  step: 0,
  cart: {},
  details: EMPTY_DETAILS,
  proofFile: null,
  products: [],
  catalogue: "loading",
  focusRequest: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "goTo":
      return { ...state, step: Math.max(0, Math.min(STEPS.length - 1, action.index)) };

    case "adjust": {
      const p = productById(state.products, action.id);
      if (!p) return state;

      const current = state.cart[action.id] || 0;
      const next = action.act === "inc"
        ? Math.min(current + 1, limitFor(p))   // Infinity when nothing caps it
        : Math.max(0, current - 1);

      const cart = { ...state.cart };
      if (next === 0) delete cart[action.id];
      else cart[action.id] = next;

      return { ...state, cart, focusRequest: { id: action.id, act: action.act } };
    }

    case "setDetails":
      return { ...state, details: { ...state.details, ...action.patch } };

    case "setProof":
      return { ...state, proofFile: action.file };

    case "setProducts": {
      // A cart restored from sessionStorage may exceed stock the owner has
      // since reduced.
      const { cart } = clampCartToStock(state.cart, action.products);
      return { ...state, products: action.products, cart, catalogue: "ready" };
    }

    case "catalogueFailed":
      return { ...state, catalogue: "error" };

    case "reloadCatalogue":
      return { ...state, catalogue: "loading" };

    case "restore":
      return { ...state, cart: action.cart, details: action.details, step: action.step };

    case "focusHandled":
      return { ...state, focusRequest: null };

    case "reset":
      return { ...initialState, products: state.products, catalogue: state.catalogue };

    default:
      return state;
  }
}

/* --- Persistence ---------------------------------------------------------- */

interface Saved { cart: Cart; details: Details; step: number }

function save(state: State) {
  // The order is already sent — never leave it lying around to be resumed.
  if (STEPS[state.step] === "done") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      cart: state.cart,
      details: state.details,
      step: Math.min(state.step, MAX_RESUMABLE_STEP),
    } satisfies Saved));
  } catch { /* private mode — the form still works, it just won't resume */ }
}

function readSaved(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Saved> | null;
    if (!parsed) return null;

    const cart = parsed.cart && typeof parsed.cart === "object" ? parsed.cart : {};
    return {
      cart,
      details: { ...EMPTY_DETAILS, ...(parsed.details ?? {}) },
      step: typeof parsed.step === "number" ? parsed.step : 0,
    };
  } catch {
    return null;
  }
}

export function clearSaved() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* see save() */ }
}

/* --- Context -------------------------------------------------------------- */

interface OrderContext {
  state: State;
  dispatch: Dispatch<Action>;
  stepName: StepName;
  reloadCatalogue: () => void;
  lines: CartLine[];
  count: number;
  subtotal: number;
  goTo: (index: number) => void;
}

const Ctx = createContext<OrderContext | null>(null);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    const saved = readSaved();
    if (!saved) return init;

    // Only resume into a later step if there's actually a cart to resume.
    const hasCart = Object.values(saved.cart).some((q) => q > 0);
    return {
      ...init,
      cart: saved.cart,
      details: saved.details,
      step: hasCart && saved.step > 0 ? Math.min(saved.step, MAX_RESUMABLE_STEP) : 0,
    };
  });

  // Persist on every change that matters. proofFile and products are excluded
  // deliberately: one can't be serialised, the other isn't ours to cache.
  useEffect(() => { save(state); }, [state.step, state.cart, state.details]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Not awaited at boot on purpose: the welcome screen shouldn't wait on the
     network. Products aren't on screen yet, so loading them behind it is free. */
  const loadCatalogue = useCallback(() => {
    dispatch({ type: "reloadCatalogue" });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);

    fetchProducts(ctrl.signal)
      .then((products) => dispatch({ type: "setProducts", products }))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[products] Couldn't load the catalogue.", err);
        dispatch({ type: "catalogueFailed" });
      })
      .finally(() => clearTimeout(timer));

    return () => { clearTimeout(timer); ctrl.abort(); };
  }, []);

  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;   // StrictMode double-invokes effects in dev
    loaded.current = true;
    loadCatalogue();
  }, [loadCatalogue]);

  const lines = useMemo(() => cartLines(state.cart, state.products), [state.cart, state.products]);
  const count = useMemo(() => countOf(lines), [lines]);
  const subtotal = useMemo(() => subtotalOf(lines), [lines]);

  const goTo = useCallback((index: number) => dispatch({ type: "goTo", index }), []);

  const value = useMemo<OrderContext>(() => ({
    state, dispatch, stepName: STEPS[state.step], lines, count, subtotal, goTo,
    reloadCatalogue: loadCatalogue,
  }), [state, lines, count, subtotal, goTo, loadCatalogue]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrder(): OrderContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOrder must be used inside <OrderProvider>.");
  return ctx;
}
