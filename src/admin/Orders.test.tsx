import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { Orders } from "./Orders";
import * as api from "../lib/api/admin";
import type { OrderSummary } from "../lib/api/types";

vi.mock("../lib/api/admin");

const mocked = vi.mocked(api);

const summary = (over: Partial<OrderSummary> = {}): OrderSummary => ({
  id: 42, code: "ORD-0042", reference: "1029", customerName: "Mia Reyes",
  instagram: "miareyes", fulfillment: "Meetup", subtotal: 500, status: "new",
  placedAt: new Date().toISOString(), itemCount: 2, ...over,
});

beforeEach(() => vi.resetAllMocks());

const renderOrders = () => render(<MemoryRouter><Orders /></MemoryRouter>);

describe("the orders list", () => {
  it("files each order under a code the owner can quote", async () => {
    mocked.fetchOrders.mockResolvedValue([summary()]);

    renderOrders();

    expect(await screen.findByText("ORD-0042")).toBeTruthy();
  });

  it("puts nothing clickable inside the row's own link", async () => {
    /* The whole row is one link to the order. A button nested in it is invalid
       markup, and pressing it would copy *and* navigate — so here the code is
       text to read, and the copyable one lives on the order itself. */
    mocked.fetchOrders.mockResolvedValue([summary()]);

    const { container } = renderOrders();
    await screen.findByText("ORD-0042");

    expect(container.querySelector("a")!.querySelector("button")).toBeNull();
  });
});
