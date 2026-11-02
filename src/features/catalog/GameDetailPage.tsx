import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CatalogProvider, Game, Resource } from "../../domain/models";
import { StatePanel } from "../../components/StatePanel";
import { ReviewsSection } from "../reviews/ReviewsSection";
import { GameMedia } from "./GameMedia";
import { publicError } from "../../services/errors";
export function GameDetailPage({ provider }: { provider: CatalogProvider }) {
  const [retry, setRetry] = useState(0);
  const [expandedId, setExpandedId] = useState("");
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
  }, [id, provider, retry]);
  if (result.status === "loading")
    return <StatePanel kind="loading" title="Abriendo ficha…" />;
  if (result.status === "error")
    return (
      <StatePanel kind="error" title={result.message}>
        <button
          onClick={() => {
            setResource({ id, result: { status: "loading" } });
            setRetry((value) => value + 1);
          }}
        >
          Reintentar
        </button>
      </StatePanel>
    );
  if (!result.data)
    return (
      <StatePanel
        kind="empty"
        title={
          provider.mode === "live"
            ? "Este juego no está disponible en RAWG"
            : "Este juego no está en el catálogo curado"
        }
      >
        <Link to="/explore">Volver a explorar</Link>
      </StatePanel>
    );
  const game = result.data;
  return (
    <article className="detail">
      <Link to="/explore">← Explorar</Link>
      <p className="eyebrow">
        {provider.mode === "live"
          ? "FICHA RAWG"
          : "FICHA EDITORIAL · MODO SIN CONEXIÓN"}
      </p>
      <h1>{game.title}</h1>
      {game.coverUrl && (
        <img
          className="detail-cover"
          src={game.coverUrl}
          alt={`Portada de ${game.title}`}
          referrerPolicy="no-referrer"
        />
      )}
      <p className="lead">{game.summary || "Sin sinopsis disponible."}</p>
      {(game.description || provider.mode === "live") && (
        <details
          key={game.id}
          onToggle={(event) =>
            setExpandedId(event.currentTarget.open ? game.id : "")
          }
        >
          <summary>Ficha completa</summary>
          <p className="game-description">
            {game.description || "Sin descripción completa disponible."}
          </p>
          <p>Desarrollador: {game.developers?.join(", ") || "Sin datos"}</p>
          <p>Publisher: {game.publishers?.join(", ") || "Sin datos"}</p>
          <p>Etiquetas: {game.tags?.join(", ") || "Sin datos"}</p>
          {expandedId === game.id && provider.screenshots && (
            <GameMedia key={game.id} provider={provider} game={game} />
          )}
          <h2>Requisitos por plataforma</h2>
          {game.requirements?.length ? (
            game.requirements.map((requirement) => (
              <section
                key={requirement.platform}
                aria-label={`Requisitos ${requirement.platform}`}
              >
                <h3>{requirement.platform}</h3>
                <p className="game-description">
                  Mínimos: {requirement.minimum || "Sin datos"}
                </p>
                <p className="game-description">
                  Recomendados: {requirement.recommended || "Sin datos"}
                </p>
              </section>
            ))
          ) : (
            <p>Sin requisitos informados por el proveedor.</p>
          )}
        </details>
      )}
      <dl>
        <dt>
          {provider.mode === "live"
            ? "Fecha de lanzamiento"
            : "Año de lanzamiento"}
        </dt>
        <dd>
          {game.releasedAt ?? game.releasedYear ?? "Sin fecha confirmada"}
        </dd>
        <dt>Géneros</dt>
        <dd>{game.genres.join(", ") || "Sin datos"}</dd>
        <dt>Plataformas generales</dt>
        <dd>
          {game.platforms.join(", ") || "Sin datos"} · consulta versiones en la
          fuente
        </dd>
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
          <p>
            Consulta las reseñas publicadas. Cálculo de puntuación pendiente.
          </p>
        </div>
        <div>
          <h2>Críticos</h2>
          <p>
            Consulta los análisis publicados. Cálculo de puntuación crítica
            pendiente.
          </p>
        </div>
        <div>
          <h2>Proveedor</h2>
          <p>
            {game.externalRating
              ? `${game.externalRating.source}: ${game.externalRating.value} / ${game.externalRating.scale} · muestra: ${game.externalRating.sample ?? "no informada"}`
              : provider.mode === "live"
                ? "Sin rating externo"
                : "No conectado"}
          </p>
        </div>
      </section>
      <ReviewsSection gameId={game.id} />
    </article>
  );
}
