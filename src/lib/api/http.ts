/* ==========================================================================
   The only module that knows about transport.

   Laravel serves both the API and this SPA from one origin, so there is no
   CORS here and no bearer token: the session rides on an httpOnly cookie the
   JS can't read, which is the point — an XSS bug can't walk off with it.

   Everything a component might otherwise handle by status code lives here:
   401 bounces to login, 419 refreshes CSRF and retries once, 422 becomes
   per-field messages.
   ========================================================================== */

import { API_URL } from "../../config";

export const LOGIN_PATH = "/admin/login";

/** Thrown for any non-2xx. Components read `.fieldErrors` for 422s. */
export class ApiError extends Error {
  readonly status: number;
  /** Laravel's `errors` bag flattened to one message per field. */
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export const GENERIC_ERROR = "Something went wrong. Please try again.";
export const OFFLINE_ERROR = "Can't reach the server. Check your connection and try again.";

/* Laravel sets XSRF-TOKEN as a readable cookie; we echo it back in a header so
   it can prove the request came from a page it served, not another site. */
function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

let csrfPrimed = false;

export async function primeCsrf(): Promise<void> {
  await fetch(`${API_URL}/sanctum/csrf-cookie`, { credentials: "same-origin" });
  csrfPrimed = true;
}

/** Called on a 401 so the auth context can drop its user and redirect. */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {};
export function setUnauthorizedHandler(fn: UnauthorizedHandler) { onUnauthorized = fn; }

interface Options {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** A plain object is sent as JSON; FormData is sent as-is. */
  body?: unknown;
  signal?: AbortSignal;
  /** Skip the 401 handler — the login request's own 401 is not a session expiry. */
  allowUnauthorized?: boolean;
}

async function parseBody(res: Response): Promise<unknown> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) return null;
  try { return await res.json(); } catch { return null; }
}

function toApiError(status: number, body: unknown): ApiError {
  const data = (body ?? {}) as { message?: string; errors?: Record<string, string[]> };

  const fieldErrors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(data.errors ?? {})) {
    if (messages?.length) fieldErrors[field] = messages[0];
  }

  // Laravel's 422 `message` is a summary; the field messages are the useful part.
  const message = data.message || (status >= 500 ? GENERIC_ERROR : GENERIC_ERROR);
  return new ApiError(status, message, fieldErrors);
}

async function send(path: string, options: Options): Promise<Response> {
  const { method = "GET", body, signal } = options;
  const isForm = body instanceof FormData;

  const headers: Record<string, string> = { Accept: "application/json" };
  // No Content-Type on multipart — the browser must write the boundary itself,
  // otherwise the file upload silently fails.
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-XSRF-TOKEN"] = csrfToken();

  return fetch(`${API_URL}${path}`, {
    method,
    credentials: "same-origin",
    headers,
    ...(body !== undefined ? { body: isForm ? body : JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  });
}

export async function request<T>(path: string, options: Options = {}): Promise<T> {
  const mutating = (options.method ?? "GET") !== "GET";

  // A mutation before anything has primed the cookie would 419 on its first
  // try; priming up front turns a guaranteed retry into a no-op.
  if (mutating && !csrfPrimed) await primeCsrf();

  let res: Response;
  try {
    res = await send(path, options);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, OFFLINE_ERROR);
  }

  /* 419 means the CSRF token expired — the session may still be perfectly
     good. Refresh the cookie and try once more; a second 419 is real. */
  if (res.status === 419) {
    await primeCsrf();
    try {
      res = await send(path, options);
    } catch {
      throw new ApiError(0, OFFLINE_ERROR);
    }
  }

  if (res.status === 401 && !options.allowUnauthorized) {
    onUnauthorized();
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }

  if (!res.ok) throw toApiError(res.status, await parseBody(res));

  if (res.status === 204) return undefined as T;
  return (await parseBody(res)) as T;
}
