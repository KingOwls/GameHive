// Pure contracts shared with isolated tests; no keys, DB or runtime globals.
export class CatalogFault extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
const invalid = () => new CatalogFault(400, "Revisa los filtros del catálogo.");
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CatalogFault(502, "Respuesta del proveedor no válida.");
  }
  return value as Record<string, unknown>;
};
const truncate = (value: string, length: number) =>
  Array.from(value).slice(0, length).join("").replace(/[\uD800-\uDFFF]/gu, "�");
const text = (value: unknown, length = 200) =>
  typeof value === "string"
    ? truncate(
      value.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "").replace(
        /<br\s*\/?>/gi,
        "\n",
      ).replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008]/g, ""),
      length,
    ).trim()
    : "";
const names = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.slice(0, 50).map((item) => text(object(item).name)).filter(Boolean)
    : [];
export function safeCover(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "media.rawg.io" &&
        !url.username && !url.password && !url.search && !url.hash
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function catalogRoute(
  url: URL,
): {
  path: string;
  query: URLSearchParams;
  key: string;
  kind: "search" | "detail" | "taxonomy" | "screenshots";
} {
  if (url.search.length > 1024) throw invalid();
  const parts = url.pathname.split("/").filter(Boolean);
  const catalogIndex = parts.lastIndexOf("catalog");
  const route = parts.slice(catalogIndex + 1).join("/");
  const query = new URLSearchParams();
  let path: string, kind: "search" | "detail" | "taxonomy" | "screenshots";
  if (route === "games") {
    path = "/games";
    kind = "search";
  } else if (/^games\/[1-9]\d{0,9}\/screenshots$/.test(route)) {
    path = `/${route}`;
    kind = "screenshots";
  } else if (/^games\/[1-9]\d{0,9}$/.test(route)) {
    path = `/${route}`;
    kind = "detail";
  } else if (route === "genres" || route === "platforms" || route === "tags") {
    path = route === "platforms" ? "/platforms/lists/parents" : `/${route}`;
    kind = "taxonomy";
  } else throw invalid();
  const allowed = kind === "search"
    ? ["q", "genre", "platform", "year", "tag", "order", "page"]
    : [];
  for (const [key, value] of url.searchParams) {
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) {
      throw invalid();
    }
    if (!value) continue;
    switch (key) {
      case "q":
        if (value.length > 100 || /[\u0000-\u001f]/.test(value)) {
          throw invalid();
        }
        query.set("search", value.trim());
        if (value.trim()) {
          query.set("search_precise", "true");
          query.set("search_exact", "true");
        }
        break;
      case "genre":
      case "platform":
      case "tag":
        if (
          !/^[1-9]\d{0,8}$/.test(value) ||
          (key === "platform" && !["1", "2", "3", "7"].includes(value))
        ) throw invalid();
        query.set(
          { genre: "genres", platform: "parent_platforms", tag: "tags" }[key]!,
          value,
        );
        break;
      case "year":
        if (!/^(19|20)\d{2}$/.test(value)) throw invalid();
        query.set("dates", `${value}-01-01,${value}-12-31`);
        break;
      case "order":
        if (!["title", "year", "rating"].includes(value)) throw invalid();
        query.set(
          "ordering",
          { title: "name", year: "-released", rating: "-rating" }[value]!,
        );
        break;
      case "page":
        if (!/^[1-9]\d{0,2}$/.test(value) || Number(value) > 100) {
          throw invalid();
        }
        query.set("page", value);
        break;
    }
  }
  if (kind === "search") {
    if (!query.has("parent_platforms")) {
      query.set("parent_platforms", "1,2,3,7");
    }
    if (!query.has("ordering")) query.set("ordering", "name");
    if (!query.has("page")) query.set("page", "1");
  }
  if (kind !== "detail") {
    query.set(
      "page_size",
      kind === "taxonomy" ? "40" : kind === "screenshots" ? "3" : "12",
    );
  }
  query.sort();
  return { path, query, key: `${path}?${query}`, kind };
}
// 48 KiB compact JSON leaves room for jsonb's spaces/escaping beneath the 64 KiB DB constraint.
function boundedDocument<T extends object>(document: T): T {
  const optional = [
    "summary",
    "description",
    "genres",
    "platforms",
    "developers",
    "publishers",
    "tags",
    "requirements",
  ];
  const shrink = (value: unknown): unknown => {
    if (typeof value === "string") {
      return truncate(value, Math.floor(Array.from(value).length / 2));
    }
    if (Array.isArray(value)) {
      return value.slice(0, Math.ceil(value.length / 2)).map(shrink);
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, shrink(item)]),
      );
    }
    return value;
  };
  const mutable = document as Record<string, unknown>;
  while (new TextEncoder().encode(JSON.stringify(document)).length > 49152) {
    for (const field of optional) {
      if (field in mutable) mutable[field] = shrink(mutable[field]);
    }
  }
  return document;
}
export function normalizeGame(value: unknown, full: boolean) {
  const row = object(value);
  if (
    !Number.isSafeInteger(row.id) || Number(row.id) <= 0 ||
    Number(row.id) > 9999999999 || typeof row.name !== "string" ||
    !text(row.name)
  ) throw new CatalogFault(502, "Respuesta del proveedor no válida.");
  const release = typeof row.released === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.released) &&
      !Number.isNaN(Date.parse(row.released)) &&
      new Date(row.released).toISOString().slice(0, 10) === row.released
    ? row.released
    : null;
  const summary = full ? text(row.description_raw, 12000) : "";
  return boundedDocument({
    id: `rawg:${row.id}`,
    provider: "rawg",
    externalId: String(row.id),
    title: text(row.name),
    summary: truncate(summary, 400),
    releasedYear: release ? Number(release.slice(0, 4)) : null,
    releasedAt: release,
    genres: names(row.genres),
    platforms: Array.isArray(row.platforms)
      ? row.platforms.slice(0, 30).map((p) =>
        text(object(object(p).platform).name)
      ).filter(Boolean)
      : [],
    coverUrl: safeCover(row.background_image),
    sourceUrl: `https://rawg.io/games/${
      typeof row.slug === "string" &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) && row.slug.length <= 200
        ? row.slug
        : row.id
    }`,
    sourceLabel: "RAWG",
    externalRating:
      typeof row.rating === "number" && Number.isFinite(row.rating) &&
        row.rating >= 0 && row.rating <= 5
        ? {
          value: row.rating,
          scale: 5,
          source: "RAWG",
          sample: Number.isSafeInteger(row.ratings_count) &&
              Number(row.ratings_count) >= 0
            ? Number(row.ratings_count)
            : null,
        }
        : null,
    ...(full
      ? {
        description: summary,
        developers: names(row.developers),
        publishers: names(row.publishers),
        tags: names(row.tags),
        requirements: Array.isArray(row.platforms)
          ? row.platforms.flatMap((item) => {
            const platform = object(item);
            if (
              !platform.requirements ||
              typeof platform.requirements !== "object" ||
              Array.isArray(platform.requirements)
            ) return [];
            const requirements = object(platform.requirements);
            const minimum = text(requirements.minimum, 1800),
              recommended = text(requirements.recommended, 1800);
            return minimum || recommended
              ? [{
                platform: text(object(platform.platform).name),
                minimum,
                recommended,
              }]
              : [];
          }).slice(0, 8)
          : [],
      }
      : {}),
  });
}
export function normalizeCatalog(
  value: unknown,
  route: ReturnType<typeof catalogRoute>,
): unknown {
  if (route.kind === "detail") return normalizeGame(value, true);
  const row = object(value);
  if (
    !Array.isArray(row.results) ||
    row.results.length >
      (route.kind === "taxonomy" ? 40 : route.kind === "screenshots" ? 3 : 12)
  ) throw new CatalogFault(502, "Respuesta del proveedor no válida.");
  if (route.kind === "screenshots") {
    return row.results.map((item) => safeCover(object(item).image)).filter((
      url,
    ): url is string => url !== null);
  }
  if (route.kind === "taxonomy") {
    return row.results.filter((item) =>
      route.path !== "/platforms/lists/parents" ||
      [1, 2, 3, 7].includes(Number(object(item).id))
    ).map((item) => {
      const entry = object(item);
      if (
        !Number.isSafeInteger(entry.id) || Number(entry.id) <= 0 ||
        !text(entry.name)
      ) throw new CatalogFault(502, "Taxonomía no válida.");
      return { id: String(entry.id), name: text(entry.name) };
    });
  }
  if (!Number.isSafeInteger(row.count) || Number(row.count) < 0) {
    throw new CatalogFault(502, "Respuesta del proveedor no válida.");
  }
  return {
    items: row.results.map((item) => normalizeGame(item, false)),
    total: row.count,
    page: Number(route.query.get("page") ?? 1),
    pageSize: 12,
  };
}
export async function limitedJson(
  response: Response,
  limit = 1048576,
): Promise<unknown> {
  if (
    Number(response.headers.get("content-length")) > limit || !response.body
  ) throw new CatalogFault(502, "Respuesta del proveedor no válida.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        throw new CatalogFault(
          502,
          "Respuesta del proveedor demasiado grande.",
        );
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new CatalogFault(502, "Respuesta del proveedor no válida.");
  }
}
