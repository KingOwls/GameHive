import { CriticApplicationPage } from "../features/critics/CriticApplicationPage";
import { CriticApplicationsPage } from "../features/admin/CriticApplicationsPage";
import { NotificationsPage } from "../features/notifications/NotificationsPage";
import { LibraryPage } from "../features/library/LibraryPage";
import { ProfilePage } from "../features/profiles/ProfilePage";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { ThemeControl } from "./ThemeControl";
import { createCatalogProvider } from "../services/catalog";
import { CatalogPage } from "../features/catalog/CatalogPage";
import { GameDetailPage } from "../features/catalog/GameDetailPage";
import { StatePanel } from "../components/StatePanel";
import { SpoilerReveal } from "../components/SpoilerReveal";
import { AuthProvider } from "../features/auth/AuthContext";
import { AuthPage } from "../features/auth/AuthPage";
import { AccountControl } from "../features/auth/AccountControl";
import { OnboardingPage } from "../features/onboarding/OnboardingPage";
import { AdminGamesPage } from "../features/admin/AdminGamesPage";
import { ManualCatalogPage } from "../features/catalog/ManualCatalogPage";
import { ManualGameDetailPage } from "../features/catalog/ManualGameDetailPage";
const provider = createCatalogProvider(import.meta.env);
function Showcase() {
  return (
    <>
      <p className="eyebrow">LABORATORIO VISUAL · G0</p>
      <h1>El lenguaje de la colmena.</h1>
      <p>
        Vitrina de componentes. Los siguientes estados son ejemplos de interfaz,
        no operaciones en curso.
      </p>
      <StatePanel kind="empty" title="Tu próximo mundo está por descubrir" />
      <StatePanel kind="error" title="Ejemplo de fallo recuperable" />
      <StatePanel kind="loading" title="Ejemplo visual de carga" />
      <SpoilerReveal text="Contenido de ejemplo oculto hasta tu confirmación." />
    </>
  );
}
function Setup() {
  return (
    <>
      <p className="eyebrow">ESTADO DE IMPLEMENTACIÓN</p>
      <h1>Una comunidad necesita una base segura.</h1>
      <div className="notice">
        <strong>Identidad real disponible al configurar Supabase</strong>
        <span>
          El registro, perfil y sesión usan Supabase Auth y políticas RLS. La
          conexión depende de la configuración pública de este entorno.
        </span>
      </div>
      <p>
        {provider.mode === "live"
          ? "El catálogo consulta RAWG mediante el servidor configurado."
          : "El catálogo curado funciona sin conexión."}{" "}
        Reseñas propias disponibles en fichas reales. Biblioteca disponible para
        juegos persistidos. Moderación pendiente.
      </p>
      <Link className="button" to="/explore">
        Explorar juegos
      </Link>
    </>
  );
}
export function App() {
  return (
    <AuthProvider>
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <header className="site-header">
        <Link className="brand" to="/" title="Ir al inicio">
          <img src="/hive.svg" alt="" width="36" height="36" />
          GAME<span>HIVE</span>
          <small>ALPHA</small>
        </Link>
        <nav aria-label="Navegación principal">
          <NavLink to="/explore">Explorar</NavLink>
          <NavLink to="/design-system">Vitrina UI</NavLink>
          <NavLink to="/setup">Estado del proyecto</NavLink>
        </nav>
        <AccountControl />
        <ThemeControl />
      </header>
      <main id="main">
        <Routes>
          <Route path="/" element={<CatalogPage provider={provider} />} />
          <Route
            path="/explore"
            element={<CatalogPage provider={provider} />}
          />
          <Route path="/search" element={<CatalogPage provider={provider} />} />
          <Route
            path="/games/:id"
            element={<GameDetailPage provider={provider} />}
          />
          <Route path="/critic/apply" element={<CriticApplicationPage />} />
          <Route path="/admin/users" element={<CriticApplicationsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/admin/games" element={<AdminGamesPage />} />
          <Route path="/manual-games" element={<ManualCatalogPage />} />
          <Route path="/manual-games/:id" element={<ManualGameDetailPage />} />
          <Route path="/design-system" element={<Showcase />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage register />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/u/:handle" element={<ProfilePage />} />
          <Route path="/u/:handle/library" element={<LibraryPage />} />
          <Route path="/settings" element={<OnboardingPage />} />
          <Route
            path="*"
            element={
              <StatePanel kind="empty" title="Esta página no está disponible">
                <Link to="/">Volver al inicio</Link>
              </StatePanel>
            }
          />
        </Routes>
      </main>
      <footer>
        <p className="brand">
          GAMEHIVE <span> / PLAY WITH PERSPECTIVE</span>
        </p>
        <p>
          Proyecto académico · Implementación independiente ·{" "}
          {provider.mode === "live" ? (
            <>
              Catálogo con datos de{" "}
              <a
                href="https://rawg.io"
                target="_blank"
                rel="noopener noreferrer"
              >
                RAWG
              </a>
            </>
          ) : (
            "Catálogo curado sin conexión"
          )}
        </p>
        <Link to="/setup">Consultar el estado de integración ↗</Link>
      </footer>
    </AuthProvider>
  );
}
