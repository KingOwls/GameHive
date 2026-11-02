# GameHive

Aplicación universitaria desarrollada desde cero con React, Vite y TypeScript; Supabase Auth/PostgreSQL/RLS/Edge Functions. Repositorio independiente: [KingOwls/GameHive](https://github.com/KingOwls/GameHive). No se modificó ni copió código/recursos de `KingOwls/ProjectWebVideoGame`.

**Estado2026-11-02: G0–G2 verificados; GH-020–022 verificados localmente. Producto P0 incompleto.** Funcionan identidad real, cuatro roles protegidos, catálogo RAWG, catálogo manual administrativo, reseñas/spoilers y análisis críticos completos. Solicitudes, votos, comentarios, puntuaciones agregadas, biblioteca y moderación siguen pendientes. Vercel aún no está desplegado.

Consultar [PROGRESS](docs/PROGRESS.md), [requisitos](docs/REQUIREMENTS.md), [bloqueos](docs/BLOCKERS.md) y [demo funcional](docs/DEMO.md). Las evidencias locales y remotas se distinguen en los informes `qa-reports/`; G3 todavía no está publicado en Supabase remoto.

## Ejecutar en Ubuntu

Requisitos: Git, Node24 y npm11. Docker para Supabase local; Chromium/dependencias para E2E.

```bash
git clone https://github.com/KingOwls/GameHive.git
cd GameHive
npm ci
npm run build
npm run preview
```

Abrir la URL de Vite. Sin configuración se muestra un catálogo curado explícitamente sin conexión. Esta modalidad permite explorar la UI y no acredita RAWG ni persistencia. Los cambios se entregan progresivamente en PRs; consultar el PR/rama del avance que se desea evaluar si todavía no está integrado a `main`.

Para backend real, seguir [identidad](docs/IDENTITY.md), [catálogo/RAWG](docs/CATALOG.md) e [infraestructura](docs/INFRASTRUCTURE.md). Copiar `.env.example` a `.env.local` solo con los valores públicos propios: URL y clave publicable Supabase. RAWG_API_KEY pertenece al servidor. Nunca usar claves secretas/service_role como variables VITE ni enviarlas por chat/git/logs.

## Pruebas

```bash
npm run check
npx playwright install --with-deps chromium
npm run test:e2e
```

Con stack local migrado y funciones servidas, las suites backend verifican realmente Auth, PostgreSQL/RLS y Edge:

```bash
npm run test:sql
npm run test:backend -- --e2e
npm run test:manual -- --e2e
GH_REVIEWS_ISOLATED=1 npm run test:reviews -- --e2e
```

El modo aislado sustituye únicamente el contrato de catálogo y no acredita una llamada RAWG; Auth/reseñas/DB siguen siendo reales locales. La vía `npm run test:reviews -- --e2e` requiere un juego RAWG completo previamente persistido. Los helpers crean/limpian fixtures y no imprimen credenciales. Deno frozen/DB y CI están documentados en los informes por historia.

Último cierre GH-022:227Vitest,316SQL, dos rondas de revisión independiente, HTTP/E2E real e aislado, regresiones y limpieza verificadas; [detalle y límites](qa-reports/G3-CRITICAL.md). La advertencia de bundle grande queda pendiente para rendimientoG6.

## Estructura y método

- `src/app`, `src/features`, `src/services`, `src/domain`: SPA modular, contratos y servicios reales.
- `supabase/migrations`, `functions`, `tests`: esquema versionado, autorización sensible y pruebas SQL/runtime.
- `tests`: unitarias, integración UI/HTTP, seguridad y E2E.
- `_bmad`, `.agents/skills`, `_bmad-output`: BMAD6.12.4, historias aprobadas y revisión registrada.
- `docs`, `qa-reports`: decisiones, progreso, incidencias, correcciones y evidencia real.
- `.github/workflows/ci.yml`: comprobaciones de base y backend local sin secretos remotos.

No hay cuentas ni contraseñas privilegiadas predefinidas. El primer administrador requiere un operador autorizado; modificar metadata o registrar una cuenta nunca concede privilegios. Los documentos suministrados son requisitos, no autorizaciones adicionales para servicios externos.
