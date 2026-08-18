import type { Product } from "./api/types";

/* Shown when the product source can't be reached, so the shop is never empty.
   Worth keeping roughly current for exactly that reason. */
export const FALLBACK_PRODUCTS: Product[] = [
  { id: "p-c", name: "Pink Flower Croissant",     price: 150,
    image: "/assets/pink-flower-croissant.png",     description: "", available: true, stock: 5, isNew: false },
  { id: "w-c", name: "White Flower Croissant",    price: 150,
    image: "/assets/white-flower-croissant.png",    description: "", available: true, stock: 1, max: 1, isNew: false },
  { id: "l-c", name: "Lavender Flower Croissant", price: 150,
    image: "/assets/lavender-flower-croissant.png", description: "", available: true, stock: 5, isNew: false },
];
