import { ORDER_BACKEND } from "../../config";
import { sheetNetlifySource } from "./sheet-netlify";
import { laravelSource } from "./laravel";
import type { OrderSource } from "./types";

/* One line to switch backends, driven by an env var so it's a Netlify setting
   rather than a code change. */
export const orderSource: OrderSource =
  ORDER_BACKEND === "laravel" ? laravelSource : sheetNetlifySource;

export type { Product, OrderPayload, OrderSource, Fulfillment } from "./types";
