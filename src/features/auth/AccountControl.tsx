import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { publicError } from "../../services/errors";
export function AccountControl() {
  const { service, session, loading, error: authError } = useAuth();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [adminActor, setAdminActor] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (service && session && !authError)
      service
        .identity()
        .then((i) => {
          if (active)
            setAdminActor(
              i.role === "admin" && i.status === "active"
                ? session.user.id
                : null,
            );
        })
        .catch(() => {
          if (active) setAdminActor(null);
        });
    return () => {
      active = false;
    };
  }, [service, session, authError]);
  if (!service) return <NavLink to="/login">Cuenta</NavLink>;
  if (loading) return <span role="status">Comprobando sesión…</span>;
  if (!session) return <NavLink to="/login">Iniciar sesión</NavLink>;
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await service!.logout();
    } catch (e) {
      setError(publicError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-control">
      <NavLink to="/onboarding">Mi perfil</NavLink>
      <NavLink to="/library">Mi biblioteca</NavLink>
      <NavLink to="/critic/apply">Solicitud de crítico</NavLink>
      <NavLink to="/notifications">Mis avisos</NavLink>
      {!authError && adminActor === session.user.id && (
        <NavLink to="/admin/users">Admisión de críticos</NavLink>
      )}
      <button disabled={busy} onClick={logout}>
        {busy ? "Cerrando…" : error ? "Reintentar cierre" : "Cerrar sesión"}
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
