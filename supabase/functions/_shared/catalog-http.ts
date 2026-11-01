import {
  CatalogFault,
  catalogRoute,
  limitedJson,
  normalizeCatalog,
} from "./catalog-contract.ts";
export interface CatalogBackend {
  apiKey(): string | undefined;
  cached(key: string): Promise<{ payload: unknown } | null>;
  reserve(): Promise<boolean>;
  store(
    key: string,
    payload: unknown,
    games: unknown[],
    full: boolean,
  ): Promise<void>;
  fetch: typeof fetch;
  timeoutMs?: number;
}
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
export function createCatalogHandler(backend: CatalogBackend) {
  return async (request: Request): Promise<Response> => {
    const reply = (status: number, data: unknown) =>
      new Response(JSON.stringify(data), { status, headers });
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "GET") {
      return reply(405, { error: "Método no permitido." });
    }
    try {
      const route = catalogRoute(new URL(request.url));
      const apiKey = backend.apiKey();
      if (!apiKey) {
        return reply(503, {
          error: "Catálogo RAWG no configurado en el servidor.",
        });
      }
      const cached = await backend.cached(route.key);
      if (cached) return reply(200, cached.payload);
      if (!await backend.reserve()) {
        throw new CatalogFault(
          429,
          "Límite de catálogo alcanzado. Inténtalo más tarde.",
        );
      }
      const upstream = new URL(`https://api.rawg.io/api${route.path}`);
      upstream.search = route.query.toString();
      upstream.searchParams.set("key", apiKey);
      // Deadline covers headers AND body. Redirects never forward the provider key.
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        backend.timeoutMs ?? 8000,
      );
      const onAbort = () => controller.abort();
      request.signal.addEventListener("abort", onAbort, { once: true });
      if (request.signal.aborted) controller.abort();
      let payload: unknown;
      try {
        const response = await backend.fetch(upstream, {
          signal: controller.signal,
          redirect: "error",
        });
        if (response.status === 404 && route.kind === "detail") payload = null;
        else {
          if (!response.ok) {
            throw new CatalogFault(
              response.status === 429 ? 429 : 502,
              response.status === 429
                ? "RAWG está limitando consultas. Inténtalo más tarde."
                : "RAWG no está disponible. Inténtalo de nuevo.",
            );
          }
          payload = normalizeCatalog(await limitedJson(response), route);
        }
      } finally {
        clearTimeout(timer);
        request.signal.removeEventListener("abort", onAbort);
      }
      const games = route.kind === "detail"
        ? (payload ? [payload] : [])
        : route.kind === "search"
        ? (payload as { items: unknown[] }).items
        : [];
      await backend.store(route.key, payload, games, route.kind === "detail");
      return reply(200, payload);
    } catch (error) {
      if (error instanceof CatalogFault) {
        return reply(error.status, { error: error.message });
      }
      // Provider URLs (including keys), raw upstream bodies and DB diagnostics stay private.
      return reply(503, {
        error: "No pudimos consultar el catálogo. Inténtalo de nuevo.",
      });
    }
  };
}
