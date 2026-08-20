import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "../../lib/api/types";
import { OrderProvider, STEPS, useOrder } from "./order";

/* The catalogue fetch is not what these tests are about; stub it so they don't
   depend on the network. It never settles, which also holds the store in its
   "loading" state — exactly what a test about persistence wants. */
vi.mock("../../lib/api/shop", () => ({
  fetchProducts: () => new Promise(() => {}),
  submitOrder: async () => {},
}));

/* v2: a cart is one entry per combination now, not { id: qty }. */
const KEY = "hbh-order-v2";

/* There is no bundled catalogue any more, so a cart can only be built after
   products arrive — the same order the real app runs in. */
const CATALOGUE: Product[] = [{
  id: "p-c", name: "Pink Flower Croissant", price: 150, image: "",
  description: "", available: true, isNew: false, freeAddons: 0, addons: [],
}, {
  id: "n-sc", name: "Personalized Croissant", price: 175, image: "",
  description: "", available: true, isNew: false, freeAddons: 0,
  addons: [
    { slot: 0, name: "Pink flower", price: 40, image: "" },
    { slot: 1, name: "Gift box", price: 50, image: "" },
  ],
}];

/** A line as the cart stores it, so a test reads as the cart it describes. */
const line = (id: string, extras: number[], qty: number) => ({ id, extras, qty });

function Probe() {
  const { state, stepName, goTo, dispatch } = useOrder();
  return (
    <div>
      <span data-testid="step">{stepName}</span>
      <span data-testid="cart">{JSON.stringify(state.cart)}</span>
      <span data-testid="name">{state.details.name}</span>
      <span data-testid="catalogue">{state.catalogue}</span>
      <button onClick={() => dispatch({ type: "setProducts", products: CATALOGUE })}>seed</button>
      <button onClick={() => goTo(STEPS.indexOf("review"))}>to-review</button>
      <button onClick={() => goTo(STEPS.indexOf("done"))}>to-done</button>
      <button onClick={() => dispatch({ type: "adjust", id: "p-c", key: "p-c", act: "inc" })}>add</button>
      <button onClick={() => dispatch({ type: "openPicker", id: "n-sc", key: "" })}>pick</button>
      <button onClick={() => dispatch({ type: "commitPick", extras: [0] })}>confirm-flower</button>
      <button onClick={() => dispatch({ type: "commitPick", extras: [] })}>confirm-plain</button>
    </div>
  );
}

const saved = () => JSON.parse(sessionStorage.getItem(KEY) ?? "null");
const seed = (v: unknown) => sessionStorage.setItem(KEY, JSON.stringify(v));
const click = (label: string) => act(() => { screen.getByText(label).click(); });

/** Render with a catalogue already loaded, which is what most tests assume. */
function renderStocked() {
  render(<OrderProvider><Probe /></OrderProvider>);
  click("seed");
}

describe("order persistence", () => {
  beforeEach(() => sessionStorage.clear());

  it("saves the cart and details as they change", () => {
    renderStocked();
    click("add");
    expect(saved().cart).toEqual({ "p-c": line("p-c", [], 1) });
  });

  it("never persists a step past payment, so a reload can't land on review", () => {
    renderStocked();
    click("add");
    click("to-review");

    expect(screen.getByTestId("step")).toHaveTextContent("review");
    expect(saved().step).toBe(STEPS.indexOf("payment"));
  });

  it("stops persisting once the order is sent", () => {
    renderStocked();
    click("add");
    const beforeDone = saved();
    click("to-done");

    // The done step must not overwrite the record with a resumable one.
    expect(saved()).toEqual(beforeDone);
    expect(saved().step).not.toBe(STEPS.indexOf("done"));
  });

  it("resumes a saved cart and details", () => {
    seed({ cart: { "p-c": line("p-c", [], 2) }, details: { name: "Juan" }, step: 2 });
    render(<OrderProvider><Probe /></OrderProvider>);

    expect(screen.getByTestId("cart")).toHaveTextContent('"qty":2');
    expect(screen.getByTestId("name")).toHaveTextContent("Juan");
    expect(screen.getByTestId("step")).toHaveTextContent("details");
  });

  it("clamps a resumed step down to payment", () => {
    seed({ cart: { "p-c": line("p-c", [], 1) }, details: {}, step: STEPS.indexOf("review") });
    render(<OrderProvider><Probe /></OrderProvider>);
    expect(screen.getByTestId("step")).toHaveTextContent("payment");
  });

  it("starts at the welcome step when the saved cart is empty", () => {
    seed({ cart: {}, details: { name: "Juan" }, step: 3 });
    render(<OrderProvider><Probe /></OrderProvider>);

    expect(screen.getByTestId("step")).toHaveTextContent("welcome");
    // Details are still worth keeping — only the step is reset.
    expect(screen.getByTestId("name")).toHaveTextContent("Juan");
  });

  it("starts in the loading state, with nothing to show and no fallback", () => {
    render(<OrderProvider><Probe /></OrderProvider>);
    expect(screen.getByTestId("catalogue")).toHaveTextContent("loading");
    expect(screen.getByTestId("cart")).toHaveTextContent("{}");
  });

  it("survives unreadable storage rather than throwing", () => {
    sessionStorage.setItem(KEY, "not json");
    expect(() => render(<OrderProvider><Probe /></OrderProvider>)).not.toThrow();
    expect(screen.getByTestId("step")).toHaveTextContent("welcome");
  });
});

describe("choosing extras", () => {
  beforeEach(() => sessionStorage.clear());

  it("keys a line by the extras chosen for it", () => {
    renderStocked();
    click("pick");
    click("confirm-flower");

    expect(saved().cart).toEqual({ "n-sc::0": line("n-sc", [0], 1) });
  });

  it("holds the same piece twice when the extras differ", () => {
    renderStocked();
    click("pick"); click("confirm-flower");
    click("pick"); click("confirm-plain");

    expect(saved().cart).toEqual({
      "n-sc::0": line("n-sc", [0], 1),
      "n-sc": line("n-sc", [], 1),
    });
  });

  it("adds to the row already there when the same combination is picked twice", () => {
    renderStocked();
    click("pick"); click("confirm-flower");
    click("pick"); click("confirm-flower");

    expect(saved().cart).toEqual({ "n-sc::0": line("n-sc", [0], 2) });
  });

  it("drops a v1 cart rather than half-reading it into the new shape", () => {
    // { id: qty } can't become a line, and a half-read cart is worse than none.
    seed({ cart: { "p-c": 2 }, details: { name: "Juan" }, step: 2 });
    render(<OrderProvider><Probe /></OrderProvider>);

    expect(screen.getByTestId("cart")).toHaveTextContent("{}");
    expect(screen.getByTestId("step")).toHaveTextContent("welcome");
    // The details are still worth keeping.
    expect(screen.getByTestId("name")).toHaveTextContent("Juan");
  });
});
