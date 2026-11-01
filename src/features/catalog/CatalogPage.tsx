import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type {
  CatalogProvider,
  CatalogTaxonomy,
  CatalogQuery,
  Game,
  Page,
  Resource,
} from "../../domain/models";
import { publicError } from "../../services/errors";
import { StatePanel } from "../../components/StatePanel";
import { curatedGames, normalizePage } from "./curated";
export function CatalogPage({ provider }: { provider: CatalogProvider }) {
  const [params, setParams] = useSearchParams(),
    [retry, setRetry] = useState(0);
  const [taxonomyRetry, setTaxonomyRetry] = useState(0);
  const [resource, setResource] = useState<{
    key: string;
    result: Resource<Page<Game>>;
  }>({ key: "", result: { status: "loading" } });
  const [taxonomy, setTaxonomy] = useState<CatalogTaxonomy | null>(null);
  const [taxonomyError, setTaxonomyError] = useState(false);
  useEffect(() => {
    if (!provider.taxonomy) return;
    const controller = new AbortController();
    provider
      .taxonomy(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setTaxonomy(data);
          setTaxonomyError(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setTaxonomyError(true);
      });
    return () => controller.abort();
  }, [provider, taxonomyRetry]);
  const q = params.get("q") ?? "",
    genre = params.get("genre") ?? "",
    platform = params.get("platform") ?? "",
    year = params.get("year") ?? "",
    tag = params.get("tag") ?? "",
    order =
      params.get("order") === "year"
        ? "year"
        : params.get("order") === "rating" && provider.mode === "live"
          ? "rating"
          : "title",
    page = normalizePage(params.get("page"));
  const invalidYear = year !== "" && !/^(19|20)\d{2}$/.test(year);
  const requestKey = JSON.stringify([
    q,
    genre,
    platform,
    year,
    tag,
    order,
    page,
    retry,
  ]);
  const result: Resource<Page<Game>> = invalidYear
    ? { status: "error", message: "Escribe un año completo entre 1900 y 2099." }
    : resource.key === requestKey
      ? resource.result
      : { status: "loading" };
  function setResult(result: Resource<Page<Game>>) {
    setResource({ key: requestKey, result });
  }
  useEffect(() => {
    if (invalidYear) return;
    const controller = new AbortController();
    const runSearch = () => {
      provider
        .search(
          { text: q, genre, platform, year, tag, order, page },
          controller.signal,
        )
        .then((data) => {
          if (!controller.signal.aborted)
            setResource({
              key: requestKey,
              result: { status: "success", data },
            });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setResource({
              key: requestKey,
              result: { status: "error", message: publicError(error) },
            });
        });
    };
    const timer =
      provider.mode === "live" && q ? setTimeout(runSearch, 300) : undefined;
    if (timer === undefined) runSearch();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    provider,
    q,
    genre,
    platform,
    year,
    tag,
    order,
    page,
    retry,
    requestKey,
    invalidYear,
  ]);
  function update(key: string, value: string) {
    setResult({ status: "loading" });
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  }
  return (
    <>
      <p>
        <Link to="/manual-games">Consultar catálogo manual independiente</Link>
      </p>
      <section className="page-heading">
        <p className="eyebrow">ELIGE TU SIGUIENTE AVENTURA</p>
        <h1>
          Explora otros <em>mundos.</em>
        </h1>
        <p>
          Encuentra juegos por lo que te mueve. Las opiniones llegarán de su
          comunidad.
        </p>
      </section>
      <div className="notice">
        <strong>
          {provider.mode === "live"
            ? "Catálogo RAWG"
            : "Catálogo curado · sin conexión a RAWG"}
        </strong>
        <span>
          {provider.mode === "live" ? (
            <>
              Datos e imágenes de{" "}
              <a
                href="https://rawg.io"
                target="_blank"
                rel="noopener noreferrer"
              >
                RAWG
              </a>
              . Puntuación externa separada de GameHive.
            </>
          ) : (
            "8 juegos reales con fuentes oficiales. Sin precios, puntuaciones ni actividad comunitaria inventada."
          )}
        </span>
      </div>
      <section aria-label="Filtros del catálogo" className="filters">
        <label className="search-field">
          Buscar juego
          <input
            type="search"
            value={q}
            onChange={(event) => update("q", event.target.value)}
            placeholder="¿Qué quieres jugar?"
            maxLength={100}
          />
        </label>
        <label>
          Género
          <select
            value={genre}
            onChange={(event) => update("genre", event.target.value)}
          >
            <option value="">Todos los géneros</option>
            {(provider.mode === "live"
              ? (taxonomy?.genres ?? [])
              : [...new Set(curatedGames.flatMap((game) => game.genres))]
                  .sort()
                  .map((name) => ({ id: name, name }))
            ).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Plataforma
          <select
            value={platform}
            onChange={(event) => update("platform", event.target.value)}
          >
            <option value="">Todas</option>
            {(provider.mode === "live"
              ? (taxonomy?.platforms ?? [])
              : [
                  { id: "PC", name: "PC" },
                  { id: "Consolas", name: "Consolas" },
                ]
            ).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Año
          <input
            type="number"
            min="1900"
            max="2099"
            value={year}
            onChange={(event) => update("year", event.target.value)}
            placeholder="Todos"
          />
        </label>
        <label>
          Orden
          <select
            value={order}
            onChange={(event) => update("order", event.target.value)}
          >
            <option value="title">Nombre</option>
            <option value="year">Más recientes</option>
            {provider.mode === "live" && (
              <option value="rating">Rating RAWG</option>
            )}
          </select>
        </label>
        {provider.mode === "live" && (
          <label>
            Etiqueta
            <select
              value={tag}
              onChange={(event) => update("tag", event.target.value)}
            >
              <option value="">Todas</option>
              {(taxonomy?.tags ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      {taxonomyError && (
        <StatePanel kind="error" title="No pudimos cargar los filtros RAWG">
          <button onClick={() => setTaxonomyRetry((value) => value + 1)}>
            Reintentar filtros
          </button>
        </StatePanel>
      )}
      {provider.mode === "live" && (
        <p>
          Score GameHive disponible cuando existan evaluaciones comunitarias.
        </p>
      )}
      {result.status === "loading" && (
        <StatePanel kind="loading" title="Buscando mundos…" />
      )}
      {result.status === "error" && (
        <StatePanel kind="error" title={result.message}>
          {!invalidYear && (
            <button
              onClick={() => {
                setResult({ status: "loading" });
                setRetry((value) => value + 1);
              }}
            >
              Reintentar
            </button>
          )}
        </StatePanel>
      )}
      {result.status === "success" && (
        <>
          <p className="result-count" aria-live="polite">
            {result.data.total} juegos encontrados
          </p>
          {result.data.items.length === 0 ? (
            <StatePanel
              kind="empty"
              title="No encontramos juegos con esos filtros"
            >
              <button
                onClick={() => {
                  setResult({ status: "loading" });
                  setParams({});
                }}
              >
                Limpiar filtros
              </button>
            </StatePanel>
          ) : (
            <div className="game-grid">
              {result.data.items.map((game, index) => (
                <Link
                  to={`/games/${game.id}`}
                  className="game-card"
                  key={game.id}
                >
                  <div
                    className={`game-art art-${index % 3}`}
                    aria-hidden="true"
                  >
                    {game.coverUrl && (
                      <img
                        src={game.coverUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <span>GH / {game.releasedYear ?? "Sin fecha"}</span>
                    <strong>
                      {game.title
                        .split(" ")
                        .map((word) => word[0])
                        .slice(0, 3)
                        .join("")}
                    </strong>
                    <span>
                      {provider.mode === "live"
                        ? "RAWG"
                        : "FICHA CURADA · SIN PORTADA"}
                    </span>
                  </div>
                  <div className="game-card-content">
                    <span className="tag">{game.genres[0]}</span>
                    <h2>{game.title}</h2>
                    <p>
                      {game.platforms.join(" / ")}{" "}
                      <span aria-hidden="true">↗</span>
                    </p>
                    <small>Sin evaluaciones GameHive</small>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <nav className="pagination" aria-label="Paginación">
            <button
              disabled={page <= 1}
              onClick={() => update("page", String(page - 1))}
            >
              Anterior
            </button>
            <span>Página {page}</span>
            <button
              disabled={
                page * result.data.pageSize >= result.data.total ||
                (provider.mode === "live" && page >= 100)
              }
              onClick={() => update("page", String(page + 1))}
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
    </>
  );
}
// Mantener el contrato importado explícito para futuros adaptadores.
export type { CatalogQuery };
