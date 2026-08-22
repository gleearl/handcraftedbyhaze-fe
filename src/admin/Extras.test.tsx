import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { Extras } from "./Extras";
import * as api from "../lib/api/admin";
import type { LibraryAddon } from "../lib/api/types";

vi.mock("../lib/api/admin");

const mocked = vi.mocked(api);

const mockLibrary = (entries: LibraryAddon[]) => mocked.fetchLibrary.mockResolvedValue(entries);

const entry = (over: Partial<LibraryAddon> = {}): LibraryAddon =>
  ({ id: 7, code: "EXT-0007", name: "Gift box", price: 150, image: "", usedOn: [], ...over });

beforeEach(() => {
  vi.resetAllMocks();
  mockLibrary([]);
  mocked.deleteAddon.mockResolvedValue(undefined);
});

const renderExtras = () => render(<MemoryRouter><Extras /></MemoryRouter>);

describe("the library of extras", () => {
  it("says how many pieces each extra is on", async () => {
    mockLibrary([
      { id: 7, code: "EXT-0007", name: "Gift box", price: 150, image: "", usedOn: ["croissant", "bunny"] },
      { id: 9, code: "EXT-0009", name: "Anklet", price: 20, image: "", usedOn: [] },
    ]);

    renderExtras();

    expect(await screen.findByText("Gift box")).toBeInTheDocument();
    expect(screen.getByText(/on 2 pieces/i)).toBeInTheDocument();
    // Nothing offering it is worth saying plainly, not as "on 0 pieces".
    expect(screen.getByText(/not on anything yet/i)).toBeInTheDocument();
  });

  it("names the count before deleting, because it comes off every piece", async () => {
    mockLibrary([{ id: 7, code: "EXT-0007", name: "Gift box", price: 150, image: "", usedOn: ["croissant", "bunny"] }]);
    renderExtras();

    await userEvent.click(await screen.findByRole("button", { name: /Delete Gift box/i }));

    expect(screen.getByText(/on 2 pieces/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete everywhere/i })).toBeInTheDocument();
  });

  /* Pressing Delete unmounts the button that was pressed. Without somewhere to
     put the keyboard, the owner is dropped on <body> mid-decision. */
  it("puts the keyboard on the safe answer when it asks", async () => {
    mockLibrary([{ id: 7, code: "EXT-0007", name: "Gift box", price: 150, image: "", usedOn: ["croissant"] }]);
    renderExtras();

    await userEvent.click(await screen.findByRole("button", { name: /Delete Gift box/i }));

    expect(screen.getByRole("button", { name: /Keep it/i })).toHaveFocus();
  });

  /* The asking is only worth anything if the answer is honoured, and if saying
     no leaves the extra exactly where it was. */
  it("deletes only once the second button is pressed", async () => {
    mockLibrary([{ id: 7, code: "EXT-0007", name: "Gift box", price: 150, image: "", usedOn: ["croissant"] }]);
    renderExtras();

    await userEvent.click(await screen.findByRole("button", { name: /Delete Gift box/i }));
    await userEvent.click(screen.getByRole("button", { name: /Keep it/i }));
    expect(mocked.deleteAddon).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Delete Gift box/i }));
    await userEvent.click(screen.getByRole("button", { name: /Delete everywhere/i }));
    expect(mocked.deleteAddon).toHaveBeenCalledWith(7);
  });
});

describe("codes", () => {
  it("files each extra under a code the owner can quote", async () => {
    mockLibrary([entry({ id: 7, code: "EXT-0007" })]);

    renderExtras();

    expect(await screen.findByRole("button", { name: "Copy code EXT-0007" })).toBeTruthy();
  });
});
