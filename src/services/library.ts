import type {
  LibraryEntry,
  LibraryGame,
  LibraryItem,
  LibraryMarks,
  LibrarySnapshot,
  Page,
  LibraryProfile,
  PublicReview,
} from "../domain/models";
import { getAuthService } from "./auth";
import { parsePublicConfig } from "./config";
import { ServiceError } from "./errors";
export const libraryGameId = (id: string) =>
  /^rawg:[1-9][0-9]*$/.test(id) ||
  /^manual:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class LibraryError extends ServiceError {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super("unavailable", message);
  }
}
const invalid = () =>
  new LibraryError(400, "Revisa los datos de la biblioteca.");
export function validLibraryMarks(value: unknown): value is LibraryMarks {
  if (!value || typeof value !== "object") return false;
  const v = value as LibraryMarks;
  return (
    [null, "wishlist", "playing", "completed", "backlog"].includes(v.state) &&
    typeof v.favorite === "boolean" &&
    typeof v.interested === "boolean" &&
    (v.progress === null ||
      (Number.isInteger(v.progress) && v.progress >= 0 && v.progress <= 100))
  );
}
export function parseLibrarySnapshot(value: unknown): LibrarySnapshot {
  const v = value as LibrarySnapshot;
  const e = v?.entry;
  if (
    !v ||
    !["private", "public"].includes(v.visibility) ||
    !Number.isSafeInteger(v.visibilityVersion) ||
    v.visibilityVersion < 1 ||
    (e !== null &&
      (!e ||
        !uuid.test(e.id) ||
        !uuid.test(e.user_id) ||
        !Number.isSafeInteger(e.version) ||
        e.version < 1 ||
        !validLibraryMarks(e) ||
        !libraryGameId(e.game_id ?? `manual:${e.manual_game_id}`) ||
        (e.game_id !== null) === (e.manual_game_id !== null) ||
        typeof e.created_at !== "string" ||
        !Number.isFinite(Date.parse(e.created_at)) ||
        typeof e.updated_at !== "string" ||
        !Number.isFinite(Date.parse(e.updated_at))))
  )
    throw new LibraryError(503, "No pudimos comprobar el estado guardado.");
  return v;
}
export interface LibraryFilters {
  state?: string;
  favorite?: boolean;
  interested?: boolean;
}
export function createLibraryService(
  env: Record<string, string | undefined> = import.meta.env,
) {
  const request = async (path: string, init: RequestInit = {}) => {
    const c = parsePublicConfig(env);
    if (!c)
      throw new LibraryError(
        503,
        "Configura Supabase para consultar bibliotecas.",
      );
    const session = await getAuthService()?.session();
    try {
      const response = await fetch(`${c.url}${path}`, {
        ...init,
        signal: init.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(12000)])
          : AbortSignal.timeout(12000),
        headers: {
          apikey: c.publishableKey,
          ...(session
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
          ...init.headers,
        },
      });
      if (!response.ok)
        throw new LibraryError(
          response.status,
          (
            {
              400: "Revisa los datos de la biblioteca.",
              401: "Inicia sesión de nuevo.",
              403: "Cuenta o sesión sin acceso a esta biblioteca.",
              409: "La biblioteca cambió. Consulta el estado guardado; tu borrador se conserva.",
            } as Record<number, string>
          )[response.status] ??
            "No pudimos confirmar el cambio. Consulta el estado guardado antes de reintentar.",
        );
      return response;
    } catch (e) {
      if (e instanceof LibraryError) throw e;
      throw new LibraryError(
        503,
        "No pudimos confirmar el resultado. Consulta el estado guardado antes de reintentar.",
      );
    }
  };
  const operation = async (
    operation: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ) =>
    parseLibrarySnapshot(
      await (
        await request("/functions/v1/library", {
          method: "POST",
          body: JSON.stringify({ operation, input }),
          headers: { "Content-Type": "application/json" },
          signal,
        })
      ).json(),
    );
  const pageParams = (page: number, size: number) => {
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      throw invalid();
    return new URLSearchParams({
      limit: String(size),
      offset: String((page - 1) * size),
    });
  };
  const paged = async <T>(
    table: string,
    params: URLSearchParams,
    page: number,
    pageSize: number,
    signal?: AbortSignal,
  ): Promise<Page<T>> => {
    const r = await request(`/rest/v1/${table}?${params}`, {
      signal,
      headers: { Prefer: "count=exact" },
    });
    const items = await r.json();
    const total = Number(r.headers.get("content-range")?.split("/")[1]);
    if (!Array.isArray(items) || !Number.isSafeInteger(total) || total < 0)
      throw new LibraryError(503, "No pudimos leer la página.");
    return { items, total, page, pageSize };
  };
  return {
    settings: (signal?: AbortSignal) => operation("settings", {}, signal),
    own(gameId: string, signal?: AbortSignal) {
      if (!libraryGameId(gameId)) throw invalid();
      return operation("own", { gameId }, signal);
    },
    save(
      gameId: string,
      marks: LibraryMarks,
      entry: LibraryEntry | null,
      signal?: AbortSignal,
    ) {
      if (!libraryGameId(gameId) || !validLibraryMarks(marks)) throw invalid();
      return operation(
        entry ? "update" : "create",
        {
          gameId,
          state: marks.state,
          favorite: marks.favorite,
          interested: marks.interested,
          progress: marks.progress,
          ...(entry ? { id: entry.id, version: entry.version } : {}),
        },
        signal,
      );
    },
    remove(gameId: string, entry: LibraryEntry, signal?: AbortSignal) {
      if (
        !libraryGameId(gameId) ||
        !uuid.test(entry.id) ||
        !Number.isSafeInteger(entry.version)
      )
        throw invalid();
      return operation(
        "remove",
        { gameId, id: entry.id, version: entry.version },
        signal,
      );
    },
    privacy(
      visibility: "private" | "public",
      version: number,
      signal?: AbortSignal,
    ) {
      if (
        !["private", "public"].includes(visibility) ||
        !Number.isSafeInteger(version) ||
        version < 1
      )
        throw invalid();
      return operation("privacy", { visibility, version }, signal);
    },
    async list(
      owner: string,
      page: number,
      filters: LibraryFilters = {},
      signal?: AbortSignal,
    ) {
      if (!uuid.test(owner)) throw invalid();
      const p = pageParams(page, 20);
      p.set("select", "*,games(document),manual_games(*)");
      p.set("user_id", `eq.${owner}`);
      p.set("order", "created_at.desc,id.asc");
      if (filters.state) {
        if (
          ![
            "unclassified",
            "wishlist",
            "playing",
            "completed",
            "backlog",
          ].includes(filters.state)
        )
          throw invalid();
        p.set(
          "state",
          filters.state === "unclassified" ? "is.null" : `eq.${filters.state}`,
        );
      }
      if (filters.favorite) p.set("favorite", "eq.true");
      if (filters.interested) p.set("interested", "eq.true");
      const result = await paged<LibraryItem>(
        "user_library",
        p,
        page,
        20,
        signal,
      );
      for (const item of result.items) {
        parseLibrarySnapshot({
          entry: item,
          visibility: "private",
          visibilityVersion: 1,
        });
        if (
          item.user_id.toLowerCase() !== owner.toLowerCase() ||
          (item.game_id
            ? !item.games?.document ||
              item.games.document.id !== item.game_id ||
              typeof item.games.document.title !== "string"
            : !item.manual_games ||
              item.manual_games.id !== item.manual_game_id ||
              typeof item.manual_games.title !== "string")
        )
          throw new LibraryError(
            503,
            "Metadatos de biblioteca no disponibles.",
          );
      }
      return result;
    },
    async search(text: string, page: number, signal?: AbortSignal) {
      if (text.length > 100) throw invalid();
      const p = pageParams(page, 20);
      p.set("select", "*");
      p.set("order", "title.asc,id.asc");
      if (text.trim())
        p.set("title", `ilike.*${text.trim().replace(/[\\%_*]/g, "\\$&")}*`);
      const result = await paged<LibraryGame>(
        "persisted_library_games",
        p,
        page,
        20,
        signal,
      );
      if (
        result.items.some(
          (g) =>
            !libraryGameId(g.id) ||
            typeof g.title !== "string" ||
            !g.title.trim() ||
            (g.cover_url !== null && typeof g.cover_url !== "string"),
        )
      )
        throw new LibraryError(503, "Catálogo persistido no disponible.");
      return result;
    },
    async profile(
      handle: string,
      signal?: AbortSignal,
    ): Promise<LibraryProfile | null> {
      if (!/^[A-Za-z0-9_]{3,24}$/.test(handle)) return null;
      const p = new URLSearchParams({
        select: "id,username,bio,avatar_key,created_at",
        username_normalized: `eq.${handle.toLowerCase()}`,
        limit: "1",
      });
      const r = await request(`/rest/v1/profiles?${p}`, { signal });
      const rows = await r.json();
      if (!Array.isArray(rows) || rows.length > 1)
        throw new LibraryError(503, "Perfil público no disponible.");
      const row = rows[0] as LibraryProfile | undefined;
      if (
        row &&
        (!uuid.test(row.id) ||
          !/^[A-Za-z0-9_]{3,24}$/.test(row.username) ||
          row.username.toLowerCase() !== handle.toLowerCase() ||
          typeof row.bio !== "string" ||
          Array.from(row.bio).length > 500 ||
          !["hive", "orbit", "spark"].includes(row.avatar_key) ||
          typeof row.created_at !== "string" ||
          !Number.isFinite(Date.parse(row.created_at)))
      )
        throw new LibraryError(503, "Perfil público no disponible.");
      return row ?? null;
    },
    async reviews(owner: string, page: number, signal?: AbortSignal) {
      if (!uuid.test(owner)) throw invalid();
      const p = pageParams(page, 10);
      p.set("select", "*,profiles!author_id(username,avatar_key)");
      p.set("author_id", `eq.${owner}`);
      p.set("order", "created_at.desc,id.asc");
      return paged<PublicReview>("reviews", p, page, 10, signal);
    },
  };
}
export type LibraryService = ReturnType<typeof createLibraryService>;
