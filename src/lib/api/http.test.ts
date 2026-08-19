import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, request, setUnauthorizedHandler } from "./http";

/* The module keeps a "have we primed CSRF yet" flag, so each test gets a fresh
   copy — otherwise the first test's priming hides the behaviour of the next.
   Note the copy brings its own ApiError class, so assert against `http.ApiError`
   rather than the one imported at the top of this file. */
async function freshHttp() {
  vi.resetModules();
  return import("./http");
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  });

const empty = (status: number) => new Response(null, { status });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  document.cookie = "XSRF-TOKEN=tok-123";
});

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(() => {});
});

describe("request", () => {
  it("returns the parsed body on success", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [1, 2] }));
    await expect(request("/api/products")).resolves.toEqual({ data: [1, 2] });
  });

  it("sends credentials so the session cookie rides along", async () => {
    fetchMock.mockResolvedValueOnce(json({}));
    await request("/api/products");
    // "include", because the API is a different origin — "same-origin" would
    // quietly drop the cookie and every gated call would 401.
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include" });
  });

  it("never sets Content-Type on FormData, so the browser writes the boundary", async () => {
    const http = await freshHttp();
    fetchMock.mockResolvedValue(json({}));

    const body = new FormData();
    body.append("name", "Bunny");
    await http.request("/api/admin/products", { method: "POST", body });

    const init = fetchMock.mock.calls.at(-1)![1];
    expect(init.headers).not.toHaveProperty("Content-Type");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("sends JSON with a Content-Type when the body is a plain object", async () => {
    const http = await freshHttp();
    fetchMock.mockResolvedValue(json({}));
    await http.request("/admin/login", { method: "POST", body: { email: "a@b.c" } });

    const init = fetchMock.mock.calls.at(-1)![1];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe('{"email":"a@b.c"}');
  });

  it("echoes the XSRF cookie back as a header on mutations", async () => {
    const http = await freshHttp();
    fetchMock.mockResolvedValue(json({}));
    await http.request("/api/admin/orders/1", { method: "PATCH", body: { status: "confirmed" } });

    expect(fetchMock.mock.calls.at(-1)![1].headers["X-XSRF-TOKEN"]).toBe("tok-123");
  });

  it("primes the CSRF cookie before the first mutation", async () => {
    const http = await freshHttp();
    fetchMock.mockResolvedValue(json({}));
    await http.request("/api/admin/products", { method: "POST", body: {} });

    expect(fetchMock.mock.calls[0][0]).toContain("/sanctum/csrf-cookie");
    expect(fetchMock.mock.calls[1][0]).toContain("/api/admin/products");
  });

  it("does not prime before a plain GET", async () => {
    const http = await freshHttp();
    fetchMock.mockResolvedValue(json({}));
    await http.request("/api/products");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/products");
  });
});

describe("419 — an expired CSRF token", () => {
  it("refreshes the cookie and retries exactly once", async () => {
    const http = await freshHttp();
    await http.primeCsrf();
    fetchMock.mockClear();

    fetchMock
      .mockResolvedValueOnce(empty(419))    // the doomed first attempt
      .mockResolvedValueOnce(json({}))      // re-priming
      .mockResolvedValueOnce(json({ ok: true }));

    await expect(http.request("/api/admin/products", { method: "POST", body: {} }))
      .resolves.toEqual({ ok: true });

    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual([
      "/api/admin/products", "/sanctum/csrf-cookie", "/api/admin/products",
    ]);
  });

  it("gives up after a second 419 rather than looping", async () => {
    const http = await freshHttp();
    await http.primeCsrf();
    fetchMock.mockClear();

    fetchMock
      .mockResolvedValueOnce(empty(419))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(empty(419));

    await expect(http.request("/api/admin/products", { method: "POST", body: {} }))
      .rejects.toBeInstanceOf(http.ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("401 — an expired session", () => {
  it("calls the unauthorized handler and throws", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValueOnce(empty(401));

    await expect(request("/api/admin/orders")).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("leaves the handler alone when the caller expects a 401", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValueOnce(json({ message: "Bad credentials" }, 401));

    // A wrong password is not a session expiry, so it must not sign anyone out.
    await expect(request("/admin/login", { allowUnauthorized: true })).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe("422 — validation", () => {
  it("flattens Laravel's errors bag to one message per field", async () => {
    fetchMock.mockResolvedValueOnce(json({
      message: "The given data was invalid.",
      errors: { name: ["The name field is required.", "second, ignored"], price: ["Nope."] },
    }, 422));

    const err = (await request("/api/admin/products").catch((e) => e)) as ApiError;
    expect(err.status).toBe(422);
    expect(err.fieldErrors).toEqual({ name: "The name field is required.", price: "Nope." });
  });
});

describe("transport failures", () => {
  it("reports a network failure as status 0", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const err = (await request("/api/products").catch((e) => e)) as ApiError;
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/Can't reach the server/);
  });

  it("lets an abort propagate untouched, so callers can ignore it", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    await expect(request("/api/products")).rejects.toBeInstanceOf(DOMException);
  });

  it("returns undefined for 204 rather than trying to parse a body", async () => {
    fetchMock.mockResolvedValueOnce(empty(204));
    await expect(request("/api/admin/products/x")).resolves.toBeUndefined();
  });
});
