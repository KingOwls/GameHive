import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { publicError } from "../../services/errors";
export function AccountControl() {
  const { service, session, loading } = useAuth();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
      <button disabled={busy} onClick={logout}>
        {busy ? "Cerrando…" : error ? "Reintentar cierre" : "Cerrar sesión"}
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
