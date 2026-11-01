import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { createCatalogHandler } from "./catalog-http.ts";
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false,
  max: 3,
});
export const catalogHandler = createCatalogHandler({
  apiKey: () => Deno.env.get("RAWG_API_KEY"),
  async cached(key) {
    const [row] =
      await sql`select payload from private.catalog_cache where key=${key} and expires_at>clock_timestamp()`;
    return row ? { payload: row.payload } : null;
  },
  async reserve() {
    const [row] = await sql`select private.catalog_reserve() as allowed`;
    return row.allowed;
  },
  async store(key, payload, games, full) {
    await sql`select private.catalog_store(${key},${
      sql.json(payload as never)
    },${sql.json(games as never)},${full})`;
  },
  fetch,
});
