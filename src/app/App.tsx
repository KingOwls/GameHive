import { Link, NavLink, Route, Routes } from "react-router-dom";
import { ThemeControl } from "./ThemeControl";
import { CuratedCatalogProvider } from "../features/catalog/curated";
import { CatalogPage } from "../features/catalog/CatalogPage";
import { GameDetailPage } from "../features/catalog/GameDetailPage";
import { StatePanel } from "../components/StatePanel";
import { SpoilerReveal } from "../components/SpoilerReveal";
const provider = new CuratedCatalogProvider();
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
        <strong>Autenticación todavía no habilitada</strong>
        <span>
          Este entorno no está conectado a Supabase. No solicita ni guarda
          contraseñas.
        </span>
      </div>
      <p>
        El catálogo curado funciona sin conexión. Registro, sesiones, biblioteca
        y moderación se habilitarán después de verificar Auth y RLS.
      </p>
      <Link className="button" to="/explore">
        Explorar juegos
      </Link>
    </>
  );
}
export function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="GameHive, inicio">
          <img src="/hive.svg" alt="" width="36" height="36" />
          GAME<span>HIVE</span>
          <small>ALPHA</small>
        </Link>
        <nav aria-label="Navegación principal">
          <NavLink to="/explore">Explorar</NavLink>
          <NavLink to="/design-system">Vitrina UI</NavLink>
          <NavLink to="/setup">Estado del proyecto</NavLink>
        </nav>
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
          <Route path="/design-system" element={<Showcase />} />
          <Route path="/setup" element={<Setup />} />
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
          Proyecto académico · Implementación independiente · Catálogo curado
          sin conexión
        </p>
        <Link to="/setup">Consultar el estado de integración ↗</Link>
      </footer>
    </>
  );
}
