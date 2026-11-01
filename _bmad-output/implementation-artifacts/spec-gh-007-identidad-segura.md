---
title: 'GH-007–013: identidad persistente y autorización'
type: 'feature'
created: '2026-10-31'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: af708a8d98a9eddc7f26d9e3b4c87607d90ceeff
context: ['AGENTS.md', 'GAMEHIVE_MASTER_SPEC.md', 'docs/INFRASTRUCTURE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

G0 permite explorar juegos curados, pero no registra personas ni demuestra permisos. Construir registro → perfil/alias → login → sesión → logout sobre Supabase nuevo. PostgreSQL reserva alias insensibles a mayúsculas y asigna únicamente user al registrarse. Separar perfiles públicos, preferencias privadas y autoridad vigente.

## Boundaries & Constraints

**Siempre:** presupuesto cero; Auth email/contraseña; migraciones reproducibles; RLS/grants explícitos; critic_verified independiente; errores saneados; avatar propio; confirmación email según decisión académica documentada. Creación remota condicionada a organización seleccionada y coste cero.

**Nunca:** reutilizar proyectos anteriores, modificar referencia, exponer secretos en Vite, otorgar autoridad desde user_metadata ni habilitar comunidad antes de verificar servidor.

## I/O & Edge-Case Matrix

| Escenario | Entrada | Resultado | Error |
|---|---|---|---|
| Registro | alias válido | perfil/settings y rol user transaccionales | sin huérfanos |
| Duplicado | Gamer/gamer concurrentes | una reserva exitosa | saneado |
| Login | credenciales válidas | sesión al refrescar | no simular éxito |
| Login inválido | contraseña incorrecta | sin sesión | sin enumeración |
| Escalada | metadatos admin | sigue user | denegación servidor |
| Privacidad | UUID ajeno | sin preferencias | RLS |
| Suspensión | JWT previo | denegar operación sensible | rol/estado vigentes |
| Logout | sesión real | cierre confirmado | reintento visible |

</frozen-after-approval>

## Code Map

- `src/services/config.ts`, `supabase.ts`: frontera SDK preparada, sin conectar; reutilizar validación pública.
- `src/domain/models.ts`: Role/Identity existentes; extender perfil y preferencias.
- `src/app/App.tsx`: incorporar rutas Auth/onboarding al existir backend seguro.
- `tests/security/client-boundary.test.tsx`: no sustituye RLS.
- `docs/BLOCKERS.md`: accesos externos pendientes.

## Tasks & Acceptance

**Ejecución:**
- [x] `docs/plans/G1.md`: matriz CRUD anon/dueño/tercero/critic/moderator/admin antes de SQL.
- [x] `supabase/config.toml`: generar con CLI real; restringir schemas.
- [x] `supabase/migrations/`: crear mediante CLI; perfiles, settings y authz privado; alias normalizado único, constraints e índices; no editar autoridad desde Data API.
- [x] `supabase/tests/`: integridad, concurrencia, RLS y cambios de dueño con datos aislados.
- [x] `supabase/functions/`: operaciones privilegiadas mínimas con JWT, rol/estado vigentes y auditoría transaccional; revisar cualquier definer privado indispensable.
- [x] `src/services/auth.ts`, `src/features/auth/`: servicio tipado, formularios accesibles y sesión real; no guardar contraseñas.
- [x] `src/features/onboarding/`: preferencias persistentes y avatar por defecto.
- [x] `tests/integration/`, `tests/e2e/`: dos sesiones y cuatro roles reales, negativos Data API.
- [x] `docs/PROGRESS.md`, `BACKLOG.md`, `qa-reports/`: evidencia y brechas.

**Criterios:**
- Dada instalación limpia, al migrar, entonces esquema reproducible sin secretos en Git.
- Dados alias equivalentes concurrentes, al registrar, entonces solo uno persiste sin privilegios adicionales.
- Dado tercero/anon, al consultar settings por UUID, entonces no obtiene datos; moderador/admin tampoco por defecto.
- Dado user, al cambiar rol/estado/reputación mediante API/metadatos, entonces servidor rechaza y conserva autoridad.
- Dado login válido, al refrescar/logout, entonces UI refleja sesión real y errores permiten recuperación.

## Implementation Notes

Humano eligió proyecto nuevo. Organización y cuota se resuelven antes de creación remota. Docker 29.4.0 está disponible para preparar integración local al aprobar esta historia. Implementación y migración verificadas localmente; migración aplicada al remoto nuevo. Auth remoto pendiente de configuración y pruebas autenticadas.

## Spec Change Log

## Review Triage Log

| Hallazgo | Veredicto | Ruta | Evidencia |
|---|---|---|---|
| BL-01 | medium | patch | Carga suspendida: settings está protegido por RLS y Promise.all rechaza antes de guardar identity; rama suspendida inalcanzable. |
| BL-02 | high | patch | Cambio de usuario en otra pestaña conserva account y defaultValue del usuario anterior. El recurso/formulario debe quedar ligado al UUID de sesión. |
| BL-03 | medium | patch | theme_mode se persiste pero ningún consumidor aplica el valor al ThemeControl/documento; conectar contrato localStorage ya existente. |
| BL-04 | medium | patch | updateProfile puede confirmar antes de fallar updateSettings; account conserva avatar/perfil anterior a la escritura exitosa. |
| BL-05 | low | patch | request.json/null llegan al catch 503 en lugar de validación 400; corrección directa de parse/forma, sin nueva superficie. |
| BL-06 | medium | patch | CI solo foundation no inicia backend; las suites GH_RUN_LOCAL se omiten. Reutilizar comandos SQL/HTTP/E2E existentes en job backend. |
| BL-07 | medium | patch | typecheck/lint excluyen supabase/functions; añadir comprobación Deno de entrypoints en verificación backend. |
| BL-08 | medium | patch | La restauración de página no prueba renovación de token; falta refreshSession real compatible con auth.sessions. |
| BL-09 | medium | patch | Guardas de autoedición/admin suspendido y serialización administrativa carecen de regresiones explícitas; cubrir invariantes con actores reales. |
| BL-10 | high | patch | Logout solo prueba Edge identity; no el predicado RLS independiente con cuenta activa y token revocado. |
| EC-01 | medium | patch | logout trata 401/403/404 de revocación como fallo permanente; el SDK instalado los interpreta sesión ausente para limpiar, GoTrueClient.ts 4095–4113. |
| EC-02 | medium | patch | Mismo defecto comprobado BL-01: identidad suspendida nunca llega a renderizarse por fallo de settings. |
| EC-03 | high | patch | Mismo defecto comprobado BL-02: estado account/defaultValue no está identificado por usuario de sesión. |
| EC-04 | low | patch | Mismo defecto BL-05: JSON inválido/null produce 503 con entrada autenticada. |
| VG-01 | medium | patch | Brecha de verificación precomprobada: workflow normal nunca ejecuta test:backend ni test:sql, por lo que regresiones de autoridad mantienen CI verde. |
| VG-02 | high | patch | Brecha precomprobada: dueño ya suspendido al logout; añadir cuenta activa con dos sesiones y negativos Data API aislando revocación. |
| VG-03 | medium | patch | Carga suspendida coincide BL-01/EC-02; trace de políticas y .single confirman el fallo. |

## Design Notes

Separar datos evita filtración por columnas. RLS por fila más grants por columna; validar estado vigente evita confiar en JWT obsoleto. No exponer authz.

## Verification

`npm run check`, `npm run test:e2e`, SQL/RLS y advisors mediante comandos descubiertos en CLI. Registrar matriz completa y errores reales. Nunca certificar G1 con mocks.

## Ejecución aprobada

El humano aprobó historia y organización KingOwls's Org en esta conversación. Proyecto remoto nuevo creado por el orquestador: GameHive Next, ref krfodhagjzovsebghekm; coste consultado 0 USD/mes. El agente de implementación trabaja solo en código, Supabase local y tests, sin push ni operaciones remotas. El orquestador aplicará configuración/migraciones remotas tras revisión. Docker debe ejecutarse con permisos fuera del sandbox; no imprimir credenciales de status/servicio. No tocar proyectos Supabase anteriores.

Revisión: tres capas ejecutadas, sin capas omitidas. Hallazgos agrupados por causa después de dictamen individual; correcciones directas reutilizan contratos existentes, sin nuevos privilegios ni endpoints. No hay intent_gap ni cambios al bloque aprobado. La verificación remota permanece pendiente y no se marca done.

## Resolución de revisión y aceptación parcial

Los 17 hallazgos se resolvieron con parches agrupados por causa; evidencia en qa-reports/G1-REVIEW-FIXES.md. Revalidación del orquestador: 40 Vitest, 43 pgTAP, HTTP real, 1 E2E Auth y 5 E2E sin configuración; Deno check ambos handlers, db lint y advisors locales pasan. Ninguna capa de revisión omitida. Las tareas de código están comprobadas; status permanece in-review y G1 in_progress porque falta configuración/prueba autenticada remota, no se marca done por ejecución local. Dos funciones remotas autorizadas y verificadas solo en negativos 401.
