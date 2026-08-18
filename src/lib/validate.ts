/* ==========================================================================
   Validation.

   The messages are written in the shop owner's voice ("I need your Instagram
   handle to confirm your order.") rather than generic form copy. They're part
   of how the page sounds — don't swap them for "This field is required".
   ========================================================================== */

import { CONFIG } from "../config";
import type { Details } from "../shop/store/order";

/** Which error slot the message belongs in, and which field to focus. */
export interface Invalid {
  field: "cart" | "name" | "ig" | "fulfillment" | "address" | "proof";
  message: string;
}

export function validateProducts(count: number): Invalid | null {
  if (count === 0) {
    return { field: "cart", message: "Add at least one piece to continue." };
  }
  return null;
}

export function validateDetails(d: Details): Invalid | null {
  if (!d.name) {
    return { field: "name", message: "Please tell me your name." };
  }
  if (!d.instagram) {
    return { field: "ig", message: "I need your Instagram handle to confirm your order." };
  }
  if (!d.fulfillment) {
    return { field: "fulfillment", message: "Choose meetup or delivery." };
  }
  if (d.fulfillment === "Delivery" && !d.address) {
    return { field: "address", message: "Please enter the full delivery address." };
  }
  return null;
}

export function validatePayment(proofFile: File | null): Invalid | null {
  if (!proofFile) {
    return { field: "proof", message: "Please upload your proof of payment." };
  }
  return null;
}

/* Checked when the file is chosen, not at step submit — the customer should
   find out immediately, while they still have the file picker in mind. */
export function validateProofFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "That's not an image. Please upload a screenshot or photo of your receipt.";
  }
  if (file.size > CONFIG.maxProofMB * 1024 * 1024) {
    return `That file is too big (max ${CONFIG.maxProofMB} MB). Try a screenshot instead of a photo.`;
  }
  return null;
}

export const SUBMIT_FAILED =
  "Something went wrong sending your order. Check your connection and try again — or DM me the details and I'll take it from there.";
