import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { Products } from "./Products";
import * as api from "../lib/api/admin";
import type { AdminProduct } from "../lib/api/types";

vi.mock("../lib/api/admin");

const mocked = vi.mocked(api);

const product = (id: string, name: string, archived = false): AdminProduct => ({
  id, name, price: 100, image: "", description: "", available: true,
  stock: undefined, max: undefined, freeAddons: 0, isNew: false, addons: [], archived,
  code: `PRD-000${name.length}`,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocked.fetchAdminProducts.mockResolvedValue([
    product("bunny", "Bunny"), product("bear", "Bear"), product("cat", "Cat"),
  ]);
  mocked.reorderProducts.mockResolvedValue(undefined);
});

const renderList = () => render(<MemoryRouter><Products /></MemoryRouter>);

/** The pieces as the list is currently showing them, top to bottom. */
const shown = () =>
  screen.getAllByRole("button", { name: /^Move / })
    .map((handle) => handle.getAttribute("aria-label")!.replace(/^Move (.+?),.*/, "$1"));

describe("arranging the products list", () => {
  it("saves the new order when a piece is moved down", async () => {
    const user = userEvent.setup();
    renderList();

    (await screen.findByRole("button", { name: /^Move Bunny/ })).focus();
    await user.keyboard("{ArrowDown}");

    expect(shown()).toEqual(["Bear", "Bunny", "Cat"]);
    await waitFor(() =>
      expect(mocked.reorderProducts).toHaveBeenCalledWith(["bear", "bunny", "cat"]),
    );
  });

  it("puts the pieces back and says so when the save fails", async () => {
    const user = userEvent.setup();
    mocked.reorderProducts.mockRejectedValue(new Error("offline"));
    renderList();

    (await screen.findByRole("button", { name: /^Move Bunny/ })).focus();
    await user.keyboard("{ArrowDown}");

    await screen.findByText(/couldn't be saved/i);
    expect(shown()).toEqual(["Bunny", "Bear", "Cat"]);
  });

  it("offers no handle on a piece that is already hidden from the shop", async () => {
    mocked.fetchAdminProducts.mockResolvedValue([
      product("bunny", "Bunny"), product("gone", "Gone", true),
    ]);
    renderList();

    await screen.findByRole("button", { name: /^Move Bunny/ });
    expect(screen.queryByRole("button", { name: /^Move Gone/ })).toBeNull();
  });
});

describe("hiding and unhiding a piece", () => {
  it("puts a hidden piece back in the shop and reloads the list", async () => {
    const user = userEvent.setup();
    mocked.fetchAdminProducts.mockResolvedValue([
      product("bunny", "Bunny"), product("gone", "Gone", true),
    ]);
    mocked.restoreProduct.mockResolvedValue(undefined);
    renderList();

    await user.click(await screen.findByRole("button", { name: /unhide gone/i }));

    expect(mocked.restoreProduct).toHaveBeenCalledWith("gone");
    await waitFor(() => expect(mocked.fetchAdminProducts).toHaveBeenCalledTimes(2));
  });

  it("says so and leaves the piece hidden when unhiding fails", async () => {
    const user = userEvent.setup();
    mocked.fetchAdminProducts.mockResolvedValue([product("gone", "Gone", true)]);
    mocked.restoreProduct.mockRejectedValue(new Error("offline"));
    renderList();

    await user.click(await screen.findByRole("button", { name: /unhide gone/i }));

    await screen.findByText(/something went wrong/i);
    expect(screen.getByRole("button", { name: /unhide gone/i })).toBeInTheDocument();
  });

  it("asks before hiding a piece, and does nothing when the answer is no", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderList();

    await user.click((await screen.findAllByRole("button", { name: /hide bunny/i }))[0]);

    expect(mocked.archiveProduct).not.toHaveBeenCalled();
  });
});

describe("codes", () => {
  it("files each piece under a code the owner can quote", async () => {
    renderList();

    expect(await screen.findByRole("button", { name: "Copy code PRD-0005" })).toBeTruthy();
  });
});
