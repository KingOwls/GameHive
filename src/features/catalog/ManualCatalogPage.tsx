import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ManualGame, Page, Resource } from "../../domain/models";
import {
  createManualGamesService,
  type ManualGamesService,
} from "../../services/manual-games";
import { publicError } from "../../services/errors";
import { StatePanel } from "../../components/StatePanel";
const defaultService = createManualGamesService();
export function ManualCatalogPage({
  service = defaultService,
}: {
  service?: ManualGamesService;
}) {
  const [params, setParams] = useSearchParams();
  return (
    <ManualCatalog
      key={params.toString()}
      service={service}
      params={params}
      setParams={setParams}
    />
  );
}
function ManualCatalog({
  service,
  params,
  setParams,
}: {
  service: ManualGamesService;
  params: URLSearchParams;
  setParams: (params: URLSearchParams) => void;
}) {
  const q = params.get("q") ?? "";
  const page = Number(params.get("page") ?? "1");
  const [state, setState] = useState<Resource<Page<ManualGame>>>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    service
      .search(q, page, controller.signal)
      .then((data) => {
        if (active) setState({ status: "success", data });
      })
      .catch((e: unknown) => {
        if (active) setState({ status: "error", message: publicError(e) });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [q, page, attempt, service]);
  const change = (next: URLSearchParams) => {
    setState({ status: "loading" });
    if (next.toString() === params.toString()) setAttempt((n) => n + 1);
    else setParams(next);
  };
  return (
    <>
      <p className="eyebrow">CATÁLOGO MANUAL · FUENTES IDENTIFICADAS</p>
      <h1>Juegos registrados por administración</h1>
      <p>
        Altas independientes con metadatos propios y fuente pública. Estos
        resultados y su total pertenecen exclusivamente al catálogo manual.
      </p>
      <p>
        <Link to="/explore">Volver al catálogo principal</Link> ·{" "}
        <Link to="/admin/games">Registrar un juego (administración)</Link>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          change(
            new URLSearchParams({ q: String(data.get("q") ?? ""), page: "1" }),
          );
        }}
      >
        <label htmlFor="manual-query">Buscar por título</label>
        <input
          id="manual-query"
          name="q"
          maxLength={100}
          defaultValue={q}
          key={q}
        />
        <button type="submit">Buscar</button>
      </form>
      {state.status === "loading" && (
        <StatePanel kind="loading" title="Consultando juegos manuales" />
      )}
      {state.status === "error" && (
        <StatePanel kind="error" title={state.message}>
          <button
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            Reintentar
          </button>
        </StatePanel>
      )}
      {state.status === "success" && (
        <>
          {state.data.items.length === 0 ? (
            <StatePanel
              kind="empty"
              title="No hay resultados en este catálogo manual"
            >
              <p>
                Una búsqueda vacía no demuestra ausencia en otros proveedores.
              </p>
            </StatePanel>
          ) : (
            <>
              <p role="status">
                {state.data.total} juegos manuales · Página {page}
              </p>
              <div className="game-grid">
                {state.data.items.map((game) => (
                  <article className="game-card" key={game.id}>
                    <p>Registro manual · Sin portada</p>
                    <h2>
                      <Link to={`/manual-games/manual:${game.id}`}>
                        {game.title}
                      </Link>
                    </h2>
                    <p>{game.platforms.join(" · ")}</p>
                    <p>Fuente: {game.source_label}</p>
                  </article>
                ))}
              </div>
            </>
          )}
          <nav aria-label="Paginación del catálogo manual">
            <button
              disabled={page <= 1}
              onClick={() =>
                change(new URLSearchParams({ q, page: String(page - 1) }))
              }
            >
              Anterior
            </button>
            <button
              disabled={page >= 100 || page * 12 >= state.data.total}
              onClick={() =>
                change(new URLSearchParams({ q, page: String(page + 1) }))
              }
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
    </>
  );
}
