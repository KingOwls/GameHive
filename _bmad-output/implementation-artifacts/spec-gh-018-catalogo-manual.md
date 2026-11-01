---
title: 'GH-018: registrar juegos reales desde administración'
type: 'feature'
created: '2026-11-01'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 54c04bfc1f6e0cc2f836562d34d61f3fe4cbe13f
context: ['AGENTS.md', 'GAMEHIVE_MASTER_SPEC.md', 'docs/CATALOG.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

Un administrador necesita incorporar un juego real respaldado por una fuente cuando el catálogo del proveedor no cubre el caso. Añadir alta persistente y consulta pública de juegos manuales, claramente identificados, sin alterar fichas RAWG ni presentar una búsqueda vacía como prueba de ausencia global.

## Boundaries & Constraints

**Siempre:** presupuesto cero; fuente HTTPS, nombre de fuente y motivo obligatorios; texto propio/plano y campos acotados; identidad manual:UUID; sesión vigente, admin activo y auditoría transaccional en servidor. Catálogo manual público separado con listado paginado y búsqueda por título; enlace desde Explorar y vuelta al catálogo principal. Ficha pública muestra procedencia, plataformas/géneros, fecha opcional y sinopsis; ausencia de portada/rating explícita. Estados loading/empty/error/success y reintento accesibles.

**Nunca:** modificar datos/caché/cuota RAWG; copiar activos o texto protegido; fetch/scraping de URLs aportadas; aceptar actor/rol del body como autoridad; permitir escrituras Data API; fabricar juegos o scores; mezclar totales de proveedores. No edición/borrado ni imágenes manuales en esta historia. Operaciones remotas nuevas requieren autorización específica posterior; Vercel fuera de este alcance.

## I/O & Edge-Case Matrix

| Escenario | Entrada/estado | Resultado | Error |
|---|---|---|---|
| Alta | admin activo + fuente real + metadatos válidos | un juego y una auditoría, enlace público | datos inválidos400 |
| Acceso indebido | anon/user/critic/moderator, admin suspendido o sesión revocada | sin alta ni auditoría de éxito | 401/403 |
| Doble envío | misma fuente canónica concurrente | una alta y auditoría; conflicto recuperable | 409 |
| Fuente insegura | javascript/http, credenciales, localhost/IP o URL excesiva | rechazada sin consultar URL | 400 |
| Consulta | visitante, título/página o ID manual válido | listado/ficha y fuente; refresco conserva ruta | inexistente explícito |
| Fallo DB/auditoría | transacción incompleta | sin juego parcial | 503 saneado |

</frozen-after-approval>

## Code Map

- `src/services/auth.ts` identity() y `features/auth/AuthContext.tsx`: reutilizar sesión/servicio; identidad vigente se consulta para guardia visual, servidor decide.
- `supabase/functions/_shared/identity.ts`: patrón getUser(token), session_id y errores saneados; no cambiar los handlers G1.
- `supabase/migrations/20261031235359_identity.sql`: authz/sessions y advisory lock718007013 compartido con cambios de autoridad; audit_logs.target_id es FK usuario, usar NULL y gameId en after_data para juegos.
- `src/domain/models.ts`, `components/StatePanel.tsx`, `app/App.tsx`: tipos/estados/rutas reutilizables. RAWG get admite solo rawg:N; crear lectura manual separada.
- `public.games`, `private.catalog_store`, `services/catalog.ts`: preservar contratos RAWG; no ampliar su provider='rawg' ni clave externa numérica.

## Tasks & Acceptance

- [x] `supabase/migrations/` mediante CLI: manual_games pública solo SELECT con RLS; función privada SECURITY INVOKER valida rol/sesión, campos y fuente, inserta con auditoría atómica; revocar EXECUTE/escrituras a roles API. UNIQUE fuente canónica para doble envío.
- [x] `supabase/functions/admin-games/`, `_shared/manual-game*.ts`: alta autenticada, límites/normalización repetidos en DB, timeout/errores saneados. Solo conexión DB servidor invoca función; no nueva SECURITY DEFINER.
- [x] `src/services/manual-games.ts`, `domain/models.ts`: lectura pública paginada/ficha y creación autenticada tipadas; configuración inválida recuperable, cancelación y límites.
- [x] `src/features/admin/AdminGamesPage.tsx`, `features/catalog/ManualCatalogPage.tsx`, `ManualGameDetailPage.tsx`, `app/App.tsx`: rutas /admin/games, /manual-games y /manual-games/:id; formulario protegido y consulta pública; enlaces claros sin modificar proveedor RAWG.
- [x] `tests/`, `supabase/tests/`, `scripts/`: validación, HTML/URLs, cuatro roles, revocación/suspensión, doble envío/concurrencia, rollback auditoría, lectura pública y regresiones G1/RAWG.
- [x] `qa-reports/G2-MANUAL.md`, `docs/PROGRESS.md`, `BACKLOG.md`, `docs/REQUIREMENTS.md`: pruebas ejecutadas/defectos y alcance real; no declarar remoto probado por mocks.

Dado admin activo, cuando registra metadatos propios de un juego real y su fuente oficial, entonces visitante abre la ficha persistente desde otra sesión y al recargar. Dado JWT user/moderator o admin revocado, cuando llama directamente al endpoint o Data API, entonces no crea ni cambia datos. Dados dos envíos simultáneos de igual fuente, cuando concluyen, entonces existe un único juego/auditoría. Dada ficha RAWG persistida, cuando se registra manual, entonces su documento original permanece idéntico.

## Implementation Notes

Historia aprobada por el humano 2026-11-01. Runtime Deno verificado /tmp/gamehive-deno/deno con DENO_DIR=/tmp/gamehive-deno-cache. Docker/CLI/localhost pueden requerir escalación. Capturar supabase start/status en memoria o temporal privado, nunca imprimir credenciales. Stack local gamehive ya activo; root gestiona su ciclo de vida, no detener/reiniciar servicios ajenos. No tocar qa-reports/G2-REMOTE.md: coordinador registra evidencia remota allí.

## Spec Change Log

## Review Triage Log

| Hallazgo | Veredicto | Ruta | Evidencia |
|---|---|---|---|
| BL-01 | medium | patch | Buscar de nuevo la misma q/page pone loading sin cambiar key/dependencias; activar attempt existente evita bloqueo permanente. |
| BL-02 | medium | patch | Key access_token desmonta formulario durante refresh del mismo usuario y pierde borrador; identidad de usuario es la frontera correcta para reinicio. |
| BL-03 | medium | patch | Deadline actual solo Auth/cuerpo, statement_timeout solo ejecución DB; espera en pool y suma de fases pueden superar timeout cliente. Cancelar consulta pendiente con deadline ya existente y probarlo, conservando recuperación por fuente. |
| BL-04 | medium | patch | Un listener/promesa de aborto por chunk queda vivo hasta deadline; con20KB fragmentados acumula miles. Reutilizar promesa/señal y liberar lector/listeners en cierre. |
| BL-05 | medium | patch | Formulario permite cero plataformas y la respuesta genérica no identifica omisión normal; validar mínimo y límites locales usando controles/error existentes. |
| BL-06 | low | patch | Índice lower(title),id no sirve al ORDER BY title,id utilizado; corrección directa al índice de orden. No añadir trigram ni afirmar índice para ILIKE de comodín inicial. |
| BL-07 | medium | patch | Fuente Celeste fija colisiona con alta legítima previa y bloquea verificación local; aislar URL de fixture por query identificada y no borrar datos ajenos. El sitio oficial sigue siendo la procedencia, no juego inventado. |
| BL-08 | medium | patch | Si commit sucede y falla link de éxito, created queda vacío y cleanup borra audit/cuenta pero deja juego. Recuperar IDs por auditoría del actor fixture antes de limpiarla, tanto HTTP como E2E. |
| BL-09 | false | reject | SQL conserva dot segments, pero única entrada Edge normaliza con URL.href antes de invocar función y API no tiene EXECUTE/escrituras. No hay duplicado alcanzable por cliente: caller siempre entrega /game para /a/../game. Reglas explícitas aprobadas de SQL son host/puerto/fragmento. |
| BL-10 | medium | patch | Pruebas de autoridad son secuenciales; falta regresión concurrente del advisory lock y sesión FOR SHARE que impida altas tras democión/suspensión/revocación ganadoras. Añadir DB test aislado, sin RAWG. |
| EC-01 | medium | patch | Duplicado BL-01: URL idéntica no activa consulta tras set loading. |
| EC-02 | medium | patch | Duplicado BL-03: espera en pool o Auth lento puede dejar SQL vigente después de timeout cliente. |
| VG-01 | medium | patch | Brecha precomprobada: buscar cadena vacía en lugar de q no rompería pruebas actuales. E2E debe enviar formulario con no coincidencia y recuperar coincidencia, verificando exclusión. |
| VG-02 | medium | patch | Brecha precomprobada: quitar dl/sinopsis no rompe asserts actuales. UI verifica plataformas/géneros/sinopsis y fecha válida/ausente; E2E observa metadatos tras recarga. |
| QA-01 | medium | patch | Auditoría adicional: negativos SQL reutilizan fuente ya insertada y aceptan cualquier excepción; UNIQUE puede enmascarar eliminación de validación de géneros. Exigir SQLSTATE de cada validación y/o fuente aislada por caso. |

## Design Notes

La URL de fuente canónica elimina fragmento, normaliza host y puerto HTTPS; conserva path/query significativos. La misma fuente no puede reutilizarse para otra alta. Títulos repetidos pueden ser remakes/homónimos y no son unicidad global. La interfaz recuerda comprobar catálogo existente; nunca afirma detectar todas las duplicaciones con RAWG. Plataformas limitadas a PC/PlayStation/Xbox/Nintendo, géneros de texto acotados; fecha calendario válida opcional. Se valida fuente sin peticiones servidor, por seguridad y presupuesto. Guardar actor/motivo solo en auditoría privada, no en documento público.

## Verification

`npm run check`, `npm run test:sql`, Deno check frozen de handlers y tests HTTP/DB locales, E2E admin→alta→visitante→recarga + axe, concurrencia y regresión Auth/RAWG. Caso E2E usa metadatos reales con fuente oficial y limpieza local; las fixtures adversariales aisladas se etiquetan. Revisión BMAD independiente de tres capas antes de cierre. No crear cuentas/datos remotos nuevos sin autorización específica.

Implementación local entregada:132Vitest/2omitidas deliberadas,178SQL,4handlers Deno frozen PASS. Coordinador confirmó1HTTP real+1E2E real (alta/visitante/recarga/axe, concurrencia,roles,revocación,preservaciónRAWG y limpieza). Evidencia: qa-reports/G2-MANUAL.md. Estado in-progress hasta revisión BMAD independiente de tres capas; ninguna publicación manual remota.

Auditoría de matriz por coordinador: alta/consulta en E2E real; acceso indebido y duplicado concurrente en HTTP real; fuentes inseguras en unit/SQL/HTTP; fallo de auditoría en SQL y fallo inyectado HTTP503 sin juego parcial ni detalle interno. Todos esos tests ejecutados y pasados. Revalidación independiente check132/2omitidas,SQL178,Deno4handlers y E2Eaislados5/3omitidos.

Cierre local: tres revisiones completadas y parches revalidados. Check141/2omitidas, SQL178, Deno4handlers+test y3runtimeDB, E2Eaislados5/3omitidos, HTTP/E2Emanual1+1 y regresión G1HTTP/E2E1+1 pasaron. Limpieza0/0/0/0 confirmada. Publicación manual remota es paso posterior con autorización específica.

Regresión RAWG remota final1E2E y db lint local pasaron.
