import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { StatePanel } from "../../components/StatePanel";
import type {
  LibraryGame,
  LibraryItem,
  LibrarySnapshot,
  Page,
  LibraryProfile,
} from "../../domain/models";
import {
  createLibraryService,
  type LibraryFilters,
  type LibraryService,
} from "../../services/library";
import { publicError } from "../../services/errors";
import { LibraryAction, libraryStateLabels } from "./LibraryAction";
const service = createLibraryService();
export function LibraryPage({
  service: api = service,
}: {
  service?: LibraryService;
}) {
  const { handle } = useParams();
  const { session, loading } = useAuth();
  if (loading) return <StatePanel kind="loading" title="Comprobando sesión" />;
  if (!handle && !session)
    return (
      <StatePanel kind="empty" title="Inicia sesión para abrir tu biblioteca">
        <Link to="/login">Iniciar sesión</Link>
      </StatePanel>
    );
  return (
    <Library
      key={`${session?.user.id ?? "anon"}:${handle ?? ""}`}
      handle={handle}
      actor={session?.user.id}
      api={api}
    />
  );
}
function Library({
  handle,
  actor,
  api,
}: {
  handle?: string;
  actor?: string;
  api: LibraryService;
}) {
  const [profile, setProfile] = useState<LibraryProfile | null>(null),
    [owner, setOwner] = useState(handle ? "" : (actor ?? "")),
    [items, setItems] = useState<Page<LibraryItem> | null>(null),
    [privacy, setPrivacy] = useState<LibrarySnapshot | null>(null),
    [profileError, setProfileError] = useState(""),
    [listError, setListError] = useState(""),
    [privacyError, setPrivacyError] = useState(""),
    [revision, setRevision] = useState(0),
    [page, setPage] = useState(1),
    [filters, setFilters] = useState<LibraryFilters>({}),
    [busy, setBusy] = useState(false),
    [privacyUnknown, setPrivacyUnknown] = useState(false);
  const [editingGame, setEditingGame] = useState("");
  const privacyEpoch = useRef(0);
  const own = Boolean(owner && owner === actor);
  const error = [profileError, listError, privacyError]
    .filter(Boolean)
    .join(" ");
  useEffect(() => {
    const c = new AbortController();
    if (handle) {
      api
        .profile(handle, c.signal)
        .then((p) => {
          if (!c.signal.aborted) {
            setProfile(p);
            setOwner(p?.id ?? "");
            setProfileError(p ? "" : "Perfil no disponible.");
          }
        })
        .catch((e) => {
          if (!c.signal.aborted) setProfileError(publicError(e));
        });
    }
    return () => c.abort();
  }, [api, handle, revision]);
  useEffect(() => {
    if (!owner) return;
    const c = new AbortController();
    api
      .list(owner, page, filters, c.signal)
      .then((p) => {
        if (!c.signal.aborted) {
          setListError("");
          const lastPage = Math.max(1, Math.ceil(p.total / p.pageSize));
          if (page > lastPage) {
            setItems(null);
            setPage(lastPage);
            return;
          }
          setItems(p);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setListError(publicError(e));
      });
    const readEpoch = privacyEpoch.current;
    if (own)
      api
        .settings(c.signal)
        .then((s) => {
          if (!c.signal.aborted && readEpoch === privacyEpoch.current) {
            setPrivacy(s);
            setPrivacyUnknown(false);
            setPrivacyError("");
          }
        })
        .catch((e) => {
          if (!c.signal.aborted && readEpoch === privacyEpoch.current)
            setPrivacyError(publicError(e));
        });
    return () => c.abort();
  }, [api, owner, own, page, filters, revision]);
  async function visibility(value: "private" | "public") {
    if (!privacy) return;
    privacyEpoch.current += 1;
    setBusy(true);
    try {
      const confirmed = await api.privacy(value, privacy.visibilityVersion);
      privacyEpoch.current += 1;
      setPrivacy(confirmed);
      setPrivacyUnknown(false);
      setPrivacyError("");
    } catch (e) {
      privacyEpoch.current += 1;
      setPrivacyError(publicError(e));
      setPrivacyUnknown(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h1>
        {handle
          ? `Biblioteca de ${profile?.username ?? handle}`
          : "Mi biblioteca"}
      </h1>
      {profile && <Link to={`/u/${profile.username}`}>Ver perfil público</Link>}
      {own && (
        <>
          <p>
            Privacidad actual:{" "}
            {privacyUnknown
              ? "Sin confirmar: consulta el estado guardado"
              : privacy
                ? privacy.visibility === "public"
                  ? "Pública"
                  : "Privada"
                : "Consultando…"}
          </p>
          <p>
            Compartir permite que otras personas consulten tus juegos y marcas.
            Tus preferencias siguen siendo privadas.
          </p>
          <button
            disabled={!privacy || busy || privacyUnknown}
            onClick={() =>
              void visibility(
                privacy?.visibility === "public" ? "private" : "public",
              )
            }
          >
            {privacy?.visibility === "public"
              ? "Hacer privada"
              : "Publicar mi biblioteca"}
          </button>
          <button disabled={busy} onClick={() => setRevision((n) => n + 1)}>
            Consultar privacidad y estado guardados
          </button>
          <PersistedSearch
            api={api}
            onSaved={() => setRevision((n) => n + 1)}
          />
        </>
      )}
      <label>
        Filtrar estado
        <select
          value={filters.state ?? ""}
          onChange={(e) => {
            setFilters({ ...filters, state: e.target.value });
            setPage(1);
            setItems(null);
          }}
        >
          <option value="">Todos</option>
          <option value="unclassified">Sin clasificar</option>
          {Object.entries(libraryStateLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={filters.favorite ?? false}
          onChange={(e) => {
            setFilters({ ...filters, favorite: e.target.checked });
            setPage(1);
            setItems(null);
          }}
        />
        Solo favoritos
      </label>
      <label>
        <input
          type="checkbox"
          checked={filters.interested ?? false}
          onChange={(e) => {
            setFilters({ ...filters, interested: e.target.checked });
            setPage(1);
            setItems(null);
          }}
        />
        Solo me interesa
      </label>
      {error && (
        <StatePanel kind="error" title={error}>
          <button onClick={() => setRevision((n) => n + 1)}>
            Reintentar consulta
          </button>
        </StatePanel>
      )}
      {!items && !error && (
        <StatePanel kind="loading" title="Cargando biblioteca" />
      )}
      {items && (
        <>
          <p>{items.total} juegos accesibles</p>
          {!items.items.length && (
            <StatePanel
              kind="empty"
              title={
                own
                  ? "No hay juegos con estos filtros"
                  : "Biblioteca privada, no disponible o sin juegos accesibles"
              }
            />
          )}
          {items.items.map((item) => {
            const id = item.game_id ?? `manual:${item.manual_game_id}`;
            return (
              <article key={item.id}>
                <h2>
                  <Link
                    to={
                      item.game_id
                        ? `/games/${item.game_id}`
                        : `/manual-games/${id}`
                    }
                  >
                    {item.games?.document.title ??
                      item.manual_games?.title ??
                      "Juego"}
                  </Link>
                </h2>
                <p>
                  {item.state
                    ? libraryStateLabels[item.state]
                    : "Sin clasificar"}{" "}
                  · {item.favorite ? "Favorito" : "Sin favorito"} ·{" "}
                  {item.interested ? "Me interesa" : "Sin interés"} · Progreso:{" "}
                  {item.progress ?? "sin indicar"}
                </p>
                {own && (
                  <button
                    onClick={() => setEditingGame(editingGame === id ? "" : id)}
                  >
                    Organizar este juego
                  </button>
                )}
                {own && editingGame === id && (
                  <LibraryAction
                    gameId={id}
                    service={api}
                    onSaved={() => setRevision((n) => n + 1)}
                  />
                )}
              </article>
            );
          })}
          <Pager
            page={page}
            total={items.total}
            size={20}
            onChange={(n) => {
              setPage(n);
              setItems(null);
            }}
          />
        </>
      )}
    </section>
  );
}
export function Pager({
  label = "Páginas de biblioteca",
  page,
  total,
  size,
  onChange,
}: {
  label?: string;
  page: number;
  total: number;
  size: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav aria-label={label}>
      <button disabled={page === 1} onClick={() => onChange(page - 1)}>
        Anterior
      </button>
      <span>Página {page}</span>
      <button
        disabled={page * size >= total}
        onClick={() => onChange(page + 1)}
      >
        Siguiente
      </button>
    </nav>
  );
}
function PersistedSearch({
  api,
  onSaved,
}: {
  api: LibraryService;
  onSaved: () => void;
}) {
  const [selectedGame, setSelectedGame] = useState("");
  const [searchRevision, setSearchRevision] = useState(0);
  const [text, setText] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [result, setResult] = useState<Page<LibraryGame> | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    api
      .search(query, page, c.signal)
      .then((p) => {
        if (!c.signal.aborted) {
          setResult(p);
          setError("");
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(publicError(e));
      });
    return () => c.abort();
  }, [api, query, page, searchRevision]);
  return (
    <section>
      <h2>Añadir juegos disponibles en GameHive</h2>
      <p>
        Busca juegos de RAWG ya consultados o registrados en el catálogo manual
        de GameHive.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearchRevision((n) => n + 1);
          setQuery(text);
          setPage(1);
          setResult(null);
        }}
      >
        <label>
          Buscar juegos disponibles
          <input
            maxLength={100}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button>Buscar</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result ? (
        <>
          <p>{result.total} juegos disponibles</p>
          {result.items.map((g) => (
            <article key={g.id}>
              <h3>
                <Link
                  to={
                    g.id.startsWith("manual:")
                      ? `/manual-games/${g.id}`
                      : `/games/${g.id}`
                  }
                >
                  {g.title}
                </Link>
              </h3>
              <p>{g.source_label}</p>
              <button
                onClick={() =>
                  setSelectedGame(selectedGame === g.id ? "" : g.id)
                }
              >
                Organizar este juego
              </button>
              {selectedGame === g.id && (
                <LibraryAction gameId={g.id} service={api} onSaved={onSaved} />
              )}
            </article>
          ))}
          <Pager
            label="Páginas de juegos disponibles"
            page={page}
            size={20}
            total={result.total}
            onChange={setPage}
          />
        </>
      ) : (
        !error && <p role="status">Buscando juegos…</p>
      )}
    </section>
  );
}
