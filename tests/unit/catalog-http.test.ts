import { describe, it, expect, vi } from "vitest";
import {
  createCatalogHandler,
  type CatalogBackend,
} from "../../supabase/functions/_shared/catalog-http";
const request = (route = "games", options?: RequestInit) =>
  new Request(`https://edge.invalid/functions/v1/catalog/${route}`, options);
function fixture(overrides: Partial<CatalogBackend> = {}) {
  const backend: CatalogBackend = {
    apiKey: () => "isolated-test-key",
    cached: vi.fn().mockResolvedValue(null),
    reserve: vi.fn().mockResolvedValue(true),
    store: vi.fn().mockResolvedValue(undefined),
    fetch: vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ count: 0, results: [] })),
      ),
    ...overrides,
  };
  return { backend, handler: createCatalogHandler(backend) };
}
describe("catalog HTTP handler with isolated dependencies", () => {
  it("validates before DB or upstream and supports bounded CORS methods", async () => {
    const { backend, handler } = fixture();
    expect(
      (await handler(request("games?url=https://evil.invalid"))).status,
    ).toBe(400);
    expect((await handler(request("games", { method: "POST" }))).status).toBe(
      405,
    );
    expect(
      (await handler(request("games", { method: "OPTIONS" }))).status,
    ).toBe(200);
    expect(backend.cached).not.toHaveBeenCalled();
    expect(backend.fetch).not.toHaveBeenCalled();
  });
  it("missing config is explicit and performs no requests", async () => {
    const { backend, handler } = fixture({ apiKey: () => undefined });
    const result = await handler(request());
    expect(result.status).toBe(503);
    expect(await result.text()).toContain("no configurado");
    expect(backend.reserve).not.toHaveBeenCalled();
  });
  it("cache hits skip reservation and upstream", async () => {
    const { backend, handler } = fixture({
      cached: vi.fn().mockResolvedValue({
        payload: { items: [], total: 0, page: 1, pageSize: 12 },
      }),
    });
    expect((await handler(request())).status).toBe(200);
    expect(backend.reserve).not.toHaveBeenCalled();
    expect(backend.fetch).not.toHaveBeenCalled();
  });
  it("exhausted global quota spends no upstream request", async () => {
    const { backend, handler } = fixture({
      reserve: vi.fn().mockResolvedValue(false),
    });
    expect((await handler(request())).status).toBe(429);
    expect(backend.fetch).not.toHaveBeenCalled();
    expect(backend.store).not.toHaveBeenCalled();
  });
  it.each([429, 500, 502, 503, 302])(
    "sanitizes upstream status %s and retains reservation",
    async (status) => {
      const { backend, handler } = fixture({
        fetch: vi
          .fn()
          .mockResolvedValue(
            new Response("secret-key-and-provider-body", { status }),
          ),
      });
      const response = await handler(request());
      expect(response.status).toBe(status === 429 ? 429 : 502);
      expect(await response.text()).not.toMatch(/secret|provider-body/);
      expect(backend.reserve).toHaveBeenCalledOnce();
      expect(backend.store).not.toHaveBeenCalled();
    },
  );
  it("404 detail becomes honest null, cached without persisting a game", async () => {
    const { backend, handler } = fixture({
      fetch: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    });
    const response = await handler(request("games/42"));
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
    expect(backend.store).toHaveBeenCalledWith(
      expect.any(String),
      null,
      [],
      true,
    );
  });
  it("rejects malformed JSON without exposing body or key", async () => {
    const { backend, handler } = fixture({
      fetch: vi.fn().mockResolvedValue(new Response("isolated-test-key")),
    });
    const response = await handler(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("isolated-test-key");
    expect(backend.store).not.toHaveBeenCalled();
  });
  it("bounds timeout and hides exception URL", async () => {
    const { handler } = fixture({
      timeoutMs: 10,
      fetch: vi
        .fn()
        .mockImplementation(
          (_url, options) =>
            new Promise((_resolve, reject) =>
              options.signal.addEventListener("abort", () =>
                reject(new Error("https://api.rawg.io/?key=isolated-test-key")),
              ),
            ),
        ),
    });
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("isolated-test-key");
  });
  it("uses fixed HTTPS origin, redirect error, and reserves before fetch", async () => {
    const order: string[] = [];
    const { backend, handler } = fixture({
      reserve: vi.fn().mockImplementation(async () => {
        order.push("reserve");
        return true;
      }),
      fetch: vi.fn().mockImplementation(async (url, options) => {
        order.push("fetch");
        expect(url.origin).toBe("https://api.rawg.io");
        expect(options.redirect).toBe("error");
        return new Response(JSON.stringify({ count: 0, results: [] }));
      }),
    });
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(order).toEqual(["reserve", "fetch"]);
    expect(backend.store).toHaveBeenCalledOnce();
    expect(await response.text()).not.toContain("isolated-test-key");
  });
});

it("keeps deadline active after headers while body stalls", async () => {
  let bodyAborted = false;
  const { backend, handler } = fixture({
    timeoutMs: 15,
    fetch: vi.fn().mockImplementation(
      async (_url, options) =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"count":'));
              options.signal.addEventListener("abort", () => {
                bodyAborted = true;
                controller.error(
                  new Error("https://api.rawg.io/?key=isolated-test-key"),
                );
              });
            },
          }),
        ),
    ),
  });
  const start = performance.now();
  const response = await handler(request());
  expect(response.status).toBe(503);
  expect(bodyAborted).toBe(true);
  expect(performance.now() - start).toBeLessThan(1000);
  expect(await response.text()).not.toContain("isolated-test-key");
  expect(backend.store).not.toHaveBeenCalled();
});
