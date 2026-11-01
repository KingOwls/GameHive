import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { publicError } from "../../services/errors";
import { StatePanel } from "../../components/StatePanel";
export function AuthUnavailable() {
  return (
    <StatePanel kind="error" title="Autenticación sin configurar">
      <p>
        Configura la URL y la clave publicable de Supabase para usar una cuenta
        real.
      </p>
      <Link to="/explore">Explorar juegos</Link>
    </StatePanel>
  );
}
export function AuthPage({ register = false }: { register?: boolean }) {
  const { service, session, loading, error: sessionError, retry } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!service) return <AuthUnavailable />;
  if (loading) return <StatePanel kind="loading" title="Comprobando sesión" />;
  if (session) return <Navigate to="/onboarding" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      if (register)
        await service!.register(
          String(values.get("email")).trim(),
          String(values.get("password")),
          String(values.get("username")).trim(),
        );
      else
        await service!.login(
          String(values.get("email")).trim(),
          String(values.get("password")),
        );
      form.reset();
      navigate("/onboarding", { replace: true });
    } catch (e) {
      setError(publicError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-panel">
      <p className="eyebrow">TU IDENTIDAD EN GAMEHIVE</p>
      <h1>{register ? "Crea tu cuenta." : "Vuelve a la colmena."}</h1>
      {sessionError && (
        <p role="alert">
          {sessionError} <button onClick={retry}>Reintentar sesión</button>
        </p>
      )}
      <form onSubmit={submit} aria-busy={busy}>
        {register && (
          <label>
            Alias público
            <input
              name="username"
              required
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9_]{3,24}"
              autoComplete="username"
              aria-describedby="alias-help"
            />
            <small id="alias-help">
              3–24 letras, números o guion bajo. Gamer y gamer reservan el mismo
              alias.
            </small>
          </label>
        )}
        <label>
          Correo electrónico
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            name="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={register ? 12 : 1}
            maxLength={128}
          />
        </label>
        {register && (
          <p>
            Demo académica: el correo no requiere confirmación. Usa una
            contraseña de al menos 12 caracteres.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <button className="button" disabled={busy} type="submit">
          {busy ? "Conectando…" : register ? "Crear cuenta" : "Iniciar sesión"}
        </button>
      </form>
      <p>
        <Link to={register ? "/login" : "/register"}>
          {register ? "Ya tengo cuenta" : "Crear una cuenta"}
        </Link>
      </p>
    </section>
  );
}
