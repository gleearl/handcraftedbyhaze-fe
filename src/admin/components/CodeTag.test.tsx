import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CodeTag } from "./CodeTag";

/* userEvent installs its own working clipboard, so these read back what was
   actually copied rather than asserting that a mock was called. */

describe("the code tag", () => {
  it("shows the code", () => {
    render(<CodeTag code="PRD-0007" />);

    expect(screen.getByText("PRD-0007")).toBeTruthy();
  });

  it("copies the code when it is clicked", async () => {
    const user = userEvent.setup();
    render(<CodeTag code="ORD-0042" />);

    await user.click(screen.getByRole("button", { name: /ORD-0042/ }));

    expect(await navigator.clipboard.readText()).toBe("ORD-0042");
  });

  it("says so once a code has been copied", async () => {
    const user = userEvent.setup();
    render(<CodeTag code="EXT-0003" />);

    await user.click(screen.getByRole("button", { name: /EXT-0003/ }));

    expect(await screen.findByText(/copied/i)).toBeTruthy();
  });

  it("renders nothing when a record has no code", () => {
    /* An older backend, or a row the migration has not reached. An empty tag
       would be a smudge on every row; no tag says the same thing quietly. */
    const { container } = render(<CodeTag code="" />);

    expect(container.textContent).toBe("");
  });

  it("keeps showing the code when the clipboard refuses", async () => {
    // Copying needs a secure context. Failing to copy must not blank the tag.
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<CodeTag code="PRD-0009" />);

    await user.click(screen.getByRole("button", { name: /PRD-0009/ }));

    expect(screen.getByText("PRD-0009")).toBeTruthy();
  });
});
