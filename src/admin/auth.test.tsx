import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import AdminApp from "./AdminApp";
import * as api from "../lib/api/admin";

vi.mock("../lib/api/admin");

const mocked = vi.mocked(api);
const USER = { id: 1, name: "Haze", email: "haze@example.com" };

beforeEach(() => {
  vi.resetAllMocks();
  mocked.fetchOrders.mockResolvedValue([]);
  mocked.fetchAdminProducts.mockResolvedValue([]);
  mocked.fetchSettings.mockResolvedValue({ orderNotificationEmails: [], mailSends: true, mailMailer: "resend" });
});

/* Mounted under "/admin/*" exactly as routes.tsx does — AdminApp's own routes
   are relative to that parent, so rendering it bare would match nothing. */
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </MemoryRouter>,
  );

describe("admin auth gate", () => {
  it("shows the login form when nobody is signed in", async () => {
    mocked.me.mockResolvedValue(null);
    renderAt("/admin/orders");

    expect(await screen.findByRole("heading", { name: "Shop admin" })).toBeInTheDocument();
  });

  it("waits for /me before deciding, so a signed-in reload doesn't flash login", async () => {
    // Never settles: the gate must sit in its checking state rather than assume.
    mocked.me.mockReturnValue(new Promise(() => {}));
    renderAt("/admin/orders");

    expect(await screen.findByText(/Checking your session/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Shop admin" })).not.toBeInTheDocument();
  });

  it("lets a signed-in owner straight through to the orders inbox", async () => {
    mocked.me.mockResolvedValue(USER);
    renderAt("/admin/orders");

    expect(await screen.findByRole("heading", { name: "Orders" })).toBeInTheDocument();
  });

  it("returns to the page that was asked for after signing in", async () => {
    mocked.me.mockResolvedValue(null);
    mocked.login.mockResolvedValue(USER);
    renderAt("/admin/products");

    await screen.findByRole("heading", { name: "Shop admin" });
    await userEvent.type(screen.getByLabelText("Email"), "haze@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    // Products, not the orders default — the deep link survived the detour.
    expect(await screen.findByRole("heading", { name: "Products" })).toBeInTheDocument();
  });

  it("keeps a failed sign-in on the form with one vague message", async () => {
    mocked.me.mockResolvedValue(null);
    const { ApiError } = await import("../lib/api/http");
    mocked.login.mockRejectedValue(new ApiError(422, "nope"));
    renderAt("/admin/login");

    await userEvent.type(await screen.findByLabelText("Email"), "haze@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    // Never "no such user" vs "wrong password" — that enumerates accounts.
    expect(alert).toHaveTextContent("That email and password don't match.");
  });

  it("signs out even when the logout call fails", async () => {
    mocked.me.mockResolvedValue(USER);
    mocked.logout.mockRejectedValue(new Error("network"));
    renderAt("/admin/orders");

    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    // Leaving someone apparently signed in after they asked not to be is worse
    // than a failed request.
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Shop admin" })).toBeInTheDocument());
  });
});

describe("the settings screen", () => {
  it("is reachable from the nav and deep-linkable", async () => {
    const user = userEvent.setup();
    mocked.me.mockResolvedValue(USER);
    renderAt("/admin/orders");

    await user.click(await screen.findByRole("link", { name: "Settings" }));
    expect(await screen.findByRole("heading", { name: "Order notifications" })).toBeInTheDocument();

    renderAt("/admin/settings");
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { name: "Order notifications" })).toHaveLength(2));
  });
});
