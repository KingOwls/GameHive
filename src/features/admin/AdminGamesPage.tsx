import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Identity, ManualGame, Resource } from "../../domain/models";
import {
  createManualGamesService,
  type ManualGamesService,
} from "../../services/manual-games";
import { publicError } from "../../services/errors";
import { StatePanel } from "../../components/StatePanel";
const defaultService = createManualGamesService();
export function AdminGamesPage({
  games = defaultService,
}: {
  games?: ManualGamesService;
}) {
  const auth = useAuth();
  return (
    <AdminGamesForm key={auth.session?.user.id ?? "anonymous"} games={games} />
  );
}
function AdminGamesForm({ games }: { games: ManualGamesService }) {
  const auth = useAuth();
  const [identity, setIdentity] = useState<Resource<Identity>>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<ManualGame | null>(null);
  const sending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    if (auth.service && auth.session)
      auth.service
        .identity()
        .then((data) => {
          if (active) setIdentity({ status: "success", data });
        })
        .catch((e: unknown) => {
          if (active) setIdentity({ status: "error", message: publicError(e) });
        });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, [auth.service, auth.session, attempt]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending.current) return;
    const data = new FormData(e.currentTarget);
    const field = (key: string) => String(data.get(key) ?? "");
    const platforms = data.getAll("platforms").map(String);
    const genres = field("genres")
      .split(",")
      .map((s) => s.trim());
    const platformControl = e.currentTarget.querySelector<HTMLInputElement>(
      'input[name="platforms"]',
    )!;
    const genreControl = e.currentTarget.elements.namedItem(
      "genres",
    ) as HTMLInputElement;
    platformControl.setCustomValidity(
      platforms.length ? "" : "Selecciona al menos una plataforma.",
    );
    genreControl.setCustomValidity(
      genres.length >= 1 &&
        genres.length <= 8 &&
        genres.every((g) => g.length >= 1 && g.length <= 40)
        ? ""
        : "Escribe entre 1 y 8 géneros, de 1 a 40 caracteres cada uno, separados por comas.",
    );
    if (!e.currentTarget.reportValidity()) return;
    sending.current = true;
    setPending(true);
    setError("");
    setCreated(null);
    controller.current = new AbortController();
    try {
      const game = await games.create(
        {
          title: field("title"),
          synopsis: field("synopsis"),
          sourceUrl: field("sourceUrl"),
          sourceLabel: field("sourceLabel"),
          releasedAt: field("releasedAt") || null,
          reason: field("reason"),
          platforms,
          genres,
        },
        controller.current.signal,
      );
      setCreated(game);
    } catch (e: unknown) {
      setError(publicError(e));
    } finally {
      sending.current = false;
      setPending(false);
    }
  }
  if (auth.loading)
    return <StatePanel kind="loading" title="Comprobando sesión" />;
  if (auth.error)
    return (
      <StatePanel kind="error" title={auth.error}>
        <button onClick={auth.retry}>Reintentar</button>
      </StatePanel>
    );
  if (!auth.session || !auth.service)
    return (
      <StatePanel kind="empty" title="Inicia sesión como administrador">
        <Link to="/login">Iniciar sesión</Link>
      </StatePanel>
    );
  if (identity.status === "loading")
    return <StatePanel kind="loading" title="Comprobando permisos vigentes" />;
  if (identity.status === "error")
    return (
      <StatePanel kind="error" title={identity.message}>
        <button
          onClick={() => {
            setIdentity({ status: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          Reintentar
        </button>
      </StatePanel>
    );
  if (identity.data.role !== "admin" || identity.data.status !== "active")
    return (
      <StatePanel
        kind="empty"
        title="Acceso restringido a administradores activos"
      >
        <Link to="/manual-games">Consultar catálogo manual</Link>
      </StatePanel>
    );
  return (
    <>
      <p className="eyebrow">ADMINISTRACIÓN</p>
      <h1>Registrar juego real</h1>
      <p>
        Comprueba el <Link to="/explore">catálogo principal</Link> y el{" "}
        <Link to="/manual-games">catálogo manual</Link> antes de registrar. Una
        búsqueda vacía no descarta todas las duplicaciones.
      </p>
      <p>
        Escribe metadatos propios en texto plano. No copies textos ni activos
        protegidos. La fuente debe ser oficial y pública; no se consulta
        automáticamente.
      </p>
      <form
        onSubmit={submit}
        className="manual-form"
        onInput={(e) => {
          // Clear group validation as soon as the user edits the existing controls.
          const form = e.currentTarget;
          form
            .querySelector<HTMLInputElement>('input[name="platforms"]')
            ?.setCustomValidity("");
          (
            form.elements.namedItem("genres") as HTMLInputElement
          ).setCustomValidity("");
        }}
      >
        <fieldset disabled={pending}>
          <legend>Metadatos y procedencia</legend>
          <label htmlFor="manual-title">Título</label>
          <input id="manual-title" name="title" maxLength={160} required />
          <label htmlFor="manual-synopsis">Sinopsis propia</label>
          <textarea
            id="manual-synopsis"
            name="synopsis"
            minLength={20}
            maxLength={4000}
            required
          />
          <fieldset>
            <legend>Plataformas (al menos una)</legend>
            {["PC", "PlayStation", "Xbox", "Nintendo"].map((p) => (
              <label key={p}>
                <input type="checkbox" name="platforms" value={p} />
                {p}
              </label>
            ))}
          </fieldset>
          <label htmlFor="manual-genres">
            Géneros separados por comas (1–8, hasta 40 caracteres cada uno)
          </label>
          <input id="manual-genres" name="genres" maxLength={327} required />
          <label htmlFor="manual-date">Fecha de lanzamiento (opcional)</label>
          <input
            id="manual-date"
            name="releasedAt"
            type="date"
            min="1900-01-01"
            max="2099-12-31"
          />
          <label htmlFor="manual-source">Fuente oficial HTTPS</label>
          <input
            id="manual-source"
            name="sourceUrl"
            type="url"
            maxLength={2048}
            required
          />
          <label htmlFor="manual-source-label">Nombre de la fuente</label>
          <input
            id="manual-source-label"
            name="sourceLabel"
            maxLength={100}
            required
          />
          <label htmlFor="manual-reason">
            Motivo del alta (privado, 10–500 caracteres)
          </label>
          <textarea
            id="manual-reason"
            name="reason"
            minLength={10}
            maxLength={500}
            required
          />
          <button type="submit">
            {pending ? "Guardando…" : "Registrar juego"}
          </button>
        </fieldset>
      </form>
      {pending && (
        <StatePanel kind="loading" title="Guardando juego y auditoría" />
      )}
      {error && (
        <StatePanel kind="error" title={error}>
          <p>Revisa los datos y vuelve a enviar el formulario.</p>
          <Link to="/manual-games">Consultar posibles altas existentes</Link>
        </StatePanel>
      )}
      {created && (
        <section role="status">
          <h2>Juego registrado</h2>
          <Link to={`/manual-games/manual:${created.id}`}>
            Abrir ficha pública de {created.title}
          </Link>
        </section>
      )}
    </>
  );
}
