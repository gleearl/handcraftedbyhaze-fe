import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOrder, fetchOrders, setOrderStatus, updateProduct } from "./admin";

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
    expect(order.items).toEqual([{ name: "Pink Croissant", quantity: 3, unitPrice: 150 }]);
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
    available: true, stock: null, max: 2, isNew: true, photo: null,
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
