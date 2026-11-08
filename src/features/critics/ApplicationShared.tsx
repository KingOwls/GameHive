import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { StatePanel } from "../../components/StatePanel";
import type { CriticApplication, ApplicationStatus } from "../../domain/models";
export const applicationStatus: Record<ApplicationStatus, string> = {
  pending: "Pendiente",
  approved: "Admitida",
  rejected: "Rechazada",
  cancelled: "Anulada",
};
export function ApplicationAccess({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.loading)
    return <StatePanel kind="loading" title="Comprobando sesión" />;
  if (auth.error)
    return (
      <StatePanel kind="error" title={auth.error}>
        <button onClick={auth.retry}>Reintentar</button>
      </StatePanel>
    );
  if (!auth.session)
    return (
      <StatePanel kind="empty" title="Inicia sesión para continuar">
        <Link to="/login">Iniciar sesión</Link>
      </StatePanel>
    );
  return children;
}
export function ApplicationEvidence({
  application: a,
}: {
  application: CriticApplication;
}) {
  return (
    <article className="notice application-evidence">
      <h3>
        {applicationStatus[a.status]} ·{" "}
        {new Date(a.created_at).toLocaleString("es-CO")}
      </h3>
      <p>Cuenta: {a.user_id}</p>
      <dl>
        <dt>Procedencia o grupo</dt>
        <dd>{a.organization}</dd>
        <dt>Experiencia</dt>
        <dd style={{ whiteSpace: "pre-wrap" }}>{a.experience}</dd>
        <dt>Muestra textual</dt>
        <dd style={{ whiteSpace: "pre-wrap" }}>{a.sample}</dd>
      </dl>
      {a.links.length > 0 && (
        <ul>
          {a.links.map((link, i) => (
            <li key={`${i}:${link}`}>
              <a href={link} target="_blank" rel="noopener noreferrer">
                Enlace de evidencia {i + 1}
              </a>
            </li>
          ))}
        </ul>
      )}
      {a.resolved_by && <p>Resuelta por: {a.resolved_by}</p>}
      {a.reason && <p>Motivo: {a.reason}</p>}
      {a.resolved_at && (
        <p>Resolución: {new Date(a.resolved_at).toLocaleString("es-CO")}</p>
      )}
    </article>
  );
}
export function ApplicationPagination({
  page,
  total,
  busy,
  onChange,
}: {
  page: number;
  total: number;
  busy: boolean;
  onChange: (p: number) => void;
}) {
  return (
    <nav aria-label="Páginas">
      <button disabled={busy || page === 1} onClick={() => onChange(page - 1)}>
        Anterior
      </button>
      <span> Página {page} </span>
      <button
        disabled={busy || page * 20 >= total}
        onClick={() => onChange(page + 1)}
      >
        Siguiente
      </button>
    </nav>
  );
}
