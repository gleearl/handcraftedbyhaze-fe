/* ==========================================================================
   The data contract between this app and the Laravel API.

   The customer-facing half (Product, OrderPayload) and the admin half (Order,
   OrderStatus, AdminProduct) both live here so there is one place to look when
   the backend and frontend disagree. See README, "The API contract".
   ========================================================================== */

export interface Product {
  /** Unique, and never changes once orders exist. */
  id: string;
  name: string;
  /** Pesos, whole numbers. */
  price: number;
  /** Absolute URL, or a path served from the same origin. */
  image: string;
  description: string;
  /** False renders the piece as "Sold out" rather than hiding it. */
  available: boolean;
  /** How many are left. Undefined means "not tracking it". */
  stock?: number | undefined;
  /** Most one customer may order in a single go. Undefined means no cap. */
  max?: number | undefined;
  isNew: boolean;
}

export type Fulfillment = "Meetup" | "Delivery";

export interface OrderPayload {
  name: string;
  /** No leading "@" — the API adds one if it wants one. */
  instagram: string;
  fulfillment: Fulfillment;
  /** Empty string when fulfillment is "Meetup". */
  address: string;
  notes: string;
  /** Human-readable line items, one per line, with a subtotal line. */
  items: string;
  /** Pesos, whole numbers. */
  subtotal: number;
  /** GCash reference number. Optional for the customer, so often "". */
  reference: string;
  proof: File | null;
}

/* ── Admin ─────────────────────────────────────────────────────────────── */

export const ORDER_STATUSES = ["new", "confirmed", "fulfilled", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/* A snapshot, not a reference. The name and unit price are copied at purchase
   time so that repricing a product never rewrites what someone already paid. */
export interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderSummary {
  id: number;
  reference: string;
  customerName: string;
  instagram: string;
  fulfillment: Fulfillment;
  subtotal: number;
  status: OrderStatus;
  /** ISO 8601. */
  placedAt: string;
  itemCount: number;
}

export interface Order extends OrderSummary {
  address: string;
  notes: string;
  items: OrderItem[];
  /** Auth-gated URL that streams the receipt; null if none was attached. */
  receiptUrl: string | null;
}

/** What the admin sees: everything the shop sees, plus archived pieces. */
export interface AdminProduct extends Product {
  archived: boolean;
}

/** The editable half of a product. `id` is absent when creating. */
export interface ProductInput {
  name: string;
  price: number;
  description: string;
  available: boolean;
  stock: number | null;
  max: number | null;
  isNew: boolean;
  /** A newly chosen file, or null to leave the existing photo alone. */
  photo: File | null;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
}
