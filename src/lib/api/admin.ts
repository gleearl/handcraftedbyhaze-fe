/* ==========================================================================
   The admin half of the API. Every call here is behind auth:sanctum — the
   session cookie does the proving, so there is nothing to attach by hand.
   ========================================================================== */

import { primeCsrf, request } from "./http";
import { normalizeImage } from "./image";
import { toProduct, unwrap } from "./shop";
import type {
  AdminProduct, AdminUser, Order, OrderStatus, OrderSummary, ProductInput, Settings,
} from "./types";

/* ── Session ───────────────────────────────────────────────────────────── */

/** Resolves to null when nobody is signed in, rather than throwing. */
export async function me(): Promise<AdminUser | null> {
  try {
    const body = await request<{ data?: AdminUser } | AdminUser>(
      "/api/admin/me", { allowUnauthorized: true },
    );
    return ((body as { data?: AdminUser })?.data ?? body) as AdminUser;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<AdminUser> {
  // Laravel needs the XSRF cookie in hand before it will accept the POST.
  await primeCsrf();
  const body = await request<{ data?: AdminUser } | AdminUser>("/admin/login", {
    method: "POST",
    body: { email, password },
    allowUnauthorized: true, // a wrong password is not an expired session
  });
  return ((body as { data?: AdminUser })?.data ?? body) as AdminUser;
}

export async function logout(): Promise<void> {
  await request<unknown>("/admin/logout", { method: "POST" });
}

/* ── Orders ────────────────────────────────────────────────────────────── */

const toSummary = (r: Record<string, unknown>): OrderSummary => ({
  id: Number(r.id),
  reference: String(r.reference ?? ""),
  customerName: String(r.customer_name ?? r.customerName ?? r.name ?? ""),
  instagram: String(r.instagram ?? ""),
  fulfillment: r.fulfillment === "Delivery" ? "Delivery" : "Meetup",
  subtotal: Math.round(Number(r.subtotal ?? 0)),
  status: (r.status as OrderStatus) ?? "new",
  placedAt: String(r.placed_at ?? r.placedAt ?? r.created_at ?? ""),
  itemCount: Number(r.item_count ?? r.itemCount ?? 0),
});

export async function fetchOrders(signal?: AbortSignal): Promise<OrderSummary[]> {
  const body = await request<unknown>("/api/admin/orders", signal ? { signal } : {});
  return unwrap(body).map((r) => toSummary(r as Record<string, unknown>));
}

export async function fetchOrder(id: number, signal?: AbortSignal): Promise<Order> {
  const body = await request<unknown>(`/api/admin/orders/${id}`, signal ? { signal } : {});
  const r = (((body as { data?: unknown })?.data ?? body) ?? {}) as Record<string, unknown>;
  const rawItems = Array.isArray(r.items) ? r.items : [];

  return {
    ...toSummary(r),
    address: String(r.address ?? ""),
    notes: String(r.notes ?? ""),
    items: rawItems.map((i) => {
      const item = i as Record<string, unknown>;
      const addons = Array.isArray(item.addons) ? item.addons : [];

      return {
        name: String(item.name ?? ""),
        quantity: Number(item.quantity ?? 0),
        // Already includes the extras below — they itemise it, not add to it.
        unitPrice: Math.round(Number(item.unit_price ?? item.unitPrice ?? 0)),
        addons: addons.map((a) => {
          const addon = (a ?? {}) as Record<string, unknown>;
          return {
            name: String(addon.name ?? ""),
            price: Math.round(Number(addon.price ?? 0)) || 0,
          };
        }),
      };
    }),
    receiptUrl: r.receipt_url || r.receiptUrl
      ? normalizeImage(String(r.receipt_url ?? r.receiptUrl))
      : null,
  };
}

export async function setOrderStatus(id: number, status: OrderStatus): Promise<void> {
  await request<unknown>(`/api/admin/orders/${id}`, { method: "PATCH", body: { status } });
}

/* ── Products ──────────────────────────────────────────────────────────── */

const toAdminProduct = (r: Record<string, unknown>): AdminProduct | null => {
  const base = toProduct(r);
  if (!base) return null;
  return { ...base, archived: r.archived === true || r.deleted_at != null };
};

export async function fetchAdminProducts(signal?: AbortSignal): Promise<AdminProduct[]> {
  const body = await request<unknown>("/api/admin/products", signal ? { signal } : {});
  return unwrap(body)
    .map((r) => toAdminProduct(r as Record<string, unknown>))
    .filter((p): p is AdminProduct => p !== null);
}

/* Multipart even when no photo changed: a product carries a file field, and
   sending one shape always is simpler than branching on whether it's there. */
function toFormData(input: ProductInput, method?: "PATCH"): FormData {
  const data = new FormData();
  data.append("name", input.name);
  data.append("price", String(input.price));
  data.append("description", input.description);
  data.append("available", input.available ? "1" : "0");
  data.append("is_new", input.isNew ? "1" : "0");
  data.append("stock", input.stock === null ? "" : String(input.stock));
  data.append("max", input.max === null ? "" : String(input.max));
  data.append("free_addons", String(input.freeAddons));
  if (input.photo) data.append("photo", input.photo, input.photo.name);

  /* Two different numbers, and the difference is the whole design. The index
     is where the extra is shown, so the order these go out in is the order the
     owner arranged. The slot inside is which extra it *is* — a cart keys a
     chosen combination by it, so it travels with the row rather than being
     read off its position. An extra is removed by not being sent. */
  input.addons.forEach((addon, position) => {
    data.append(`addons[${position}][slot]`, String(addon.slot));
    data.append(`addons[${position}][name]`, addon.name.trim());
    data.append(`addons[${position}][price]`, addon.price === null ? "" : String(addon.price));
    if (addon.photo) data.append(`addons[${position}][photo]`, addon.photo, addon.photo.name);
    if (addon.removePhoto) data.append(`addons[${position}][remove_photo]`, "1");
  });
  // PHP doesn't parse a multipart body on PATCH, so Laravel reads this instead.
  if (method) data.append("_method", method);
  return data;
}

export async function createProduct(input: ProductInput): Promise<void> {
  await request<unknown>("/api/admin/products", { method: "POST", body: toFormData(input) });
}

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  await request<unknown>(`/api/admin/products/${id}`, {
    method: "POST",              // spoofed to PATCH by _method
    body: toFormData(input, "PATCH"),
  });
}

/**
 * The new arrangement, top to bottom. Only the ids sent move — the archived
 * pieces the list shows apart aren't arrangeable and keep where they were.
 */
export async function reorderProducts(ids: string[]): Promise<void> {
  await request<unknown>("/api/admin/products/order", { method: "PATCH", body: { ids } });
}

/** Archive, not delete — past orders still name this piece. */
export async function archiveProduct(id: string): Promise<void> {
  await request<unknown>(`/api/admin/products/${id}`, { method: "DELETE" });
}

/**
 * The undo for that: back in the shop, at the bottom of the list.
 *
 * Not back where it was — while it was hidden the pieces around it were
 * renumbered, so the server lands it past the last one and the owner drags it
 * from there.
 */
export async function restoreProduct(id: string): Promise<void> {
  await request<unknown>(`/api/admin/products/${id}/restore`, { method: "POST" });
}

/* ── Settings ──────────────────────────────────────────────────────────── */

const toSettings = (body: unknown): Settings => {
  const data = (((body as { data?: unknown })?.data ?? body) ?? {}) as Record<string, unknown>;
  const emails = data.order_notification_emails;

  return {
    orderNotificationEmails: Array.isArray(emails) ? emails.map(String) : [],
    /* Absent means an older backend that can't tell us, not a broken one —
       default to quiet rather than crying wolf about a server we can't read. */
    mailSends: data.mail_sends !== false,
    mailMailer: data.mail_mailer == null ? "" : String(data.mail_mailer),
  };
};

export async function fetchSettings(signal?: AbortSignal): Promise<Settings> {
  return toSettings(await request<unknown>("/api/admin/settings", signal ? { signal } : {}));
}

/**
 * The whole list, every time — an address is removed by not being sent.
 *
 * The server does the trimming, lowercasing and de-duplicating, and hands back
 * what it stored, so the form shows the addresses as they will actually be used
 * rather than as they were typed.
 */
export async function saveSettings(emails: string[]): Promise<Settings> {
  return toSettings(await request<unknown>("/api/admin/settings", {
    method: "PUT",
    body: { order_notification_emails: emails },
  }));
}

/**
 * Send the real notification, filled with a made-up order, to the saved list.
 *
 * Unlike a live order's email this one is sent inside the request, so a refused
 * send throws an ApiError carrying the provider's own message. That is the only
 * place delivery problems are visible — a real notification that fails is
 * logged on the server and nowhere else.
 *
 * @returns the addresses it reached.
 */
export async function sendTestEmail(): Promise<string[]> {
  const body = await request<unknown>("/api/admin/settings/test-email", { method: "POST" });
  const data = (((body as { data?: unknown })?.data ?? body) ?? {}) as Record<string, unknown>;

  return Array.isArray(data.sent_to) ? data.sent_to.map(String) : [];
}
