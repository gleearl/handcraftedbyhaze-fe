import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchOrder, fetchOrders, fetchSettings, saveSettings, sendTestEmail, setOrderStatus, updateProduct,
} from "./admin";
import { ApiError } from "./http";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(json({}));
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "XSRF-TOKEN=t";
});
afterEach(() => vi.unstubAllGlobals());

describe("order mapping", () => {
  it("accepts Laravel's snake_case and unwraps the data envelope", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [{
      id: 7, reference: "1029", customer_name: "Juan", instagram: "juandc",
      fulfillment: "Delivery", subtotal: "525", status: "new",
      placed_at: "2026-08-18T02:00:00Z", item_count: 3,
    }]}));

    const [order] = await fetchOrders();
    expect(order).toEqual({
      id: 7, reference: "1029", customerName: "Juan", instagram: "juandc",
      fulfillment: "Delivery", subtotal: 525, status: "new",
      placedAt: "2026-08-18T02:00:00Z", itemCount: 3,
    });
  });

  it("defaults an unknown fulfillment to Meetup rather than inventing one", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [{ id: 1, fulfillment: "???" }] }));
    const [order] = await fetchOrders();
    expect(order.fulfillment).toBe("Meetup");
  });

  it("keeps each line item's own unit price, not today's product price", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: {
      id: 7, subtotal: 450, status: "confirmed",
      items: [{ name: "Pink Croissant", quantity: 3, unit_price: 150 }],
      receipt_url: "/api/admin/orders/7/receipt",
    }}));

    const order = await fetchOrder(7);
    expect(order.items).toEqual([
      { name: "Pink Croissant", quantity: 3, unitPrice: 150, addons: [] },
    ]);
    expect(order.receiptUrl).toBe("/api/admin/orders/7/receipt");
  });

  it("reports a missing receipt as null rather than a broken URL", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: { id: 7, items: [] } }));
    expect((await fetchOrder(7)).receiptUrl).toBeNull();
  });

  it("sends a status change as JSON on PATCH", async () => {
    await setOrderStatus(7, "fulfilled");
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("/api/admin/orders/7");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe('{"status":"fulfilled"}');
  });
});

describe("product writes", () => {
  const input = {
    name: "Bunny", price: 250, description: "d",
    available: true, stock: null, max: 2, freeAddons: 0,
    isNew: true, photo: null, addons: [],
  };

  it("spoofs PATCH through POST, because PHP won't parse multipart on PATCH", async () => {
    await updateProduct("bunny", input);
    const [url, init] = fetchMock.mock.calls.at(-1)!;

    expect(url).toBe("/api/admin/products/bunny");
    expect(init.method).toBe("POST");
    expect((init.body as FormData).get("_method")).toBe("PATCH");
  });

  it("sends a blank stock, so 'not tracking it' stays distinct from zero", async () => {
    await updateProduct("bunny", input);
    const body = fetchMock.mock.calls.at(-1)![1].body as FormData;

    expect(body.get("stock")).toBe("");
    expect(body.get("max")).toBe("2");
  });

  it("sends booleans as 1/0 and uses the API's is_new spelling", async () => {
    await updateProduct("bunny", { ...input, available: false });
    const body = fetchMock.mock.calls.at(-1)![1].body as FormData;

    expect(body.get("available")).toBe("0");
    expect(body.get("is_new")).toBe("1");
  });

  it("omits the photo field entirely when no new file was chosen", async () => {
    await updateProduct("bunny", input);
    expect((fetchMock.mock.calls.at(-1)![1].body as FormData).has("photo")).toBe(false);
  });

  it("sends each extra's own slot, whatever order it sits in", async () => {
    /* The index is where it's shown; the slot inside is which extra it is. A
       customer's basket is keyed by the slot, so dragging the gift box to the
       top must not hand it the flower's number. */
    await updateProduct("bunny", {
      ...input,
      addons: [
        { slot: 2, name: "Gift box", price: 50, photo: null, image: "", removePhoto: false },
        { slot: 0, name: "Pink flower", price: 40, photo: null, image: "", removePhoto: false },
      ],
    });
    const body = fetchMock.mock.calls.at(-1)![1].body as FormData;

    expect(body.get("addons[0][slot]")).toBe("2");
    expect(body.get("addons[0][name]")).toBe("Gift box");
    expect(body.get("addons[1][slot]")).toBe("0");
    expect(body.get("addons[1][name]")).toBe("Pink flower");
  });

  it("sends nothing at all for an extra that was removed", async () => {
    // Not being sent is how a slot is deleted server-side.
    await updateProduct("bunny", {
      ...input,
      addons: [{ slot: 1, name: "Gift box", price: 50, photo: null, image: "", removePhoto: false }],
    });
    const body = fetchMock.mock.calls.at(-1)![1].body as FormData;

    expect(body.get("addons[0][slot]")).toBe("1");
    expect(body.get("addons[1][slot]")).toBeNull();
  });

  it("sends a blank price for a free extra, distinct from not naming one", async () => {
    await updateProduct("bunny", {
      ...input,
      addons: [{ slot: 0, name: "Handwritten note", price: null, photo: null, image: "", removePhoto: false }],
    });
    const body = fetchMock.mock.calls.at(-1)![1].body as FormData;

    expect(body.get("addons[0][price]")).toBe("");
  });
});

describe("notification settings", () => {
  it("unwraps the address list and tolerates a response without one", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: {
      order_notification_emails: ["a@b.com"], mail_sends: true, mail_mailer: "resend",
    } }));
    expect(await fetchSettings()).toEqual({
      orderNotificationEmails: ["a@b.com"], mailSends: true, mailMailer: "resend",
    });

    fetchMock.mockResolvedValueOnce(json({ data: {} }));
    expect(await fetchSettings()).toEqual({
      orderNotificationEmails: [], mailSends: true, mailMailer: "",
    });
  });

  it("reports a mailer that transmits nothing", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: {
      order_notification_emails: [], mail_sends: false, mail_mailer: "log",
    } }));
    const settings = await fetchSettings();
    expect(settings.mailSends).toBe(false);
    expect(settings.mailMailer).toBe("log");
  });

  it("saves the list as JSON on PUT under the name Laravel expects", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: {
      order_notification_emails: ["a@b.com"], mail_sends: true, mail_mailer: "resend",
    } }));

    expect((await saveSettings(["a@b.com"])).orderNotificationEmails).toEqual(["a@b.com"]);

    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("/api/admin/settings");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe('{"order_notification_emails":["a@b.com"]}');
  });

  it("reports who the test reached", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: { sent_to: ["a@b.com", "c@d.com"] } }));

    expect(await sendTestEmail()).toEqual(["a@b.com", "c@d.com"]);
    expect(fetchMock.mock.calls.at(-1)![1].method).toBe("POST");
  });

  it("surfaces the provider's own reason when a test send is refused", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: "API key is invalid" }, 502));

    const error = await sendTestEmail().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, message: "API key is invalid" });
  });
});
