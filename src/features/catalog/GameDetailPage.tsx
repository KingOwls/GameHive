import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CatalogProvider, Game, Resource } from "../../domain/models";
import { StatePanel } from "../../components/StatePanel";
import { publicError } from "../../services/errors";
export function GameDetailPage({ provider }: { provider: CatalogProvider }) {
  const { id = "" } = useParams(),
    [resource, setResource] = useState<{
      id: string;
      result: Resource<Game | null>;
    }>({ id: "", result: { status: "loading" } });
  const result: Resource<Game | null> =
    resource.id === id ? resource.result : { status: "loading" };
  useEffect(() => {
    const controller = new AbortController();
    provider
      .get(id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setResource({ id, result: { status: "success", data } });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResource({
            id,
            result: { status: "error", message: publicError(error) },
          });
      });
    return () => controller.abort();
  }, [id, provider]);
  if (result.status === "loading")
    return <StatePanel kind="loading" title="Abriendo ficha…" />;
  if (result.status === "error")
    return <StatePanel kind="error" title={result.message} />;
  if (!result.data)
    return (
      <StatePanel kind="empty" title="Este juego no está en el catálogo curado">
        <Link to="/explore">Volver a explorar</Link>
      </StatePanel>
    );
  const game = result.data;
  return (
    <article className="detail">
      <Link to="/explore">← Explorar</Link>
      <p className="eyebrow">FICHA EDITORIAL · MODO SIN CONEXIÓN</p>
      <h1>{game.title}</h1>
      <p className="lead">{game.summary}</p>
      <dl>
        <dt>Año de lanzamiento</dt>
        <dd>{game.releasedYear}</dd>
        <dt>Géneros</dt>
        <dd>{game.genres.join(", ")}</dd>
        <dt>Plataformas generales</dt>
        <dd>{game.platforms.join(", ")} · consulta versiones en la fuente</dd>
        <dt>Fuente</dt>
        <dd>
          <a href={game.sourceUrl} target="_blank" rel="noopener noreferrer">
            {game.sourceLabel} ↗
          </a>
        </dd>
      </dl>
      <section className="score-grid" aria-label="Puntuaciones">
        <div>
          <h2>Comunidad</h2>
          <p>Sin evaluaciones</p>
        </div>
        <div>
          <h2>Críticos</h2>
          <p>Sin evaluaciones</p>
        </div>
        <div>
          <h2>Proveedor</h2>
          <p>No conectado</p>
        </div>
      </section>
      <div className="notice">
        <strong>Comunidad pendiente de integración</strong>
        <span>
          Las reseñas y la biblioteca requieren Supabase y políticas RLS
          verificadas. Aún no están habilitadas.
        </span>
      </div>
    </article>
  );
}
