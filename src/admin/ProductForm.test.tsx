import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { ProductForm } from "./ProductForm";
import * as api from "../lib/api/admin";

vi.mock("../lib/api/admin");

const mocked = vi.mocked(api);

beforeEach(() => {
  vi.resetAllMocks();
  mocked.createProduct.mockResolvedValue(undefined as never);
  mocked.fetchAdminProducts.mockResolvedValue([]);
});

const renderEdit = () =>
  render(
    <MemoryRouter initialEntries={["/admin/products/croissant"]}>
      <Routes>
        <Route path="/admin/products/:id" element={<ProductForm />} />
      </Routes>
    </MemoryRouter>,
  );

const renderNew = () =>
  render(
    <MemoryRouter initialEntries={["/admin/products/new"]}>
      <Routes>
        <Route path="/admin/products/:id" element={<ProductForm />} />
      </Routes>
    </MemoryRouter>,
  );

const png = (name: string) => new File(["x"], name, { type: "image/png" });

/** Everything a new piece needs before the form will submit at all. */
async function fillTheBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Name/), "Croissant");
  await user.clear(screen.getByLabelText(/^Price/));
  await user.type(screen.getByLabelText(/^Price/), "175");
  await user.upload(screen.getByLabelText(/^Photo/), png("piece.png"));
}

describe("extras on the product form", () => {
  it("carries a photo chosen for an extra through to the save", async () => {
    const user = userEvent.setup();
    renderNew();

    await fillTheBasics(user);

    await user.click(screen.getByRole("button", { name: "Add an extra" }));
    await user.type(screen.getByLabelText("Extra 1"), "Gift box");
    await user.upload(screen.getByLabelText(/^Photo for/), png("box.png"));

    await user.click(screen.getByRole("button", { name: "Add piece" }));

    await waitFor(() => expect(mocked.createProduct).toHaveBeenCalled());

    const [input] = mocked.createProduct.mock.calls.at(-1)!;
    expect(input.addons).toHaveLength(1);
    expect(input.addons[0]!.name).toBe("Gift box");
    expect(input.addons[0]!.photo?.name).toBe("box.png");
  });

  it("offers the photo field straight away, before the extra is named", async () => {
    /* It used to appear only once a name was typed, which looked exactly like
       an extra that can't take a photo at all. */
    const user = userEvent.setup();
    renderNew();

    await user.click(screen.getByRole("button", { name: "Add an extra" }));

    expect(screen.getByLabelText("Photo for Extra 1")).toBeInTheDocument();
  });

  it("keeps a photo chosen before the extra was named", async () => {
    // Picking the photo first is the obvious order once the field is there.
    const user = userEvent.setup();
    renderNew();

    await fillTheBasics(user);
    await user.click(screen.getByRole("button", { name: "Add an extra" }));
    await user.upload(screen.getByLabelText("Photo for Extra 1"), png("box.png"));
    await user.type(screen.getByLabelText("Extra 1"), "Gift box");
    await user.click(screen.getByRole("button", { name: "Add piece" }));

    await waitFor(() => expect(mocked.createProduct).toHaveBeenCalled());

    const [input] = mocked.createProduct.mock.calls.at(-1)!;
    expect(input.addons[0]!.name).toBe("Gift box");
    expect(input.addons[0]!.photo?.name).toBe("box.png");
  });

  it("keeps each extra's photo on its own row", async () => {
    const user = userEvent.setup();
    renderNew();

    await fillTheBasics(user);

    await user.click(screen.getByRole("button", { name: "Add an extra" }));
    await user.type(screen.getByLabelText("Extra 1"), "Gift box");
    await user.click(screen.getByRole("button", { name: "Add another extra" }));
    await user.type(screen.getByLabelText("Extra 2"), "Pink flower");

    // Only the second one gets a photo.
    await user.upload(screen.getByLabelText("Photo for Pink flower"), png("pink.png"));
    await user.click(screen.getByRole("button", { name: "Add piece" }));

    await waitFor(() => expect(mocked.createProduct).toHaveBeenCalled());

    const [input] = mocked.createProduct.mock.calls.at(-1)!;
    expect(input.addons[0]!.photo).toBeNull();
    expect(input.addons[1]!.photo?.name).toBe("pink.png");
  });
});

describe("extras on a piece that already exists", () => {
  const croissant = {
    id: "croissant", name: "Croissant", price: 175, image: "/storage/c.png",
    description: "", available: true, isNew: false, archived: false,
    addons: [
      { slot: 0, name: "Pink flower", price: 40, image: "" },
      { slot: 2, name: "Gift box", price: 50, image: "" },
    ],
  };

  beforeEach(() => {
    mocked.fetchAdminProducts.mockResolvedValue([croissant] as never);
    mocked.updateProduct.mockResolvedValue(undefined as never);
  });

  it("adds a photo to an extra that didn't have one", async () => {
    const user = userEvent.setup();
    renderEdit();

    await user.upload(await screen.findByLabelText("Photo for Gift box"), png("box.png"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mocked.updateProduct).toHaveBeenCalled());

    const [, input] = mocked.updateProduct.mock.calls.at(-1)!;
    const box = input.addons.find((a) => a.name === "Gift box");

    expect(box?.slot).toBe(2);
    expect(box?.photo?.name).toBe("box.png");
  });

  it("shows only the extras the piece has, with no blank rows between them", async () => {
    // Slots 0 and 2, but two rows — the gap is a slot number, not a row.
    renderEdit();

    expect(await screen.findByLabelText("Extra 1")).toHaveValue("Pink flower");
    expect(screen.getByLabelText("Extra 2")).toHaveValue("Gift box");
    expect(screen.queryByLabelText("Extra 3")).not.toBeInTheDocument();
  });
});
