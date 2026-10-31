# GameHive

Implementación independiente desde cero para el proyecto universitario. React + Vite + TypeScript; backend previsto Supabase PostgreSQL/Auth/RLS; alojamiento final previsto Vercel.

**Estado: base G0 comprobada localmente; producto P0 todavía incompleto.** Consulta [avance real](docs/PROGRESS.md), [bloqueos](docs/BLOCKERS.md), [matriz de requisitos](docs/REQUIREMENTS.md) y [resultados QA](qa-reports/G0-RESULTS.md). No hay autenticación simulada. El catálogo de ocho juegos es editorial, explícitamente sin conexión, con enlaces oficiales; no es una integración RAWG certificada.

## Ejecutar en Ubuntu

Requisitos: Git, Node 24 LTS, npm 11. Para E2E, Chromium y sus dependencias de sistema. Para Supabase local se requiere Docker operativo; no hace falta para explorar la base G0.

```bash
cd /home/jhonatan-crow/Documentos/ChatGPT/Universidad/GameHive
nvm install
nvm use
npm ci
npm run build
npm run preview
```

Abrir la URL impresa por Vite. `npm run dev` está disponible para desarrollo; antes de integrar recursos remotos, completar la vinculación de Vercel y verificar variables según [infraestructura](docs/INFRASTRUCTURE.md). Para esta base, la vista previa del build no requiere servicios externos.

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:security
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

`npm run check` agrupa lint, tipos, tests Vitest y build. Las pruebas de seguridad de G0 solo cubren la frontera del cliente; no certifican RLS, Auth ni Edge Functions. En el entorno restringido del agente fue necesario permiso de red para instalar dependencias y escuchar en localhost.

## Estructura

- `src/app/`: shell, rutas y tema.
- `src/features/catalog/`: contrato implementado de catálogo curado y pantallas.
- `src/domain/`: tipos y reglas de validación; las reglas de servidor siguen pendientes.
- `src/services/`: configuración pública y frontera para futuros servicios Supabase.
- `tests/`: unitarias, integración UI, seguridad cliente y E2E.
- `_bmad/`, `.agents/skills/`: BMAD 6.12.4 instalado para Codex.
- `_bmad-output/`: planificación e historias; `docs/`: decisiones y trazabilidad.
- `.github/workflows/ci.yml`: pipeline preparado, pendiente de ejecución externa.

## Configuración y credenciales

Copiar `.env.example` a `.env.local` solo al disponer del proyecto nuevo. Únicamente URL y clave `sb_publishable_` pueden entrar a Vite. RAWG y claves secretas permanecen del lado servidor. `.env.local` y `.vercel/` están ignorados. No enviar tokens por chat ni incluirlos en incidencias.

La UI G0 permanece sin sesión hasta implementar el flujo G1 completo. Añadir variables por sí solo no habilita Auth. Nunca se reutiliza automáticamente un Supabase/Vercel existente.

## GitHub

El repositorio local es nuevo, en rama `main`, sin relación con `KingOwls/ProjectWebVideoGame`. La creación y subida remota están autorizadas por la petición humana, pero requieren reparar la sesión local:

```bash
gh auth login -h github.com
gh auth status
gh repo create KingOwls/GameHive --public --source=. --remote=origin --push
```

Ejecutar la creación solo después de comprobar que el nombre sigue libre y que no existe un remoto accidental. El 2026-10-31 el conector respondió 404 a `KingOwls/GameHive` y `gh` informó un token inválido. No se ha inventado una URL de entrega ni una ejecución CI.

## Método y límites

La especificación, AGENTS y backlog originales se conservaron. Los archivos `LEEME_PRIMERO.md` y `PROMPT_INICIAL_CODEX.md` son documentación suministrada, no autorización adicional para acciones externas. La implementación no consultó ni copió código o recursos del repositorio de referencia. Ver [BMAD](docs/BMAD.md) y [demo local](docs/DEMO.md).

No hay despliegue autorizado/verificado, integración RAWG, persistencia comunitaria ni cuatro roles demostrados todavía. Las alertas de dependencias de desarrollo y sus límites están documentadas en QA; producción tuvo auditoría sin vulnerabilidades conocidas al momento del chequeo.
