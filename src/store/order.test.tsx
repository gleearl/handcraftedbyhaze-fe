import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderProvider, STEPS, useOrder } from "./order";

/* The catalogue fetch is not what these tests are about; stub it so they don't
   depend on the network or on which adapter is configured. */
vi.mock("../lib/api", () => ({
  orderSource: { fetchProducts: () => new Promise(() => {}), submitOrder: async () => {} },
}));

const KEY = "hbh-order-v1";

function Probe() {
  const { state, stepName, goTo, dispatch } = useOrder();
  return (
    <div>
      <span data-testid="step">{stepName}</span>
      <span data-testid="cart">{JSON.stringify(state.cart)}</span>
      <span data-testid="name">{state.details.name}</span>
      <button onClick={() => goTo(STEPS.indexOf("review"))}>to-review</button>
      <button onClick={() => goTo(STEPS.indexOf("done"))}>to-done</button>
      <button onClick={() => dispatch({ type: "adjust", id: "p-c", act: "inc" })}>add</button>
    </div>
  );
}

const saved = () => JSON.parse(sessionStorage.getItem(KEY) ?? "null");
const seed = (v: unknown) => sessionStorage.setItem(KEY, JSON.stringify(v));
const click = (label: string) => act(() => { screen.getByText(label).click(); });

describe("order persistence", () => {
  beforeEach(() => sessionStorage.clear());

  it("saves the cart and details as they change", () => {
    render(<OrderProvider><Probe /></OrderProvider>);
    click("add");
    expect(saved().cart).toEqual({ "p-c": 1 });
  });

  it("never persists a step past payment, so a reload can't land on review", () => {
    render(<OrderProvider><Probe /></OrderProvider>);
    click("add");
    click("to-review");

    expect(screen.getByTestId("step")).toHaveTextContent("review");
    expect(saved().step).toBe(STEPS.indexOf("payment"));
  });

  it("stops persisting once the order is sent", () => {
    render(<OrderProvider><Probe /></OrderProvider>);
    click("add");
    const beforeDone = saved();
    click("to-done");

    // The done step must not overwrite the record with a resumable one.
    expect(saved()).toEqual(beforeDone);
    expect(saved().step).not.toBe(STEPS.indexOf("done"));
  });

  it("resumes a saved cart and details", () => {
    seed({ cart: { "p-c": 2 }, details: { name: "Juan" }, step: 2 });
    render(<OrderProvider><Probe /></OrderProvider>);

    expect(screen.getByTestId("cart")).toHaveTextContent('{"p-c":2}');
    expect(screen.getByTestId("name")).toHaveTextContent("Juan");
    expect(screen.getByTestId("step")).toHaveTextContent("details");
  });

  it("clamps a resumed step down to payment", () => {
    seed({ cart: { "p-c": 1 }, details: {}, step: STEPS.indexOf("review") });
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

  it("survives unreadable storage rather than throwing", () => {
    sessionStorage.setItem(KEY, "not json");
    expect(() => render(<OrderProvider><Probe /></OrderProvider>)).not.toThrow();
    expect(screen.getByTestId("step")).toHaveTextContent("welcome");
  });
});
