import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type {
  CatalogProvider,
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
  const [resource, setResource] = useState<{
    key: string;
    result: Resource<Page<Game>>;
  }>({ key: "", result: { status: "loading" } });
  const q = params.get("q") ?? "",
    genre = params.get("genre") ?? "",
    platform = params.get("platform") ?? "",
    year = params.get("year") ?? "",
    order = params.get("order") === "year" ? "year" : "title",
    page = normalizePage(params.get("page"));
  const requestKey = JSON.stringify([
    q,
    genre,
    platform,
    year,
    order,
    page,
    retry,
  ]);
  const result: Resource<Page<Game>> =
    resource.key === requestKey ? resource.result : { status: "loading" };
  function setResult(result: Resource<Page<Game>>) {
    setResource({ key: requestKey, result });
  }
  useEffect(() => {
    const controller = new AbortController();
    provider
      .search(
        { text: q, genre, platform, year, order, page },
        controller.signal,
      )
      .then((data) => {
        if (!controller.signal.aborted)
          setResource({ key: requestKey, result: { status: "success", data } });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResource({
            key: requestKey,
            result: { status: "error", message: publicError(error) },
          });
      });
    return () => controller.abort();
  }, [provider, q, genre, platform, year, order, page, retry, requestKey]);
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
        <strong>Catálogo curado · sin conexión a RAWG</strong>
        <span>
          8 juegos reales con fuentes oficiales. Sin precios, puntuaciones ni
          actividad comunitaria inventada.
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
            {[...new Set(curatedGames.flatMap((game) => game.genres))]
              .sort()
              .map((item) => (
                <option key={item}>{item}</option>
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
            <option>PC</option>
            <option>Consolas</option>
          </select>
        </label>
        <label>
          Año
          <select
            value={year}
            onChange={(event) => update("year", event.target.value)}
          >
            <option value="">Todos</option>
            {[...new Set(curatedGames.map((game) => game.releasedYear))]
              .sort((a, b) => b - a)
              .map((item) => (
                <option key={item}>{item}</option>
              ))}
          </select>
        </label>
        <label>
          Orden
          <select
            value={order}
            onChange={(event) => update("order", event.target.value)}
          >
            <option value="title">Nombre</option>
            <option value="year">Más recientes</option>
          </select>
        </label>
      </section>
      {result.status === "loading" && (
        <StatePanel kind="loading" title="Buscando mundos…" />
      )}
      {result.status === "error" && (
        <StatePanel kind="error" title={result.message}>
          <button
            onClick={() => {
              setResult({ status: "loading" });
              setRetry((value) => value + 1);
            }}
          >
            Reintentar
          </button>
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
                    <span>GH / {game.releasedYear}</span>
                    <strong>
                      {game.title
                        .split(" ")
                        .map((word) => word[0])
                        .slice(0, 3)
                        .join("")}
                    </strong>
                    <span>FICHA CURADA · SIN PORTADA</span>
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
              disabled={page * result.data.pageSize >= result.data.total}
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
