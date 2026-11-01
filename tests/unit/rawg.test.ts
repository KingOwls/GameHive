import { describe, it, expect, vi, afterEach } from "vitest";
import {
  catalogRoute,
  normalizeGame,
  normalizeCatalog,
  safeCover,
  limitedJson,
} from "../../supabase/functions/_shared/catalog-contract";
import {
  RawgCatalogProvider,
  createCatalogProvider,
} from "../../src/services/catalog";
import { defaultQuery } from "../../src/features/catalog/curated";
const route = (path: string) =>
  catalogRoute(new URL(`https://edge.invalid/functions/v1/catalog/${path}`));
const game = {
  id: 42,
  name: "A real game",
  released: null,
  rating: 4.2,
  ratings_count: 12,
  description_raw: "Safe <script>alert(1)</script> text",
  background_image: "https://media.rawg.io/media/games/a.jpg",
  genres: [{ name: "RPG" }],
  platforms: [{ platform: { name: "PC" } }],
};
afterEach(() => vi.unstubAllGlobals());
describe("RAWG boundary (isolated fixtures)", () => {
  it("combines bounded filters and canonicalizes cache keys", () => {
    const a = route(
      "games?q=Hades&genre=4&platform=1&year=2020&tag=7&order=year&page=2",
    );
    expect(a.query.get("search_precise")).toBe("true");
    expect(a.query.get("search_exact")).toBe("true");
    expect(a.query.get("dates")).toBe("2020-01-01,2020-12-31");
    expect(a.query.get("parent_platforms")).toBe("1");
    expect(a.query.get("tags")).toBe("7");
    expect(a.key).toBe(
      route(
        "games?page=2&order=year&tag=7&year=2020&platform=1&genre=4&q=Hades",
      ).key,
    );
  });
  it.each([
    "games?key=secret",
    "games?url=https://evil.invalid",
    "games?page=101",
    "games?page=1&page=2",
    "games/0",
    "games/-2",
    "games?q=" + "x".repeat(101),
    "games?genre=action",
    "games?platform=4",
    "games?year=20200",
    "games?order=bad",
    "games/42?tag=1",
    "https://evil.invalid",
  ])("rejects adversarial input %s", (path) =>
    expect(() => route(path)).toThrow(),
  );
  it.each([
    "http://media.rawg.io/a",
    "https://evil.invalid/a",
    "https://media.rawg.io.evil.invalid/a",
    "https://user@media.rawg.io/a",
    "https://media.rawg.io/a?key=secret",
    "javascript:alert(1)",
  ])("rejects unsafe cover %s", (value) => expect(safeCover(value)).toBeNull());
  it("keeps missing dates honest, removes HTML, and separates rating with sample", () => {
    const normalized = normalizeGame(game, true);
    expect(normalized.releasedYear).toBeNull();
    expect(normalized.description).not.toContain("<");
    expect(normalized.externalRating).toEqual({
      value: 4.2,
      scale: 5,
      source: "RAWG",
      sample: 12,
    });
    expect(normalized.id).toBe("rawg:42");
    const complete = normalizeGame(
      {
        ...game,
        slug: "safe-slug",
        tags: [{ name: "Singleplayer" }],
        platforms: [
          {
            platform: { name: "PC" },
            requirements: {
              minimum: "<strong>CPU</strong><br>4 GB RAM",
              recommended: "<script>unsafe()</script>8 GB RAM",
            },
          },
        ],
      },
      true,
    );
    expect(complete.sourceUrl).toBe("https://rawg.io/games/safe-slug");
    expect(complete.tags).toEqual(["Singleplayer"]);
    expect(complete.requirements).toEqual([
      { platform: "PC", minimum: "CPU\n4 GB RAM", recommended: "8 GB RAM" },
    ]);
    expect(normalized.sourceUrl).toBe("https://rawg.io/games/42");
  });
  it.each([
    {},
    null,
    { results: "wrong", count: 1 },
    { results: [{}], count: 1 },
    { results: [], count: -1 },
  ])("rejects invalid provider payload", (payload) =>
    expect(() => normalizeCatalog(payload, route("games"))).toThrow(),
  );
  it("bounds screenshots, rejects arbitrary hosts and excludes paid routes", () => {
    const mediaRoute = route("games/42/screenshots");
    expect(mediaRoute.query.get("page_size")).toBe("3");
    expect(
      normalizeCatalog(
        {
          results: [
            { image: "https://media.rawg.io/media/a.jpg" },
            { image: "https://evil.invalid/a.jpg" },
          ],
        },
        mediaRoute,
      ),
    ).toEqual(["https://media.rawg.io/media/a.jpg"]);
    expect(() => route("games/42/movies")).toThrow();
    expect(() => route("games/42/stores")).toThrow();
    expect(() =>
      route("games/42/screenshots?url=https://evil.invalid"),
    ).toThrow();
  });
  it("bounds streamed body and rejects malformed JSON", async () => {
    await expect(
      limitedJson(new Response("x".repeat(100)), 50),
    ).rejects.toThrow();
    await expect(limitedJson(new Response("not json"))).rejects.toThrow();
  });
  it("uses explicit mode and never sends provider key", async () => {
    expect(createCatalogProvider({}).mode).toBe("curated-offline");
    expect(createCatalogProvider({ VITE_CATALOG_MODE: "rawg" }).mode).toBe(
      "live",
    );
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [], total: 0, page: 1, pageSize: 12 }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const provider = new RawgCatalogProvider({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    });
    await provider.search({ ...defaultQuery, tag: "7", genre: "4" });
    expect(fetch.mock.calls[0][0]).toContain("/catalog/games?");
    expect(fetch.mock.calls[0][0]).not.toContain("key=");
  });
  it.each([429, 500, 503])(
    "preserves provider errors without silently using curated (%s)",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response("https://api.rawg.io/?key=secret", { status }),
          ),
      );
      const provider = new RawgCatalogProvider({
        url: "https://example.supabase.co",
        publishableKey: "sb_publishable_example",
      });
      await expect(provider.search(defaultQuery)).rejects.toThrow();
      await expect(provider.search(defaultQuery)).rejects.not.toThrow(/secret/);
    },
  );
  it("propagates AbortSignal", async () => {
    const fetch = vi.fn().mockImplementation((_url, options) => {
      options.signal.throwIfAborted();
    });
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    controller.abort();
    await expect(
      new RawgCatalogProvider({
        url: "https://example.supabase.co",
        publishableKey: "sb_publishable_example",
      }).search(defaultQuery, controller.signal),
    ).rejects.toThrow();
  });
});

it.each([
  {
    VITE_CATALOG_MODE: "rawg",
    VITE_SUPABASE_URL: "https://example.supabase.co",
  },
  {
    VITE_CATALOG_MODE: "rawg",
    VITE_SUPABASE_URL: "invalid",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  },
  { VITE_CATALOG_MODE: "invalid" },
])(
  "returns recoverable provider for invalid public configuration (%j)",
  async (env) => {
    let provider: ReturnType<typeof createCatalogProvider> | undefined;
    expect(() => {
      provider = createCatalogProvider(env);
    }).not.toThrow();
    expect(provider?.mode).toBe("live");
    await expect(provider!.search(defaultQuery)).rejects.toMatchObject({
      code: "configuration",
    });
  },
);

it("client-to-handler combined filters reach the controlled upstream", async () => {
  const { createCatalogHandler } =
    await import("../../supabase/functions/_shared/catalog-http");
  let received: URL | undefined;
  const upstream = vi.fn().mockImplementation(async (url: URL) => {
    received = url;
    return new Response(JSON.stringify({ count: 0, results: [] }));
  });
  const handler = createCatalogHandler({
    apiKey: () => "isolated-key",
    cached: async () => null,
    reserve: async () => true,
    store: async () => {},
    fetch: upstream,
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation((url: string, init: RequestInit) =>
        handler(new Request(url, init)),
      ),
  );
  const provider = new RawgCatalogProvider({
    url: "https://example.supabase.co",
    publishableKey: "sb_publishable_example",
  });
  await provider.search({
    text: "Hollow Knight",
    genre: "4",
    platform: "1",
    year: "2017",
    tag: "7",
    order: "year",
    page: 2,
  });
  expect(received?.origin).toBe("https://api.rawg.io");
  expect(Object.fromEntries(received!.searchParams)).toMatchObject({
    genres: "4",
    parent_platforms: "1",
    dates: "2017-01-01,2017-12-31",
    tags: "7",
    search: "Hollow Knight",
    search_exact: "true",
    search_precise: "true",
    ordering: "-released",
    page: "2",
  });
});

it("bounds multibyte normalized metadata below the jsonb document allowance", () => {
  const huge = "界😀".repeat(10000),
    names = Array.from({ length: 50 }, () => ({ name: huge }));
  const normalized = normalizeGame(
    {
      ...game,
      name: huge,
      description_raw: huge,
      genres: names,
      tags: names,
      developers: names,
      publishers: names,
      platforms: Array.from({ length: 8 }, () => ({
        platform: { name: huge },
        requirements: { minimum: huge, recommended: huge },
      })),
    },
    true,
  );
  expect(
    new TextEncoder().encode(JSON.stringify(normalized)).length,
  ).toBeLessThanOrEqual(49152);
  expect(normalized.id).toBe("rawg:42");
  expect(normalized.title.length).toBeGreaterThan(0);
  expect(normalized.sourceUrl).toBeTruthy();
  expect(normalized.externalRating).toEqual({
    value: 4.2,
    scale: 5,
    source: "RAWG",
    sample: 12,
  });
});
