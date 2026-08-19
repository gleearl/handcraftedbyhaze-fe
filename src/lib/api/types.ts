/* ==========================================================================
   The data contract between this app and the Laravel API.

   The customer-facing half (Product, OrderPayload) and the admin half (Order,
   OrderStatus, AdminProduct) both live here so there is one place to look when
   the backend and frontend disagree. See README, "The API contract".
   ========================================================================== */

/** An extra a piece can be ordered with — a flower on a croissant, a gift box. */
export interface Addon {
  /* Which of the three slots this is. Carried rather than inferred from
     position: a cart line keys its extras by slot, so emptying a middle slot
     must not shift the later ones onto different numbers. */
  slot: number;
  name: string;
  /** Pesos, on top of the piece's own price. 0 renders as "Free". */
  price: number;
  /** Optional little photo. Empty string when there isn't one. */
  image: string;
}

/** Three slots in the picker, three columns in the sheet. */
export const MAX_ADDONS = 3;

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
  /* What this piece may be ordered with, in slot order — which is the order
     the picker lists them. Empty means the + adds it straight away. */
  addons: Addon[];
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
  /** Already includes the extras below — they itemise it, not add to it. */
  unitPrice: number;
  addons: { name: string; price: number }[];
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
  /* One entry per slot the form is showing. A blank name means the slot isn't
     used, and the API drops it — which is how an extra is removed. */
  addons: AddonInput[];
}

export interface AddonInput {
  name: string;
  /** Blank means free, which is deliberately distinct from unnamed. */
  price: number | null;
  photo: File | null;
  /** The photo it already has, so the form can show and clear it. */
  image: string;
  removePhoto: boolean;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
}
