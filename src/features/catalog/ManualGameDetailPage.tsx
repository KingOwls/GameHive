import { ReviewsSection } from "../reviews/ReviewsSection";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ManualGame, Resource } from "../../domain/models";
import {
  createManualGamesService,
  type ManualGamesService,
} from "../../services/manual-games";
import { publicError } from "../../services/errors";
import { StatePanel } from "../../components/StatePanel";
const defaultService = createManualGamesService();
export function ManualGameDetailPage({
  service = defaultService,
}: {
  service?: ManualGamesService;
}) {
  const { id = "" } = useParams();
  return <ManualDetail key={id} id={id} service={service} />;
}
function ManualDetail({
  id,
  service,
}: {
  id: string;
  service: ManualGamesService;
}) {
  const [state, setState] = useState<Resource<ManualGame | null>>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    service
      .get(id, controller.signal)
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
  }, [id, service, attempt]);
  return (
    <>
      <Link to="/manual-games">Volver al catálogo manual</Link> ·{" "}
      <Link to="/explore">Catálogo principal</Link>
      {state.status === "loading" && (
        <StatePanel kind="loading" title="Cargando ficha manual" />
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
      {state.status === "success" &&
        (state.data ? (
          <article>
            <p className="eyebrow">REGISTRO MANUAL</p>
            <h1>{state.data.title}</h1>
            <p>Sin portada · Sin rating externo</p>
            <dl>
              <dt>Plataformas</dt>
              <dd>{state.data.platforms.join(" · ")}</dd>
              <dt>Géneros</dt>
              <dd>{state.data.genres.join(" · ")}</dd>
              <dt>Lanzamiento</dt>
              <dd>{state.data.released_at ?? "Fecha no documentada"}</dd>
            </dl>
            <h2>Sinopsis propia</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{state.data.synopsis}</p>
            <p>
              Procedencia:{" "}
              <a
                href={state.data.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {state.data.source_label}
              </a>
            </p>
            <ReviewsSection gameId={`manual:${state.data.id}`} />
          </article>
        ) : (
          <StatePanel kind="empty" title="Este juego manual no existe" />
        ))}
    </>
  );
}
