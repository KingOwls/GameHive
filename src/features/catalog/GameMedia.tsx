import { useEffect, useState } from "react";
import type { CatalogProvider, Game, Resource } from "../../domain/models";
import { StatePanel } from "../../components/StatePanel";
import { publicError } from "../../services/errors";
export function GameMedia({
  provider,
  game,
}: {
  provider: CatalogProvider;
  game: Game;
}) {
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Resource<string[]>>({
    status: "loading",
  });
  useEffect(() => {
    const controller = new AbortController();
    provider
      .screenshots?.(game.id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ status: "success", data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ status: "error", message: publicError(error) });
      });
    return () => controller.abort();
  }, [provider, game.id, retry]);
  return (
    <section aria-label="Capturas RAWG">
      <h2>Capturas</h2>
      {result.status === "loading" && (
        <StatePanel kind="loading" title="Cargando capturas…" />
      )}
      {result.status === "error" && (
        <StatePanel kind="error" title="No pudimos cargar las capturas">
          <p>Los metadatos siguen disponibles. {result.message}</p>
          <button
            onClick={() => {
              setResult({ status: "loading" });
              setRetry((value) => value + 1);
            }}
          >
            Reintentar capturas
          </button>
        </StatePanel>
      )}
      {result.status === "success" &&
        (result.data.length ? (
          <div className="screenshot-grid">
            {result.data.map((url, index) => (
              <img
                key={url}
                src={url}
                alt={`Captura ${index + 1} de ${game.title}`}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
        ) : (
          <p>Sin capturas disponibles.</p>
        ))}
    </section>
  );
}
