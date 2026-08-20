import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { Settings } from "./Settings";
import * as api from "../lib/api/admin";
import { ApiError } from "../lib/api/http";

vi.mock("../lib/api/admin");

const mocked = vi.mocked(api);

const settings = (emails: string[], mailSends = true, mailMailer = "resend") =>
  ({ orderNotificationEmails: emails, mailSends, mailMailer });

beforeEach(() => {
  vi.resetAllMocks();
  mocked.fetchSettings.mockResolvedValue(settings(["haze@example.com"]));
  mocked.saveSettings.mockImplementation(async (emails) => settings(emails));
  mocked.sendTestEmail.mockResolvedValue(["haze@example.com"]);
});

const renderPage = () => render(<MemoryRouter><Settings /></MemoryRouter>);

const save = () => screen.getByRole("button", { name: /save addresses/i });
const testButton = () => screen.getByRole("button", { name: /send test email/i });

describe("the notification address list", () => {
  it("shows the addresses already saved", async () => {
    renderPage();
    expect(await screen.findByDisplayValue("haze@example.com")).toBeInTheDocument();
  });

  it("saves the whole list when an address is added", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByDisplayValue("haze@example.com");

    await user.click(screen.getByRole("button", { name: /add another address/i }));
    await user.type(screen.getByRole("textbox", { name: /email address 2/i }), "helper@example.com");
    await user.click(save());

    await waitFor(() =>
      expect(mocked.saveSettings).toHaveBeenCalledWith(["haze@example.com", "helper@example.com"]));
  });

  it("removing an address takes it out of what gets saved", async () => {
    const user = userEvent.setup();
    mocked.fetchSettings.mockResolvedValue(settings(["haze@example.com", "helper@example.com"]));
    renderPage();

    await user.click(await screen.findByRole("button", { name: /remove haze@example.com/i }));
    await user.click(save());

    await waitFor(() =>
      expect(mocked.saveSettings).toHaveBeenCalledWith(["helper@example.com"]));
  });

  it("says plainly that notifications are off when nobody is listed", async () => {
    mocked.fetchSettings.mockResolvedValue(settings([]));
    renderPage();

    expect(await screen.findByText(/no.*order.*(won't|will not).*email|notifications are off/i))
      .toBeInTheDocument();
  });

  it("puts a rejected address's complaint next to that address", async () => {
    const user = userEvent.setup();
    mocked.saveSettings.mockRejectedValue(new ApiError(422, "The given data was invalid.", {
      "order_notification_emails.1": "That doesn't look like an email address.",
    }));
    renderPage();
    await screen.findByDisplayValue("haze@example.com");

    await user.click(screen.getByRole("button", { name: /add another address/i }));
    await user.type(screen.getByRole("textbox", { name: /email address 2/i }), "nope");
    await user.click(save());

    const complaint = await screen.findByText(/doesn't look like an email address/i);
    // Next to the second row, not the first — a bare list of errors is useless
    // once there is more than one address.
    expect(complaint.closest("[data-row]")).toHaveAttribute("data-row", "1");
  });
});

describe("the test email", () => {
  it("reports who it reached", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByDisplayValue("haze@example.com");

    await user.click(testButton());

    expect(await screen.findByText(/haze@example\.com/)).toBeInTheDocument();
    expect(mocked.sendTestEmail).toHaveBeenCalled();
  });

  it("shows the provider's own reason when the send is refused", async () => {
    const user = userEvent.setup();
    mocked.sendTestEmail.mockRejectedValue(new ApiError(502, "API key is invalid"));
    renderPage();
    await screen.findByDisplayValue("haze@example.com");

    await user.click(testButton());

    expect(await screen.findByText(/API key is invalid/)).toBeInTheDocument();
  });

  it("won't test against addresses that haven't been saved yet", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByDisplayValue("haze@example.com");

    await user.click(screen.getByRole("button", { name: /add another address/i }));

    /* The server sends to the saved list, so testing now would quietly check
       the wrong addresses and report success. */
    expect(testButton()).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: /email address 2/i }), "helper@example.com");
    await user.click(save());

    await waitFor(() => expect(testButton()).toBeEnabled());
    expect(mocked.sendTestEmail).not.toHaveBeenCalled();
  });
});

describe("a server that cannot actually send", () => {
  it("warns before anything is clicked, naming the driver", async () => {
    mocked.fetchSettings.mockResolvedValue(settings(["haze@example.com"], false, "log"));
    renderPage();

    const warning = await screen.findByRole("alert");
    expect(warning).toHaveTextContent(/log/);
    expect(warning).toHaveTextContent(/being sent/i);
    expect(warning).toHaveTextContent(/log file/i);
  });

  it("says nothing when mail is configured properly", async () => {
    renderPage();
    await screen.findByDisplayValue("haze@example.com");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
