import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { catalogRoute } from "../functions/_shared/catalog-contract.ts";
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};
Deno.test({
  name:
    "actual catalog adapter with real DB: expired TTL, Unicode key, bounded multibyte document",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
      prepare: false,
      max: 1,
    });
    const token = crypto.randomUUID();
    const query = `games?q=ttl-${token}`;
    const unicode = `games?${new URLSearchParams({
      q: "界".repeat(100),
      genre: "4",
      platform: "1",
      year: "2020",
      tag: "7",
      order: "year",
      page: "2",
    })}`;
    const gameId = 9000000000 +
      crypto.getRandomValues(new Uint32Array(1))[0] % 900000000;
    const paths = [query, unicode, `games/${gameId}`];
    const keys = paths.map((path) =>
      catalogRoute(new URL(`https://edge.invalid/catalog/${path}`)).key
    );
    const previousFetch = globalThis.fetch;
    let upstreamCalls = 0;
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert(url.origin === "https://api.rawg.io", "fixed upstream origin");
      upstreamCalls++;
      const huge = "界😀".repeat(10000);
      const payload = url.pathname.endsWith(`/${gameId}`)
        ? {
          id: gameId,
          name: huge,
          description_raw: huge,
          rating: 4,
          ratings_count: 9,
          genres: Array.from({ length: 50 }, () => ({ name: huge })),
          tags: Array.from({ length: 50 }, () => ({ name: huge })),
          developers: Array.from({ length: 50 }, () => ({ name: huge })),
          publishers: Array.from({ length: 50 }, () => ({ name: huge })),
          platforms: Array.from(
            { length: 8 },
            () => ({
              platform: { name: huge },
              requirements: { minimum: huge, recommended: huge },
            }),
          ),
        }
        : { count: 0, results: [] };
      // Fixture provider fields are large enough to exceed document limits, under upstream 1MiB.
      if (url.pathname.endsWith(`/${gameId}`)) {
        const short = "界😀".repeat(100);
        for (const field of ["genres", "tags", "developers", "publishers"]) {
          (payload as Record<string, unknown>)[field] = Array.from({
            length: 50,
          }, () => ({ name: short }));
        }
        (payload as Record<string, unknown>).platforms = Array.from(
          { length: 8 },
          () => ({
            platform: { name: short },
            requirements: {
              minimum: "界😀".repeat(600),
              recommended: "界😀".repeat(600),
            },
          }),
        );
      }
      return new Response(JSON.stringify(payload));
    };
    try {
      // Import AFTER fetch stub: this executes the production DB adapter, with no alternate host/bypass.
      const { catalogHandler } = await import(
        "../functions/_shared/catalog.ts"
      );
      await sql`insert into private.catalog_cache(key,payload,expires_at) values(${
        keys[0]
      },${
        sql.json({ items: [], total: 999, page: 1, pageSize: 12 })
      },clock_timestamp()-interval '1 second')`;
      const call = (path: string) =>
        catalogHandler(
          new Request(`https://edge.invalid/functions/v1/catalog/${path}`),
        );
      const first = await call(query);
      assert(first.status === 200, "expired cache refresh status");
      assert(
        (await first.json()).total === 0,
        "expired cache must not be returned",
      );
      assert(
        upstreamCalls === 1,
        "expired cache must reach controlled upstream",
      );
      const second = await call(query);
      assert(
        second.status === 200 && upstreamCalls === 1,
        "fresh cache bypasses upstream",
      );
      assert(
        keys[1].length > 512 && keys[1].length <= 2048,
        "accepted Unicode canonical bound",
      );
      assert(
        (await call(unicode)).status === 200,
        "Unicode query persists through actual adapter",
      );
      const [unicodeCache] =
        await sql`select length(key) as size from private.catalog_cache where key=${
          keys[1]
        }`;
      assert(unicodeCache?.size > 512, "Unicode key stored by DB");
      assert(
        (await call(`games/${gameId}`)).status === 200,
        "oversized valid metadata is normalized and stored",
      );
      const [game] =
        await sql`select octet_length(document::text) as bytes,document from public.games where id=${`rawg:${gameId}`}`;
      assert(
        game?.bytes <= 65536,
        "normalized JSON satisfies actual jsonb DB constraint",
      );
      assert(
        game.document.id === `rawg:${gameId}` &&
          game.document.title.length > 0 && game.document.sourceUrl &&
          game.document.externalRating.value === 4,
        "mandatory fields preserved",
      );
    } finally {
      globalThis.fetch = previousFetch;
      await sql`delete from private.catalog_cache where key in ${sql(keys)}`;
      await sql`delete from public.games where id=${`rawg:${gameId}`}`;
      await sql.end();
    }
  },
});
