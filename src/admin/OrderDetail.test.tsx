import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { OrderDetail } from "./OrderDetail";
import * as api from "../lib/api/admin";
import type { Order } from "../lib/api/types";

vi.mock("../lib/api/admin");

const mocked = vi.mocked(api);

const order = (over: Partial<Order> = {}): Order => ({
  id: 42, code: "ORD-0042", reference: "1029", customerName: "Mia Reyes",
  instagram: "miareyes", fulfillment: "Meetup", subtotal: 550, status: "new",
  placedAt: new Date().toISOString(), itemCount: 1, address: "", notes: "",
  receiptUrl: null,
  items: [{
    name: "Bunny Buddy", quantity: 1, unitPrice: 550, image: "/storage/products/bunny.png",
    addons: [{ name: "Gift box", price: 150, image: "/storage/products/box.png" }],
  }],
  ...over,
});

beforeEach(() => vi.resetAllMocks());

const renderDetail = () => render(
  <MemoryRouter initialEntries={["/admin/orders/42"]}>
    <Routes><Route path="/admin/orders/:id" element={<OrderDetail />} /></Routes>
  </MemoryRouter>,
);

describe("an order", () => {
  it("is filed under a code the owner can quote", async () => {
    mocked.fetchOrder.mockResolvedValue(order());

    renderDetail();

    expect(await screen.findByRole("button", { name: "Copy code ORD-0042" })).toBeTruthy();
  });

  it("shows the photo of each piece and of each extra on it", async () => {
    mocked.fetchOrder.mockResolvedValue(order());

    const { container } = renderDetail();
    await screen.findByText(/Bunny Buddy/);

    /* Found by src, not by alt: these sit right beside the name they belong
       to, so they are decorative and carry no alt text of their own — the
       same call the product and extras lists already make. */
    expect([...container.querySelectorAll("img")].map((i) => i.getAttribute("src")))
      .toEqual(["/storage/products/bunny.png", "/storage/products/box.png"]);
  });

  it("still names a line whose photo is gone", async () => {
    /* A delisted piece, or an extra deleted from the library. The line is the
       record of what was bought and has to stay readable without its photo. */
    mocked.fetchOrder.mockResolvedValue(order({
      items: [{
        name: "Retired Bear", quantity: 2, unitPrice: 300, image: "",
        addons: [{ name: "Anklet", price: 20, image: "" }],
      }],
    }));

    const { container } = renderDetail();

    expect(await screen.findByText(/Retired Bear/)).toBeTruthy();
    expect(screen.getByText(/Anklet/)).toBeTruthy();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});
