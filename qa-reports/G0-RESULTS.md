# Resultados G0 — alcance local

Fecha de ejecución: 2026-10-31 (America/Bogota). Gate global: in_progress; remoto y CI pendientes. No equivale a una certificación de G1–G6.

| Comando/check ejecutado | Resultado observado |
|---|---|
| `git init -b main` | Git nuevo en GameHive; ningún remoto original |
| `npm run lint` | pasó |
| `npm run typecheck` | pasó |
| `npm run test` | 32 tests en 4 archivos pasaron tras regresiones |
| `npm run build` | pasó, Vite 8.3.5; JS principal ~271.84 kB / gzip ~86.65 kB |
| `npm run test:e2e` | 4 tests Chromium pasaron, incluyendo 6 barridos axe (3 rutas × 2 temas) |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `npm audit --json` | 15 moderadas en herramientas dev; abiertas, QA-003 |
| `bmad-method status` | core/bmm 6.12.4 instalados |
| Renderizador BMAD con uv | ejecutado; workflow/plan leídos |
| Resolver BMAD tras custom config | Spanish y KingOwls verificados |
| `gh auth status` | falló, token inválido; sin push |
| GitHub conector, GET KingOwls/GameHive | 404; no se creó repositorio |
| `docker info` | permiso denegado; sin SQL/RLS/Auth local |

Las pruebas de seguridad locales comprueban escape XSS/ocultación spoiler, errores saneados y rechazo de claves privadas en configuración pública. No se ejecutaron matrices RLS ni E2E multiusuario. El catálogo de prueba usa juegos curados reales y datos aislados de pruebas; no se simula comunidad.

Incidencias reproducibles y correcciones: GH-QA-2026-001..004. La primera ejecución E2E falló por contraste; después de quitar transición de fondo pasaron los 4 casos. El sandbox bloqueó inicialmente el servidor local con EPERM; la ejecución autorizada permitió revalidar.
