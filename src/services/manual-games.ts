import type { ManualGame, ManualGameInput, Page } from "../domain/models";
import { parsePublicConfig } from "./config";
import { getAuthService } from "./auth";
import { ServiceError } from "./errors";
export interface ManualGamesService {
  search(
    text: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<Page<ManualGame>>;
  get(id: string, signal?: AbortSignal): Promise<ManualGame | null>;
  create(input: ManualGameInput, signal?: AbortSignal): Promise<ManualGame>;
}
export const manualId = (id: string) =>
  /^manual:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
export function createManualGamesService(
  env: Record<string, string | undefined> = import.meta.env,
): ManualGamesService {
  const config = () => {
    const c = parsePublicConfig(env);
    if (!c)
      throw new ServiceError(
        "configuration",
        "Configura Supabase para consultar el catálogo manual.",
      );
    return c;
  };
  const request = async (path: string, init: RequestInit = {}) => {
    const c = config();
    const response = await fetch(`${c.url}${path}`, {
      ...init,
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(12000)])
        : AbortSignal.timeout(12000),
      headers: { apikey: c.publishableKey, ...init.headers },
    });
    if (!response.ok) {
      const messages: Record<number, string | undefined> = {
        400: "Revisa los campos y la fuente HTTPS pública.",
        401: "Inicia sesión de nuevo.",
        403: "No tienes permiso o tu sesión ya no está vigente.",
        409: "Esa fuente ya está registrada. Consulta el catálogo manual.",
        ...(init.method === "POST"
          ? {
              503: "No pudimos confirmar el alta. Consulta el catálogo manual y comprueba la fuente antes de reintentar.",
            }
          : {}),
      };
      throw new ServiceError(
        "unavailable",
        messages[response.status] ??
          "No pudimos completar la operación. Inténtalo de nuevo.",
      );
    }
    return response;
  };
  return {
    async search(text, page, signal) {
      if (
        text.length > 100 ||
        !Number.isInteger(page) ||
        page < 1 ||
        page > 100
      )
        throw new ServiceError(
          "validation",
          "Busca hasta 100 caracteres y páginas de 1 a 100.",
        );
      const params = new URLSearchParams({
        select: "*",
        order: "title.asc,id.asc",
        limit: "12",
        offset: String((page - 1) * 12),
      });
      if (text.trim())
        params.set(
          "title",
          `ilike.*${text.trim().replace(/[\\%_*]/g, "\\$&")}*`,
        );
      const response = await request(`/rest/v1/manual_games?${params}`, {
        signal,
        headers: { Prefer: "count=exact" },
      });
      const items = (await response.json()) as ManualGame[];
      return {
        items,
        total: Number(
          response.headers.get("content-range")?.split("/")[1] ?? items.length,
        ),
        page,
        pageSize: 12,
      };
    },
    async get(id, signal) {
      if (!manualId(id)) return null;
      const response = await request(
        `/rest/v1/manual_games?select=*&id=eq.${encodeURIComponent(id.slice(7))}&limit=1`,
        { signal },
      );
      return ((await response.json()) as ManualGame[])[0] ?? null;
    },
    async create(input, signal) {
      const session = await getAuthService()?.session();
      if (!session)
        throw new ServiceError("unauthorized", "Inicia sesión de nuevo.");
      try {
        const response = await request("/functions/v1/admin-games", {
          method: "POST",
          signal,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        });
        return (await response.json()) as ManualGame;
      } catch (error) {
        if (error instanceof ServiceError) throw error;
        throw new ServiceError(
          "unavailable",
          "No pudimos confirmar el alta. Consulta el catálogo manual y comprueba la fuente antes de reintentar.",
        );
      }
    },
  };
}
