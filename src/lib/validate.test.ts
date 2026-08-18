import { describe, expect, it } from "vitest";
import { EMPTY_DETAILS } from "../shop/store/order";
import { validateDetails, validatePayment, validateProducts, validateProofFile } from "./validate";

const details = (over: Partial<typeof EMPTY_DETAILS>) => ({ ...EMPTY_DETAILS, ...over });
const file = (type: string, mb: number) =>
  new File([new Uint8Array(Math.round(mb * 1024 * 1024))], "r.png", { type });

describe("validateProducts", () => {
  it("blocks an empty cart", () => {
    expect(validateProducts(0)).toEqual({ field: "cart", message: "Add at least one piece to continue." });
  });
  it("passes once something is in it", () => {
    expect(validateProducts(1)).toBeNull();
  });
});

describe("validateDetails", () => {
  it("asks for a name first", () => {
    expect(validateDetails(details({}))?.field).toBe("name");
  });

  it("asks for the handle in the shop owner's words", () => {
    expect(validateDetails(details({ name: "Juan" }))).toEqual({
      field: "ig",
      message: "I need your Instagram handle to confirm your order.",
    });
  });

  it("requires a fulfillment choice", () => {
    expect(validateDetails(details({ name: "Juan", instagram: "juan" }))?.field).toBe("fulfillment");
  });

  it("requires an address only for delivery", () => {
    const base = { name: "Juan", instagram: "juan" };
    expect(validateDetails(details({ ...base, fulfillment: "Delivery" }))?.field).toBe("address");
    expect(validateDetails(details({ ...base, fulfillment: "Meetup" }))).toBeNull();
  });
});

describe("validatePayment", () => {
  it("requires the proof", () => {
    expect(validatePayment(null)?.message).toBe("Please upload your proof of payment.");
    expect(validatePayment(file("image/png", 0.1))).toBeNull();
  });
});

describe("validateProofFile", () => {
  it("rejects a non-image", () => {
    expect(validateProofFile(file("application/pdf", 0.1))).toMatch(/not an image/);
  });

  it("rejects anything over the size cap", () => {
    expect(validateProofFile(file("image/png", 6))).toMatch(/too big \(max 5 MB\)/);
  });

  it("accepts an image inside the cap", () => {
    expect(validateProofFile(file("image/jpeg", 1))).toBeNull();
  });
});
