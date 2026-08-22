import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { ExtraForm } from "./ExtraForm";
import * as api from "../lib/api/admin";
import { ApiError } from "../lib/api/http";
import type { AdminProduct, LibraryAddon } from "../lib/api/types";

vi.mock("../lib/api/admin");

const mocked = vi.mocked(api);

const piece = (id: string, name: string, archived = false): AdminProduct => ({
  id, name, price: 100, image: "", description: "", available: true,
  stock: undefined, max: undefined, freeAddons: 0, isNew: false, addons: [], archived,
  code: `PRD-000${name.length}`,
});

const entry = (id: number, usedOn: string[] = []): LibraryAddon =>
  ({ id, code: `EXT-${String(id).padStart(4, "0")}`, name: "Gift box", price: 150, image: "", usedOn });

/** The 422 the server sends when a piece is already offering all twenty. */
const refused = (key: string) =>
  new ApiError(422, "The given data was invalid.", {
    [key]: "Bunny already offers twenty extras.",
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocked.fetchAdminProducts.mockResolvedValue([piece("bunny", "Bunny"), piece("cat", "Cat")]);
});

/* No route param, so the form opens on the create path — which is where all of
   the two-call sequencing lives. */
const renderForm = () => render(<MemoryRouter><ExtraForm /></MemoryRouter>);

/** Fill in the one required field and tick one piece. */
async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Name"), "Gift box");
  await user.click(screen.getByLabelText("Bunny"));
}

describe("saving an extra and its pieces", () => {
  it("creates the extra before it ticks anything onto it", async () => {
    const user = userEvent.setup();

    /* Held open on purpose: the point of the test is what has and hasn't
       happened while the first call is still in flight. */
    let finishCreate: (a: LibraryAddon) => void = () => {};
    mocked.createAddon.mockReturnValue(
      new Promise<LibraryAddon>((resolve) => { finishCreate = resolve; }),
    );
    mocked.setAddonProducts.mockResolvedValue(entry(7, ["bunny"]));

    renderForm();
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Add extra" }));

    await waitFor(() => expect(mocked.createAddon).toHaveBeenCalled());
    // Nothing can be ticked onto an extra the server hasn't made yet.
    expect(mocked.setAddonProducts).not.toHaveBeenCalled();

    await act(async () => { finishCreate(entry(7)); });

    // And the id it ticks them onto is the one the create handed back.
    await waitFor(() => expect(mocked.setAddonProducts).toHaveBeenCalledWith(7, ["bunny"]));
  });

  it("updates the entry it already made rather than making a second one", async () => {
    const user = userEvent.setup();
    mocked.createAddon.mockResolvedValue(entry(7));
    mocked.updateAddon.mockResolvedValue(entry(7));
    mocked.setAddonProducts
      .mockRejectedValueOnce(refused("products"))
      .mockResolvedValueOnce(entry(7, ["bunny"]));

    renderForm();
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Add extra" }));

    /* The extra is in the library now even though the save didn't finish, so the
       screen has to stop offering to add one. */
    expect(await screen.findByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.getByText(/The extra is saved/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mocked.updateAddon).toHaveBeenCalledWith(7, expect.objectContaining({ name: "Gift box" })),
    );
    // The one thing a second create would do is put the extra in the library twice.
    expect(mocked.createAddon).toHaveBeenCalledTimes(1);
  });

  it("puts a refused tick's message on the Used-on list, not at the top", async () => {
    const user = userEvent.setup();
    mocked.createAddon.mockResolvedValue(entry(7));
    // `products.0` names the one piece at fault; both spellings belong here.
    mocked.setAddonProducts.mockRejectedValue(refused("products.0"));

    renderForm();
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Add extra" }));

    const message = await screen.findByText("Bunny already offers twenty extras.");
    const tick = screen.getByLabelText("Bunny");

    // Beside the tick that caused it, which means before it in the document.
    expect(message.compareDocumentPosition(tick) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });
});
