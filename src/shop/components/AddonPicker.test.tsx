import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Product } from "../../lib/api/types";
import { AddonPicker } from "./AddonPicker";

const croissant = (freeAddons: number): Product => ({
  id: "c", name: "Croissant", price: 175, image: "", description: "",
  available: true, isNew: false, freeAddons,
  addons: [
    { id: 21, name: "Pink flower", price: 40, image: "" },
    { id: 34, name: "Gift box", price: 50, image: "" },
    { id: 108, name: "Note", price: 20, image: "" },
  ],
});

const show = (product: Product) =>
  render(
    <AddonPicker
      product={product}
      chosen={[]}
      editing={false}
      onConfirm={vi.fn()}
      onClose={vi.fn()}
    />,
  );

/* Each row's <label> wraps the name and its price, so its accessible name is
   "Pink flower+₱40" — matched loosely on the name alone. */

/** The confirm button carries the running price for one piece. */
const priceOnButton = () => screen.getByRole("button", { name: /^Add · / }).textContent;

describe("the add-on picker's running price", () => {
  it("charges for every extra when the piece includes none", async () => {
    const user = userEvent.setup();
    show(croissant(0));

    await user.click(screen.getByLabelText(/Pink flower/));
    expect(priceOnButton()).toContain("₱215");   // 175 + 40
  });

  it("charges nothing while the allowance covers what's ticked", async () => {
    const user = userEvent.setup();
    show(croissant(2));

    await user.click(screen.getByLabelText(/Pink flower/));
    await user.click(screen.getByLabelText(/Gift box/));

    expect(priceOnButton()).toContain("₱175");
  });

  it("moves the charge onto the cheapest once they pick a third", async () => {
    const user = userEvent.setup();
    show(croissant(2));

    await user.click(screen.getByLabelText(/Pink flower/));
    await user.click(screen.getByLabelText(/Gift box/));
    await user.click(screen.getByLabelText(/Note/));

    // ₱50 and ₱40 waived, ₱20 charged — not the two ticked first.
    expect(priceOnButton()).toContain("₱195");
  });

  it("says up front how many are free, so it isn't a surprise", () => {
    show(croissant(2));
    expect(screen.getByText("any 2 free")).toBeInTheDocument();
  });

  it("doesn't promise anything when the piece includes none", () => {
    show(croissant(0));
    expect(screen.queryByText(/free$/)).not.toBeInTheDocument();
  });
});

describe("the add-on picker's confirm", () => {
  it("hands back the library ids, ascending", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    // Ticked out of order, and the smaller id (21) is listed second here, so a
    // pass-through of ticking order rather than a sort would slip by unnoticed.
    render(
      <AddonPicker
        product={croissant(0)}
        chosen={[]}
        editing={false}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText(/Gift box/i));
    await user.click(screen.getByLabelText(/Pink flower/i));
    await user.click(screen.getByRole("button", { name: /^Add · / }));

    // Ascending, because the cart key is built from this exact array.
    expect(onConfirm).toHaveBeenCalledWith([21, 34]);
  });
});
