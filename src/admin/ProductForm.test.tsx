import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { ProductForm } from "./ProductForm";
import * as api from "../lib/api/admin";
import type { AdminProduct, LibraryAddon } from "../lib/api/types";

vi.mock("../lib/api/admin");

const mocked = vi.mocked(api);
const { createProduct, updateProduct } = mocked;

beforeEach(() => {
  vi.resetAllMocks();
  mocked.createProduct.mockResolvedValue(undefined as never);
  mocked.updateProduct.mockResolvedValue(undefined as never);
  mocked.fetchAdminProducts.mockResolvedValue([]);
  mocked.fetchLibrary.mockResolvedValue([]);
});

/** What the library holds this time. The form reads it on every path now. */
const mockLibrary = (entries: LibraryAddon[]) => mocked.fetchLibrary.mockResolvedValue(entries);

const renderForm = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/admin/products/${id}`]}>
      <Routes>
        <Route path="/admin/products/:id" element={<ProductForm />} />
      </Routes>
    </MemoryRouter>,
  );

const png = (name: string) => new File(["x"], name, { type: "image/png" });

describe("extras on the product form", () => {
  it("ticks an extra from the library rather than typing one", async () => {
    mockLibrary([
      { id: 7, name: "Gift box", price: 150, image: "", usedOn: [] },
      { id: 9, name: "Pink flower", price: 20, image: "", usedOn: [] },
    ]);

    renderForm("new");

    await userEvent.click(await screen.findByLabelText(/Gift box/i));
    await userEvent.type(screen.getByLabelText(/^Name/i), "Croissant");
    await userEvent.type(screen.getByLabelText(/Price/i), "175");
    // A new piece won't submit without one, and the extras are the point here.
    await userEvent.upload(screen.getByLabelText(/^Photo/i), png("piece.png"));
    await userEvent.click(screen.getByRole("button", { name: /Add piece/i }));

    await waitFor(() => expect(createProduct).toHaveBeenCalled());
    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ addons: [7] }));
  });

  it("counts against twenty, not ten", async () => {
    mockLibrary([{ id: 7, name: "Gift box", price: 150, image: "", usedOn: [] }]);
    renderForm("new");

    expect(await screen.findByText(/0 of 20/)).toBeInTheDocument();
  });
});

describe("extras on a piece that already exists", () => {
  const croissant: AdminProduct = {
    id: "croissant", name: "Croissant", price: 175, image: "/storage/c.png",
    description: "", available: true, stock: undefined, max: undefined,
    freeAddons: 0, isNew: false, archived: false,
    addons: [
      { id: 9, name: "Pink flower", price: 40, image: "" },
      { id: 7, name: "Gift box", price: 150, image: "" },
    ],
  };

  beforeEach(() => {
    mocked.fetchAdminProducts.mockResolvedValue([croissant]);
    mockLibrary([
      { id: 7, name: "Gift box", price: 150, image: "", usedOn: ["croissant"] },
      { id: 9, name: "Pink flower", price: 40, image: "", usedOn: ["croissant"] },
      { id: 11, name: "Ribbon", price: 0, image: "", usedOn: [] },
    ]);
  });

  it("saves the ones still ticked, as ids in the order they sit in", async () => {
    renderForm("croissant");

    await userEvent.click(await screen.findByRole("button", { name: /Take Pink flower off/i }));
    await userEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => expect(updateProduct).toHaveBeenCalled());
    expect(updateProduct).toHaveBeenCalledWith(
      "croissant", expect.objectContaining({ addons: [7] }),
    );
  });

  it("offers only the library entries this piece hasn't got", async () => {
    // The two it already offers are rows above; a third tick box would be a
    // second way to say the same thing, one of them out of order.
    renderForm("croissant");

    expect(await screen.findByRole("checkbox", { name: /Ribbon/i })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Gift box/i })).not.toBeInTheDocument();
  });
});
