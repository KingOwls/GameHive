import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { StatePanel } from "../../components/StatePanel";
import { publicError } from "../../services/errors";
import type {
  ApplicationPage,
  CriticApplication,
  AdminCriticApplication,
  Identity,
} from "../../domain/models";
import {
  ApplicationsError,
  createCriticApplicationsService,
  type CriticApplicationsService,
} from "../../services/critic-applications";
import {
  ApplicationAccess,
  ApplicationEvidence,
  ApplicationPagination,
} from "../critics/ApplicationShared";
const defaultService = createCriticApplicationsService();
const roleLabels: Record<Identity["role"], string> = {
  user: "Usuario",
  critic: "Crítico",
  moderator: "Moderador",
  admin: "Administrador",
};
const statusLabels: Record<Identity["status"], string> = {
  active: "Activa",
  suspended: "Suspendida",
};
export function CriticApplicationsPage({
  applications = defaultService,
}: {
  applications?: CriticApplicationsService;
}) {
  const auth = useAuth();
  return (
    <ApplicationAccess>
      <AdminQueue key={auth.session?.user.id} applications={applications} />
    </ApplicationAccess>
  );
}
function AdminQueue({
  applications,
}: {
  applications: CriticApplicationsService;
}) {
  const auth = useAuth();
  const [identity, setIdentity] = useState<Identity | null>(null),
    [data, setData] = useState<ApplicationPage<AdminCriticApplication> | null>(
      null,
    ),
    [page, setPage] = useState(1),
    [attempt, setAttempt] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState<string | null>(null),
    [result, setResult] = useState<CriticApplication | null>(null),
    [reviewPending, setReviewPending] = useState(false),
    [history, setHistory] = useState(false);
  const recovery = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null),
    alive = useRef(true),
    sending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    auth.service
      ?.identity()
      .then(async (current) => {
        if (abort.signal.aborted) return;
        setIdentity(current);
        if (current.role === "admin" && current.status === "active") {
          if (recovery.current) {
            const saved = await applications.adminGet(
              recovery.current,
              abort.signal,
            );
            if (abort.signal.aborted) return;
            setResult(saved);
            setReviewPending(saved.status === "pending");
          }
          const result = await (history
            ? applications.adminHistory(page, abort.signal)
            : applications.queue(page, abort.signal));
          if (!abort.signal.aborted) {
            const last = Math.max(1, Math.ceil(result.total / 20));
            if (page > last) {
              setPage(last);
              return;
            }
            setData(result);
            setUncertain(null);
            recovery.current = null;
          }
        }
        if (!abort.signal.aborted) {
          setLoading(false);
          setError("");
        }
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted) {
          setData(null);
          setIdentity(null);
          setResult(null);
          setError(publicError(e));
          setLoading(false);
        }
      });
    return () => abort.abort();
  }, [auth.service, applications, page, attempt, history]);
  function refresh() {
    setLoading(true);
    setAttempt((n) => n + 1);
  }
  async function decide(
    a: CriticApplication,
    decision: "approved" | "rejected" | "cancelled",
    reason: string,
  ) {
    if (sending.current || uncertain || reviewPending) return;
    sending.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    controller.current = new AbortController();
    try {
      const saved =
        decision === "cancelled"
          ? await applications.cancel(a, reason, controller.current.signal)
          : await applications.resolve(
              a,
              decision,
              reason,
              controller.current.signal,
            );
      if (alive.current) {
        setResult(saved);
        refresh();
      }
    } catch (e) {
      if (alive.current) {
        if (e instanceof ApplicationsError && [401, 403].includes(e.status)) {
          setData(null);
          setIdentity(null);
          setResult(null);
        }
        setError(publicError(e));
        setUncertain(a.id);
        recovery.current = a.id;
      }
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">ADMINISTRACIÓN</p>
      <h1>Admisión de críticos</h1>
      {loading && (
        <StatePanel
          kind="loading"
          title="Comprobando permisos y candidaturas"
        />
      )}
      {error && (
        <StatePanel kind="error" title={error}>
          <button disabled={busy} onClick={refresh}>
            Consultar cola guardada
          </button>
        </StatePanel>
      )}
      {uncertain && (
        <p role="status">
          Consulta el estado guardado para recuperar esta candidatura por su ID
          antes de otra decisión. El motivo se conserva.
        </p>
      )}
      {identity?.role === "admin" &&
        identity.status === "active" &&
        result &&
        !loading && (
          <section aria-label="Resultado consultado">
            <h2>Resultado guardado</h2>
            <ApplicationEvidence application={result} />
            {reviewPending && (
              <>
                <p>
                  La solicitud sigue pendiente. Revisa de nuevo su estado y tu
                  decisión.
                </p>
                <button
                  onClick={() => {
                    setReviewPending(false);
                    setResult(null);
                  }}
                >
                  Revisar decisión pendiente
                </button>
              </>
            )}
          </section>
        )}
      {identity &&
        (identity.role !== "admin" || identity.status !== "active") && (
          <StatePanel
            kind="empty"
            title="Acceso restringido a administradores activos"
          />
        )}
      {identity?.role === "admin" && identity.status === "active" && data && (
        <>
          <button
            disabled={busy || loading || !!uncertain}
            onClick={() => {
              setHistory(!history);
              setPage(1);
              setLoading(true);
            }}
          >
            {history ? "Ver pendientes" : "Ver historial administrativo"}
          </button>
          <h2>
            {history ? "Historial administrativo" : "Candidaturas pendientes"}
          </h2>
          <p>
            La admisión concede rol crítico y verificación. Rechazar exige siete
            días de espera. Anula solo si cambió el rol o sello; la suspensión
            temporal mantiene la solicitud.
          </p>
          {!data.items.length && (
            <StatePanel
              kind="empty"
              title={
                history
                  ? "No hay candidaturas en el historial"
                  : "No hay candidaturas pendientes"
              }
            />
          )}
          {data.items.map((a) =>
            a.status === "pending" ? (
              <DecisionForm
                key={a.id}
                actor={auth.session!.user.id}
                application={a}
                disabled={busy || loading || !!uncertain || reviewPending}
                onDecide={decide}
              />
            ) : (
              <ApplicationEvidence key={a.id} application={a} />
            ),
          )}
          <ApplicationPagination
            page={page}
            total={data.total}
            busy={busy || loading}
            onChange={(p) => {
              setLoading(true);
              setPage(p);
            }}
          />
        </>
      )}
    </>
  );
}
function DecisionForm({
  actor,
  application: a,
  disabled,
  onDecide,
}: {
  actor: string;
  application: AdminCriticApplication;
  disabled: boolean;
  onDecide: (
    a: CriticApplication,
    d: "approved" | "rejected" | "cancelled",
    r: string,
  ) => Promise<void>;
}) {
  const key = `gamehive:application-decision:${actor}:${a.id}`;
  type Decision = "approved" | "rejected" | "cancelled";
  const [draft, setDraft] = useState<{ reason: string; decision: Decision }>(
    () => {
      try {
        const stored = JSON.parse(sessionStorage.getItem(key) ?? "null");
        if (
          stored &&
          typeof stored.reason === "string" &&
          ["approved", "rejected", "cancelled"].includes(stored.decision)
        )
          return stored;
      } catch {
        /* Old drafts must be reviewed explicitly. */
      }
      return { reason: "", decision: "approved" };
    },
  );
  const { reason, decision } = draft;
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {
      /* Storage is optional. */
    }
  }, [key, draft]);
  const current = a.current_authority;
  const changed =
    current &&
    (current.role !== a.expected_role ||
      current.critic_verified !== a.expected_verified);
  const suspended = current?.status !== "active";
  function submit(e: FormEvent) {
    e.preventDefault();
    const length = Array.from(reason.trim()).length;
    if (length < 10 || length > 500) {
      setError("Escribe un motivo de 10 a 500 caracteres.");
      return;
    }
    setError("");
    void onDecide(a, decision, reason);
  }
  return (
    <section>
      <ApplicationEvidence application={a} />
      <p>
        Al solicitar: {roleLabels[a.expected_role]} ·{" "}
        {statusLabels[a.expected_status]} · sello{" "}
        {a.expected_verified ? "sí" : "no"}.
      </p>
      <p>
        Ahora: {current && roleLabels[current.role]} ·{" "}
        {current && statusLabels[current.status]} · sello{" "}
        {current?.critic_verified ? "sí" : "no"}.
      </p>
      {suspended ? (
        <p>Suspensión temporal: la candidatura se conserva hasta reactivar.</p>
      ) : changed ? (
        <p>
          Cambió el rol o sello. Puedes anular con motivo; no se puede admitir
          ni rechazar esta candidatura.
        </p>
      ) : (
        <p>Autoridad vigente coincide con la candidatura.</p>
      )}
      <form className="manual-form" onSubmit={submit}>
        <fieldset disabled={disabled || actor === a.user_id || suspended}>
          <legend>Decisión para candidatura {a.id}</legend>
          <label>
            Decisión
            <select
              value={decision}
              onChange={(e) =>
                setDraft({ ...draft, decision: e.target.value as Decision })
              }
            >
              <option disabled={changed} value="approved">
                Admitir y verificar
              </option>
              <option disabled={changed} value="rejected">
                Rechazar
              </option>
              <option disabled={!changed} value="cancelled">
                Anular por cambio de rol o sello
              </option>
            </select>
          </label>
          <label>
            Motivo privado (10–500 caracteres)
            <textarea
              required
              value={reason}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
            />
          </label>
          <button
            disabled={decision === "cancelled" ? !changed : changed}
            type="submit"
          >
            Guardar decisión
          </button>
          {actor === a.user_id && (
            <p>No puedes resolver tu propia candidatura.</p>
          )}
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
