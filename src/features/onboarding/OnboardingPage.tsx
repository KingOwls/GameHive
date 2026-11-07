import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import type {
  Identity,
  PublicProfile,
  UserSettings,
} from "../../domain/models";
import { useAuth } from "../auth/AuthContext";
import { AuthUnavailable } from "../auth/AuthPage";
import { StatePanel } from "../../components/StatePanel";
import { publicError } from "../../services/errors";
import type { AuthService } from "../../services/auth";
import type { ThemeMode } from "../../domain/models";
function applySavedTheme(mode: ThemeMode) {
  if (!["system", "dark", "light"].includes(mode)) return;
  try {
    localStorage.setItem("gamehive-theme", mode);
    window.dispatchEvent(
      new StorageEvent("storage", { key: "gamehive-theme", newValue: mode }),
    );
  } catch {
    /* The saved preference remains available from the server. */
  }
}
type Account = {
  identity: Identity;
  data: { profile: PublicProfile; settings: UserSettings } | null;
};
export function OnboardingPage() {
  const { service, session, loading } = useAuth();
  if (!service) return <AuthUnavailable />;
  if (loading) return <StatePanel kind="loading" title="Comprobando sesión" />;
  if (!session) return <Navigate to="/login" replace />;
  // A changed session UUID unmounts all private data and uncontrolled form fields
  // before the next account's asynchronous requests have resolved.
  return (
    <OnboardingAccount
      key={session.user.id}
      service={service}
      userId={session.user.id}
    />
  );
}
function OnboardingAccount({
  service,
  userId,
}: {
  service: AuthService;
  userId: string;
}) {
  const mounted = useRef(false);
  const [account, setAccount] = useState<Account | null>(null),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    async function load() {
      const identity = await service.identity();
      if (!active) return;
      if (identity.status !== "active") {
        setAccount({ identity, data: null });
        setError("");
        return;
      }
      const [profile, settings] = await Promise.all([
        service.profile(userId),
        service.settings(userId),
      ]);
      if (active) {
        setAccount({ identity, data: { profile, settings } });
        applySavedTheme(settings.theme_mode);
        setError("");
      }
    }
    load().catch((e: unknown) => {
      if (active) setError(publicError(e));
    });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [service, userId, attempt]);
  if (!account)
    return error ? (
      <StatePanel kind="error" title="No pudimos cargar tu perfil">
        <p>{error}</p>
        <button onClick={() => setAttempt((n) => n + 1)}>Reintentar</button>
      </StatePanel>
    ) : (
      <StatePanel kind="loading" title="Cargando tu perfil" />
    );
  if (account.identity.status !== "active")
    return (
      <StatePanel kind="error" title="Cuenta suspendida">
        <p>
          La cuenta no puede modificar datos. Puedes cerrar sesión desde la
          navegación.
        </p>
      </StatePanel>
    );
  if (!account.data)
    return <StatePanel kind="loading" title="Cargando tu perfil" />;
  const { profile, settings } = account.data;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const profile = await service.updateProfile(userId, {
        username: String(values.get("username")).trim(),
        bio: String(values.get("bio")),
        avatar_key: String(values.get("avatar")) as PublicProfile["avatar_key"],
      });
      if (!mounted.current) return;
      setAccount((current) =>
        current?.data
          ? { ...current, data: { ...current.data, profile } }
          : current,
      );
      const settings = await service.updateSettings(userId, {
        theme_mode: String(values.get("theme")) as UserSettings["theme_mode"],
        platforms: values.getAll("platform").map(String),
        genres: values.getAll("genre").map(String),
        interests: String(values.get("interests")),
        onboarding_complete: true,
      });
      if (!mounted.current) return;
      setAccount((current) =>
        current?.data
          ? { ...current, data: { ...current.data, settings } }
          : current,
      );
      applySavedTheme(settings.theme_mode);
      setSaved(true);
    } catch (e) {
      if (mounted.current) setError(publicError(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="auth-panel">
      <p className="eyebrow">PERFIL Y PREFERENCIAS PRIVADAS</p>
      <h1>Tu lugar en la colmena.</h1>
      <img
        src={`/avatars/${profile.avatar_key}.svg`}
        width="80"
        height="80"
        alt="Tu avatar GameHive"
      />
      <p>
        Rol vigente: {account.identity.role} · Crítico{" "}
        {account.identity.criticVerified ? "verificado" : "sin verificar"}
      </p>
      <p>
        <Link to={`/u/${profile.username}`}>Ver mi perfil público</Link>
      </p>
      <form onSubmit={submit} aria-busy={busy}>
        <label>
          Alias público
          <input
            name="username"
            required
            pattern="[A-Za-z0-9_]{3,24}"
            minLength={3}
            maxLength={24}
            defaultValue={profile.username}
          />
        </label>
        <label>
          Biografía pública
          <textarea name="bio" maxLength={500} defaultValue={profile.bio} />
        </label>
        <label>
          Avatar
          <select name="avatar" defaultValue={profile.avatar_key}>
            <option value="hive">Colmena</option>
            <option value="orbit">Órbita</option>
            <option value="spark">Chispa</option>
          </select>
        </label>
        <fieldset>
          <legend>Plataformas que te interesan</legend>
          {["PC", "PlayStation", "Xbox", "Nintendo"].map((item) => (
            <label className="check-option" key={item}>
              <input
                type="checkbox"
                name="platform"
                value={item}
                defaultChecked={settings.platforms.includes(item)}
              />
              {item}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Géneros que te interesan</legend>
          {["Acción", "Aventura", "RPG", "Estrategia", "Indie", "Deportes"].map(
            (item) => (
              <label className="check-option" key={item}>
                <input
                  type="checkbox"
                  name="genre"
                  value={item}
                  defaultChecked={settings.genres.includes(item)}
                />
                {item}
              </label>
            ),
          )}
        </fieldset>
        <label>
          Estilo, narrativa y juegos que te interesan (privado)
          <textarea
            name="interests"
            maxLength={500}
            defaultValue={settings.interests}
          />
        </label>
        <label>
          Tema preferido
          <select name="theme" defaultValue={settings.theme_mode}>
            <option value="system">Sistema</option>
            <option value="dark">Oscuro</option>
            <option value="light">Claro</option>
          </select>
        </label>
        <p>
          La privacidad se cambia expresamente desde{" "}
          <Link to="/library">tu biblioteca</Link>.
        </p>
        {error && (
          <p role="alert">
            {error} Si el perfil se guardó antes del fallo de preferencias,
            puedes reintentar.
          </p>
        )}
        {saved && <p role="status">Perfil y preferencias guardados.</p>}
        <button className="button" disabled={busy} type="submit">
          {busy ? "Guardando…" : "Guardar preferencias"}
        </button>
      </form>
    </section>
  );
}
