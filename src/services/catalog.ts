import type {
  CatalogProvider,
  CatalogQuery,
  CatalogTaxonomy,
  CatalogTerm,
  Game,
  Page,
} from "../domain/models";
import { CuratedCatalogProvider } from "../features/catalog/curated";
import { parsePublicConfig, type PublicConfig } from "./config";
import { ServiceError } from "./errors";
export class RawgCatalogProvider implements CatalogProvider {
  readonly mode = "live" as const;
  constructor(
    private config: PublicConfig | null,
    private configurationError?: ServiceError,
  ) {}
  private async request(path: string, signal?: AbortSignal): Promise<unknown> {
    if (this.configurationError) throw this.configurationError;
    if (!this.config)
      throw new ServiceError(
        "configuration",
        "Configura el servidor de catálogo RAWG.",
      );
    const response = await fetch(
      `${this.config.url}/functions/v1/catalog/${path}`,
      { signal, headers: { apikey: this.config.publishableKey } },
    );
    if (!response.ok)
      throw new ServiceError(
        response.status === 429 ? "rate_limit" : "unavailable",
        response.status === 429
          ? "Límite de catálogo alcanzado. Inténtalo más tarde."
          : response.status === 503
            ? "Catálogo RAWG no disponible o sin configurar. Inténtalo de nuevo."
            : "No pudimos consultar RAWG. Revisa los filtros o reintenta.",
      );
    try {
      return await response.json();
    } catch {
      throw new ServiceError(
        "unavailable",
        "Respuesta del catálogo no válida.",
      );
    }
  }
  async search(query: CatalogQuery, signal?: AbortSignal): Promise<Page<Game>> {
    const params = new URLSearchParams({
      order: query.order,
      page: String(query.page),
    });
    for (const [key, value] of Object.entries({
      q: query.text,
      genre: query.genre,
      platform: query.platform,
      year: query.year,
      tag: query.tag,
    }))
      if (value) params.set(key, value);
    return (await this.request(`games?${params}`, signal)) as Page<Game>;
  }
  async get(id: string, signal?: AbortSignal): Promise<Game | null> {
    if (!/^rawg:[1-9]\d{0,9}$/.test(id)) return null;
    return (await this.request(`games/${id.slice(5)}`, signal)) as Game | null;
  }
  async screenshots(id: string, signal?: AbortSignal): Promise<string[]> {
    if (!/^rawg:[1-9]\d{0,9}$/.test(id)) return [];
    return (await this.request(
      `games/${id.slice(5)}/screenshots`,
      signal,
    )) as string[];
  }
  async taxonomy(signal?: AbortSignal): Promise<CatalogTaxonomy> {
    const [genres, platforms, tags] = await Promise.all(
      ["genres", "platforms", "tags"].map(
        (path) => this.request(path, signal) as Promise<CatalogTerm[]>,
      ),
    );
    return { genres, platforms, tags };
  }
}
export function createCatalogProvider(
  env: Record<string, string | undefined>,
): CatalogProvider {
  if (!env.VITE_CATALOG_MODE || env.VITE_CATALOG_MODE === "curated")
    return new CuratedCatalogProvider();
  if (env.VITE_CATALOG_MODE !== "rawg")
    return new RawgCatalogProvider(
      null,
      new ServiceError("configuration", "El modo de catálogo no es válido."),
    );
  try {
    return new RawgCatalogProvider(parsePublicConfig(env));
  } catch {
    return new RawgCatalogProvider(
      null,
      new ServiceError(
        "configuration",
        "La configuración pública del catálogo RAWG es inválida.",
      ),
    );
  }
}
