import { describe, it, expect } from "vitest";
import {
  CuratedCatalogProvider,
  curatedGames,
  defaultQuery,
  normalizePage,
} from "../../src/features/catalog/curated";
const provider = new CuratedCatalogProvider();
describe("Contrato catálogo curado", () => {
  it("declara el modo degradado y nunca inventa ratings", () => {
    expect(provider.mode).toBe("curated-offline");
    expect(curatedGames).toHaveLength(8);
    expect(
      curatedGames.every(
        (game) =>
          game.externalRating === null && game.sourceUrl.startsWith("https://"),
      ),
    ).toBe(true);
  });
  it("combina texto, género, plataforma y año", async () => {
    const result = await provider.search({
      ...defaultQuery,
      text: "HADES",
      genre: "Acción",
      platform: "PC",
      year: "2020",
    });
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe("hades");
  });
  it("no mezcla páginas ni pierde registros", async () => {
    const a = await provider.search(defaultQuery),
      b = await provider.search({ ...defaultQuery, page: 2 });
    expect(new Set([...a.items, ...b.items].map((game) => game.id)).size).toBe(
      8,
    );
  });
  it("devuelve null para detalle inexistente y vacío para búsqueda", async () => {
    expect(await provider.get("missing")).toBe(null);
    expect(
      (await provider.search({ ...defaultQuery, text: "zzzz" })).total,
    ).toBe(0);
  });
  it("respeta cancelación", async () => {
    const c = new AbortController();
    c.abort();
    await expect(provider.search(defaultQuery, c.signal)).rejects.toThrow();
  });
});

it.each([1.5, Infinity, -1, 0, NaN, "abc"])(
  "normaliza paginación adversarial %s",
  (value) => expect(normalizePage(value)).toBe(1),
);
