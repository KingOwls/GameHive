import type {
  Game,
  CatalogProvider,
  CatalogQuery,
  Page,
} from "../../domain/models";
// Catálogo editorial reducido. No es una respuesta RAWG ni contiene actividad comunitaria.
const entries: [string, string, number, string[], string[], string, string][] =
  [
    [
      "hollow-knight",
      "Hollow Knight",
      2017,
      ["Metroidvania", "Acción"],
      ["PC", "Consolas"],
      "https://www.hollowknight.com/",
      "Explora un reino subterráneo de insectos, secretos y combates precisos.",
    ],
    [
      "hades",
      "Hades",
      2020,
      ["Roguelike", "Acción"],
      ["PC", "Consolas"],
      "https://www.supergiantgames.com/games/hades/",
      "Intenta escapar del inframundo en una aventura de acción que cambia con cada intento.",
    ],
    [
      "celeste",
      "Celeste",
      2018,
      ["Plataformas"],
      ["PC", "Consolas"],
      "https://www.celestegame.com/",
      "Una escalada de plataformas de precisión sobre los desafíos de alcanzar la cima.",
    ],
    [
      "stardew-valley",
      "Stardew Valley",
      2016,
      ["Simulación", "RPG"],
      ["PC", "Consolas"],
      "https://www.stardewvalley.net/",
      "Cuida una granja y construye una nueva vida en una comunidad rural.",
    ],
    [
      "baldurs-gate-3",
      "Baldur’s Gate 3",
      2023,
      ["RPG"],
      ["PC", "Consolas"],
      "https://baldursgate3.game/",
      "Un RPG de grupo con combates por turnos y decisiones que transforman tu aventura.",
    ],
    [
      "elden-ring",
      "Elden Ring",
      2022,
      ["RPG", "Acción"],
      ["PC", "Consolas"],
      "https://en.bandainamcoent.eu/elden-ring/elden-ring",
      "Recorre las Tierras Intermedias en un mundo abierto de fantasía y desafíos.",
    ],
    [
      "disco-elysium",
      "Disco Elysium",
      2019,
      ["RPG", "Narrativa"],
      ["PC", "Consolas"],
      "https://discoelysium.com/",
      "Investiga un caso mientras construyes la identidad de un detective singular.",
    ],
    [
      "portal-2",
      "Portal 2",
      2011,
      ["Puzles"],
      ["PC", "Consolas"],
      "https://www.thinkwithportals.com/",
      "Resuelve puzles espaciales con portales en las instalaciones de Aperture Science.",
    ],
  ];
export const curatedGames: readonly Game[] = entries.map(
  ([id, title, releasedYear, genres, platforms, sourceUrl, summary]) => ({
    id,
    title,
    releasedYear,
    genres,
    platforms,
    sourceUrl,
    summary,
    sourceLabel: "Sitio oficial",
    externalRating: null,
  }),
);
export const defaultQuery: CatalogQuery = {
  text: "",
  genre: "",
  platform: "",
  year: "",
  order: "title",
  page: 1,
};
export function normalizePage(value: unknown): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}
export class CuratedCatalogProvider implements CatalogProvider {
  readonly mode = "curated-offline" as const;
  async search(query: CatalogQuery, signal?: AbortSignal): Promise<Page<Game>> {
    signal?.throwIfAborted();
    const text = query.text.trim().toLocaleLowerCase("es");
    const items = curatedGames
      .filter(
        (game) =>
          game.title.toLocaleLowerCase("es").includes(text) &&
          (!query.genre || game.genres.includes(query.genre)) &&
          (!query.platform || game.platforms.includes(query.platform)) &&
          (!query.year || String(game.releasedYear) === query.year),
      )
      .sort((a, b) =>
        query.order === "year"
          ? b.releasedYear - a.releasedYear
          : a.title.localeCompare(b.title),
      );
    const page = normalizePage(query.page),
      pageSize = 6;
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total: items.length,
      page,
      pageSize,
    };
  }
  async get(id: string, signal?: AbortSignal): Promise<Game | null> {
    signal?.throwIfAborted();
    return curatedGames.find((game) => game.id === id) ?? null;
  }
}
