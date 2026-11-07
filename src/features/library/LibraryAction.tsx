import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { LibraryEntry, LibraryMarks } from "../../domain/models";
import {
  createLibraryService,
  libraryGameId,
  type LibraryService,
} from "../../services/library";
import { publicError } from "../../services/errors";
export const libraryStateLabels = {
  wishlist: "Deseados",
  playing: "Jugando",
  completed: "Terminado",
  backlog: "Pendiente",
};
const service = createLibraryService();
const drafts = new Map<
  string,
  { marks: LibraryMarks; entry: LibraryEntry | null }
>();
const blank: LibraryMarks = {
  state: null,
  favorite: false,
  interested: false,
  progress: null,
};
export function LibraryAction({
  gameId,
  service: api = service,
  onSaved,
}: {
  gameId: string;
  service?: LibraryService;
  onSaved?: () => void;
}) {
  const { session, loading } = useAuth();
  if (!libraryGameId(gameId))
    return (
      <p>Este juego curado aún no está persistido y no puede guardarse.</p>
    );
  if (loading) return <p role="status">Comprobando sesión…</p>;
  if (!session)
    return <Link to="/login">Inicia sesión para guardar en tu biblioteca</Link>;
  return (
    <Action
      key={`${session.user.id}:${gameId}`}
      actor={session.user.id}
      gameId={gameId}
      api={api}
      onSaved={onSaved}
    />
  );
}
function Action({
  actor,
  gameId,
  api,
  onSaved,
}: {
  actor: string;
  gameId: string;
  api: LibraryService;
  onSaved?: () => void;
}) {
  const key = `${actor}:${gameId}`;
  const [draft, setDraft] = useState(
    () => drafts.get(key) ?? { marks: blank, entry: null },
  );
  const localDraft = useRef(draft);
  const dirty = useRef(drafts.has(key));
  const [consulted, setConsulted] = useState<{
    entry: LibraryEntry | null;
  } | null>(null);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [message, setMessage] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    api
      .own(gameId, c.signal)
      .then((s) => {
        if (c.signal.aborted) return;
        const savedDraft = dirty.current ? localDraft.current : undefined;
        const changed =
          savedDraft &&
          (savedDraft.entry?.id !== s.entry?.id ||
            savedDraft.entry?.version !== s.entry?.version);
        if (!savedDraft) {
          const next = { entry: s.entry, marks: s.entry ?? blank };
          localDraft.current = next;
          setDraft(next);
        }
        setConsulted(changed ? { entry: s.entry } : null);
        setReady(true);
        setUncertain(Boolean(changed));
        setMessage(
          changed
            ? "El estado guardado cambió. Revisa la versión consultada antes de aplicar tu borrador."
            : "Estado guardado consultado. Tu borrador se conserva.",
        );
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setMessage(publicError(e));
          setReady(false);
        }
      });
    return () => c.abort();
  }, [api, gameId, key, attempt]);
  function change(marks: LibraryMarks) {
    const next = { ...draft, marks };
    dirty.current = true;
    localDraft.current = next;
    drafts.set(key, next);
    setDraft(next);
  }
  async function write(remove = false) {
    setBusy(true);
    setMessage("");
    try {
      const s =
        remove && draft.entry
          ? await api.remove(gameId, draft.entry)
          : await api.save(gameId, draft.marks, draft.entry);
      const next = { entry: s.entry, marks: s.entry ?? blank };
      if (drafts.get(key) === localDraft.current) drafts.delete(key);
      dirty.current = false;
      localDraft.current = next;
      setDraft(next);
      onSaved?.();
      setMessage(
        remove
          ? "Juego retirado de tu biblioteca."
          : "Juego guardado en tu biblioteca.",
      );
    } catch (e) {
      setMessage(publicError(e));
      setUncertain(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Guardar juego en biblioteca">
      <h2>Tu biblioteca</h2>
      <p>{draft.entry ? "Juego guardado" : "Sin guardar"}</p>
      <fieldset disabled={!ready || busy}>
        <legend>Marcas independientes</legend>
        <label>
          Estado
          <select
            value={draft.marks.state ?? ""}
            onChange={(e) =>
              change({
                ...draft.marks,
                state: (e.target.value || null) as LibraryMarks["state"],
              })
            }
          >
            <option value="">Sin clasificar</option>
            {Object.entries(libraryStateLabels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.marks.favorite}
            onChange={(e) =>
              change({ ...draft.marks, favorite: e.target.checked })
            }
          />
          Favorito
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.marks.interested}
            onChange={(e) =>
              change({ ...draft.marks, interested: e.target.checked })
            }
          />
          Me interesa
        </label>
        <label>
          Progreso opcional (0–100)
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={draft.marks.progress ?? ""}
            onChange={(e) =>
              change({
                ...draft.marks,
                progress: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </label>
        <button disabled={uncertain} onClick={() => void write()}>
          Guardar en biblioteca
        </button>
        {draft.entry && (
          <button disabled={uncertain} onClick={() => void write(true)}>
            Retirar de biblioteca
          </button>
        )}
      </fieldset>
      <button
        disabled={busy}
        onClick={() => {
          setReady(false);
          setAttempt((n) => n + 1);
        }}
      >
        Consultar estado guardado
      </button>
      {consulted && (
        <div>
          <p>
            Versión consultada: {consulted.entry?.version ?? "sin entrada"} ·
            Estado: {consulted.entry?.state ?? "sin clasificar"} · Favorito:{" "}
            {consulted.entry?.favorite ? "sí" : "no"} · Interés:{" "}
            {consulted.entry?.interested ? "sí" : "no"} · Progreso:{" "}
            {consulted.entry?.progress ?? "sin indicar"}
          </p>
          <button
            disabled={busy}
            onClick={() => {
              const next = { ...draft, entry: consulted.entry };
              dirty.current = true;
              localDraft.current = next;
              drafts.set(key, next);
              setDraft(next);
              setConsulted(null);
              setUncertain(false);
              setMessage(
                "Borrador preparado sobre la versión consultada. Confirma Guardar para enviarlo.",
              );
            }}
          >
            Aplicar borrador sobre la versión consultada
          </button>
        </div>
      )}
      {message && (
        <p role={uncertain || !ready ? "alert" : "status"}>{message}</p>
      )}
      <Link to="/library">Abrir mi biblioteca</Link>
    </section>
  );
}
