import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { StatePanel } from "../../components/StatePanel";
import { publicError } from "../../services/errors";
import type { ApplicationNotice, ApplicationPage } from "../../domain/models";
import {
  createCriticApplicationsService,
  type CriticApplicationsService,
} from "../../services/critic-applications";
import {
  ApplicationAccess,
  ApplicationPagination,
  applicationStatus,
} from "../critics/ApplicationShared";
const defaultService = createCriticApplicationsService();
export function NotificationsPage({
  applications = defaultService,
}: {
  applications?: CriticApplicationsService;
}) {
  const auth = useAuth();
  return (
    <ApplicationAccess>
      <Notices key={auth.session?.user.id} applications={applications} />
    </ApplicationAccess>
  );
}
function Notices({
  applications,
}: {
  applications: CriticApplicationsService;
}) {
  const [data, setData] = useState<ApplicationPage<ApplicationNotice> | null>(
      null,
    ),
    [page, setPage] = useState(1),
    [attempt, setAttempt] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const alive = useRef(true),
    sending = useRef(false),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    applications
      .notices(page, abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) {
          setData(result);
          setLoading(false);
          setError("");
          setUncertain(false);
        }
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted) {
          setData(null);
          setError(publicError(e));
          setLoading(false);
        }
      });
    return () => abort.abort();
  }, [applications, page, attempt]);
  function refresh() {
    setLoading(true);
    setAttempt((n) => n + 1);
  }
  async function mark(id: string) {
    if (sending.current || uncertain) return;
    sending.current = true;
    setBusy(true);
    controller.current = new AbortController();
    try {
      await applications.markRead(id, controller.current.signal);
      if (alive.current) refresh();
    } catch (e) {
      if (alive.current) {
        setError(publicError(e));
        setUncertain(true);
      }
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">BANDEJA PRIVADA</p>
      <h1>Mis avisos</h1>
      <p>
        Puedes consultar tus avisos con sesión vigente incluso si tu cuenta está
        suspendida.
      </p>
      {loading && <StatePanel kind="loading" title="Consultando avisos" />}
      {error && (
        <StatePanel kind="error" title={error}>
          <button disabled={busy} onClick={refresh}>
            Consultar avisos guardados
          </button>
        </StatePanel>
      )}
      {data && (
        <>
          {!data.items.length && (
            <StatePanel kind="empty" title="No tienes avisos" />
          )}
          {data.items.map((n) => (
            <article className="notice" key={n.id}>
              <h2>Candidatura {applicationStatus[n.outcome].toLowerCase()}</h2>
              <p>{n.reason}</p>
              <p>{new Date(n.created_at).toLocaleString("es-CO")}</p>
              {n.read_at ? (
                <p>Leído</p>
              ) : (
                <button
                  disabled={busy || loading || uncertain}
                  onClick={() => void mark(n.id)}
                >
                  Marcar leído
                </button>
              )}
            </article>
          ))}
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
