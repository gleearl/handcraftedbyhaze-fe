/* ==========================================================================
   The data contract.

   These three types are the whole seam between this app and whatever is
   serving it. The Laravel API in the other repo needs to satisfy `OrderSource`
   — see README, "The API contract".
   ========================================================================== */

export interface Product {
  /** Unique, and never changes once orders exist. */
  id: string;
  name: string;
  /** Pesos, whole numbers. */
  price: number;
  /** Either "assets/bunny.jpg" (served from public/) or a full https:// URL. */
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
  /** No leading "@" — adapters add it if their destination wants one. */
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

export interface OrderSource {
  /** Rejects on failure; the caller falls back to the bundled product list. */
  fetchProducts(signal: AbortSignal): Promise<Product[]>;
  /** Resolves on success, throws on anything else. */
  submitOrder(payload: OrderPayload): Promise<void>;
}
