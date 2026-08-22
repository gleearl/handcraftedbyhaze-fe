import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAddon, createProduct, fetchAdminProducts, fetchLibrary, fetchOrder, fetchOrders, fetchSettings, saveSettings,
  sendTestEmail, setAddonProducts, setOrderStatus, updateAddon, updateProduct,
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
      id: 7, code: "ORD-0007", reference: "1029", customer_name: "Juan",
      instagram: "juandc", fulfillment: "Delivery", subtotal: "525", status: "new",
      placed_at: "2026-08-18T02:00:00Z", item_count: 3,
    }]}));

    const [order] = await fetchOrders();
    expect(order).toEqual({
      id: 7, code: "ORD-0007", reference: "1029", customerName: "Juan",
      instagram: "juandc", fulfillment: "Delivery", subtotal: 525, status: "new",
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
      { name: "Pink Croissant", quantity: 3, unitPrice: 150, image: "", addons: [] },
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

});

describe("the product form's extras", () => {
  it("sends the ids in order, the index being the position", async () => {
    await createProduct({
      name: "Croissant", price: 175, description: "", available: true, stock: null,
      max: null, freeAddons: 0, isNew: false, photo: null, addons: [9, 3],
    });
    const body = fetchMock.mock.calls.at(-1)![1].body as FormData;

    expect(body.get("addons[0]")).toBe("9");
    expect(body.get("addons[1]")).toBe("3");
    // Something is ticked, so there is nothing to mark cleared.
    expect(body.has("addons_cleared")).toBe(false);
  });

  it("marks an empty list, which multipart can't otherwise say", async () => {
    /* Nothing ticked means no addons[N] fields, and a body with no addons key
       is how the API is told to leave the extras alone. Without the marker,
       unticking the last one would save as a success and change nothing. */
    await updateProduct("croissant", {
      name: "Croissant", price: 175, description: "", available: true, stock: null,
      max: null, freeAddons: 0, isNew: false, photo: null, addons: [],
    });
    const body = fetchMock.mock.calls.at(-1)![1].body as FormData;

    expect(body.has("addons[0]")).toBe(false);
    expect(body.get("addons_cleared")).toBe("1");
  });
});

describe("the library", () => {
  it("reads used_on into usedOn", async () => {
    fetchMock.mockResolvedValueOnce(json({
      data: [{ id: 7, name: "Gift box", price: 150, image: "", used_on: ["croissant"] }],
    }));

    const [entry] = await fetchLibrary();

    expect(entry).toMatchObject({ id: 7, name: "Gift box", price: 150, usedOn: ["croissant"] });
  });

  it("sends a blank price as an empty field, so the server reads it as free", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: { id: 1, name: "Note", price: 0, image: "", used_on: [] } }));

    await createAddon({ name: "Note", price: null, photo: null, image: "", removePhoto: false });

    const body = fetchMock.mock.calls.at(-1)![1].body as FormData;
    expect(body.get("price")).toBe("");
  });

  it("spoofs PATCH on an update, because a photo means multipart", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: { id: 7, name: "Gift box", price: 175, image: "", used_on: [] } }));

    await updateAddon(7, { name: "Gift box", price: 175, photo: null, image: "", removePhoto: false });

    expect((fetchMock.mock.calls.at(-1)![1].body as FormData).get("_method")).toBe("PATCH");
  });

  it("sends the whole list of pieces, so unticking is just not sending one", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: { id: 7, name: "Gift box", price: 150, image: "", used_on: ["bunny"] } }));

    const entry = await setAddonProducts(7, ["bunny"]);

    expect(entry.usedOn).toEqual(["bunny"]);
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

describe("codes", () => {
  it("carries the code the admin files a record under", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [{ id: 7, code: "ORD-0007" }] }));
    expect((await fetchOrders())[0].code).toBe("ORD-0007");

    fetchMock.mockResolvedValueOnce(json({ data: [{ id: "bunny", name: "Bunny", price: 250, code: "PRD-0002" }] }));
    expect((await fetchAdminProducts())[0].code).toBe("PRD-0002");

    fetchMock.mockResolvedValueOnce(json({ data: [{ id: 3, name: "Gift box", code: "EXT-0003" }] }));
    expect((await fetchLibrary())[0].code).toBe("EXT-0003");
  });

  it("leaves the code empty rather than inventing one when it is missing", async () => {
    // An older backend, or a row the migration has not reached yet.
    fetchMock.mockResolvedValueOnce(json({ data: [{ id: 7 }] }));
    expect((await fetchOrders())[0].code).toBe("");
  });
});

describe("order photos", () => {
  it("carries the photo of the piece and of each extra on a line", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: {
      id: 7, subtotal: 400,
      items: [{
        name: "Bunny Buddy", quantity: 1, unit_price: 400,
        image: "/storage/products/bunny.png",
        addons: [{
          name: "Gift box", price: 150, image: "/storage/products/box.png",
          code: "EXT-0007",
        }],
      }],
    }}));

    const order = await fetchOrder(7);
    expect(order.items[0].image).toBe("/storage/products/bunny.png");
    expect(order.items[0].addons[0].image).toBe("/storage/products/box.png");
    expect(order.items[0].addons[0].code).toBe("EXT-0007");
  });

  it("leaves a line without a photo blank rather than showing a broken image", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: {
      id: 7, items: [{ name: "Something delisted", quantity: 1, unit_price: 400 }],
    }}));

    const order = await fetchOrder(7);
    expect(order.items[0].image).toBe("");
  });
});
