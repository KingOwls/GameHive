import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { StatePanel } from "../../components/StatePanel";
import type {
  ApplicationPage,
  CriticApplication,
  CriticApplicationInput,
} from "../../domain/models";
import {
  createCriticApplicationsService,
  type CriticApplicationsService,
  validApplicationInput,
} from "../../services/critic-applications";
import { publicError } from "../../services/errors";
import {
  ApplicationAccess,
  ApplicationEvidence,
  ApplicationPagination,
} from "./ApplicationShared";
const defaultService = createCriticApplicationsService();
const empty: CriticApplicationInput = {
  organization: "",
  experience: "",
  sample: "",
  links: [],
};
export function CriticApplicationPage({
  applications = defaultService,
}: {
  applications?: CriticApplicationsService;
}) {
  const auth = useAuth();
  return (
    <ApplicationAccess>
      <ApplicationForm
        key={auth.session?.user.id}
        actor={auth.session?.user.id ?? ""}
        applications={applications}
      />
    </ApplicationAccess>
  );
}
function ApplicationForm({
  actor,
  applications,
}: {
  actor: string;
  applications: CriticApplicationsService;
}) {
  const draftKey = `gamehive:critic-application:${actor}`;
  const [draft, setDraft] = useState<CriticApplicationInput>(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(draftKey) ?? "null");
      if (
        d &&
        typeof d.organization === "string" &&
        typeof d.experience === "string" &&
        typeof d.sample === "string" &&
        Array.isArray(d.links) &&
        d.links.every((l: unknown) => typeof l === "string")
      )
        return d;
    } catch {
      /* Storage is optional. */
    }
    return empty;
  });
  const [data, setData] = useState<ApplicationPage<CriticApplication> | null>(
      null,
    ),
    [page, setPage] = useState(1),
    [attempt, setAttempt] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [uncertain, setUncertain] = useState(false),
    [message, setMessage] = useState("");
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  useEffect(() => {
    if (!data?.nextAllowedAt) return;
    const delay = Date.parse(data.nextAllowedAt) - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(
      () => setCheckedAt(Date.now()),
      Math.min(delay, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [data?.nextAllowedAt]);
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
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      /* Storage is optional. */
    }
  }, [draft, draftKey]);
  useEffect(() => {
    const abort = new AbortController();
    applications
      .history(page, abort.signal)
      .then((d) => {
        if (!abort.signal.aborted) {
          setData(d);
          setCheckedAt(Date.now());
          setUncertain(false);
          setLoading(false);
          setError("");
        }
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted) {
          setData(null);
          setLoading(false);
          setError(publicError(e));
        }
      });
    return () => abort.abort();
  }, [applications, page, attempt]);
  function refresh() {
    setLoading(true);
    setAttempt((n) => n + 1);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending.current || uncertain) return;
    if (!validApplicationInput(draft)) {
      setError(
        "Procedencia: 3–120; experiencia: 40–3000; muestra: 40–5000 caracteres. Hasta tres enlaces HTTPS de 2048 caracteres.",
      );
      return;
    }
    sending.current = true;
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      await applications.submit(draft, controller.current.signal);
      if (alive.current) {
        setDraft(empty);
        setMessage(
          "Candidatura presentada. Solicitar no cambia tu rol ni tu verificación.",
        );
        setPage(1);
        refresh();
      }
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
  const waiting =
    !!data?.nextAllowedAt && checkedAt < Date.parse(data.nextAllowedAt);
  return (
    <>
      <p className="eyebrow">CANDIDATURA PRIVADA</p>
      <h1>Solicitar admisión como crítico</h1>
      <p>
        Cualquier usuario activo puede solicitar, incluso con sello previo; los
        críticos activos solo si no están verificados. Solo tú y los
        administradores activos pueden consultar la evidencia. Puedes indicar
        «Independiente». Los enlaces no se descargan. Tras un rechazo debes
        esperar siete días completos.
      </p>
      {loading && (
        <StatePanel kind="loading" title="Consultando estado guardado" />
      )}
      {error && (
        <StatePanel kind="error" title={error}>
          <button disabled={busy} onClick={refresh}>
            Consultar estado guardado
          </button>
        </StatePanel>
      )}
      {uncertain && (
        <p role="status">
          Comprueba el estado guardado antes de volver a enviar. Tu borrador se
          conserva.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          {!data.eligible && (
            <p>
              No eres elegible: se requiere un usuario activo (con cualquier
              sello) o un crítico activo sin verificar.
            </p>
          )}
          {data.hasPending && <p>Ya tienes una candidatura pendiente.</p>}
          {waiting && (
            <p>
              Puedes volver a solicitar desde{" "}
              {new Date(data.nextAllowedAt!).toLocaleString("es-CO")}.
            </p>
          )}
          <form className="manual-form" onSubmit={submit}>
            <fieldset
              disabled={
                busy ||
                loading ||
                uncertain ||
                !data.eligible ||
                data.hasPending ||
                waiting
              }
            >
              <legend>Tu candidatura</legend>
              {(["organization", "experience", "sample"] as const).map(
                (field) => (
                  <label key={field}>
                    {
                      {
                        organization: "Procedencia o grupo (3–120 caracteres)",
                        experience: "Experiencia (40–3000 caracteres)",
                        sample: "Muestra textual (40–5000 caracteres)",
                      }[field]
                    }
                    <textarea
                      required
                      value={draft[field]}
                      onChange={(e) =>
                        setDraft({ ...draft, [field]: e.target.value })
                      }
                    />
                  </label>
                ),
              )}
              <label>
                Enlaces HTTPS opcionales (uno por línea, hasta tres)
                <textarea
                  value={draft.links.join("\n")}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      links: e.target.value ? e.target.value.split("\n") : [],
                    })
                  }
                />
              </label>
              <button type="submit">
                {busy ? "Presentando…" : "Presentar candidatura"}
              </button>
            </fieldset>
          </form>
          <h2>Mi historial</h2>
          {data.items.length === 0 && (
            <StatePanel
              kind="empty"
              title="Aún no has presentado candidaturas"
            />
          )}
          {data.items.map((a) => (
            <ApplicationEvidence key={a.id} application={a} />
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
