---
title: 'GH-023: solicitar y resolver admisión como crítico'
type: feature
created: '2026-11-06'
status: draft
route: dispatch
review_loop_iteration: 0
context: ['AGENTS.md','GAMEHIVE_MASTER_SPEC.md','docs/IDENTITY.md','docs/plans/G3.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

Una persona presenta su candidatura privada a crítico, un administrador la admite o rechaza con motivo y la persona consulta el resultado persistido y su aviso interno.

## Boundaries & Constraints

Solo una solicitud pendiente por cuenta activa; historial de resoluciones conservado. Decisiones humanas2026-11-06: aprobar concede rol critic y sello critic_verified=true en la misma operación; tras rechazo, esperar siete días completos desde la resolución antes de otra candidatura. Rol y sello siguen siendo campos separados; solicitar no concede ninguno.

Candidatura contiene procedencia/grupo (admite independiente), experiencia, muestra textual y enlacesHTTPS opcionales. Nunca subir archivos, descargar enlaces ni enviar correos. Evidencias, decisiones y avisos son privados: dueño y admin activo pueden consultar candidatura; moderador no la resuelve ni lee evidencia ajena. No incluir email/secretos en respuestas públicas.

Resolver exige admin y sesión vigentes, cuenta objetivo activa que conserva el rol/estado elegible registrado al solicitar, versión/estado pendiente y actor distinto del solicitante. Conceder rol, resolver, insertar notificación y auditar en una transacción; concurrencia no duplica resolución. Rechazo no cambia autoridad. Solicitar no autoverifica ni incrementa reputación.

Bandeja mínima propia permite leer/marcar leído con sesión vigente incluso estando suspendido (necesario para avisos futuros); nunca leer avisos ajenos. Sin perfil crítico, seguidores, gestión general de roles, sanciones ni despliegue remoto en esta historia.

## I/O & Edge-Case Matrix

| Dado | Cuando | Entonces |
|---|---|---|
| Cuenta elegible activa sin pendiente | envía candidatura válida | pendiente propia persistida; tercero no accede |
| Existe pendiente | repite o compite otra alta | 409 y una sola fila |
| Admin activo y solicitud vigente | admite o rechaza | resolución/autoridad/aviso/auditoría atómicos |
| Actor sin permiso o solicitante | intenta resolver o falsificar metadata | 403 sin resolución |
| Objetivo con rol/estado cambiado o versión obsoleta | admin intenta resolver | 409 sin sobreescribir autoridad |
| Fallo de auditoría o aviso | se resuelve candidatura | rollback completo |
| Solicitud rechazada | reintenta antes de7d o desde7d exactos | antes denegado; desde límite nuevo ID e historia conservada |
| Suspendido con sesión vigente | consulta sus avisos | lectura propia permitida; ajenos/revocada denegados |

</frozen-after-approval>

## Open Questions

1. ¿Solicitan solo usuarios o también críticos sin verificar para pedir el sello? Solo usuarios limita el flujo a admisión; admitir críticos sin sello permite también solicitar verificación. Sin respuesta no implementar.

## Code Map

`supabase/migrations/20261031235359_identity.sql`: reutilizar authz/session/lock718007013 y auditoríaG1, sin encadenar HTTPadmin-identity y resolución como operaciones separadas. `src/features/auth/AuthContext.tsx` conserva sesión incluso si cambia estado; `src/services/auth.ts` ofrece identity para UI, no autoridad. `src/features/admin/AdminGamesPage.tsx` y `src/components/StatePanel.tsx` modelan guards y estados. `src/app/App.tsx` define rutas; no hay candidaturas ni avisos previos. Crear tipos/servicio/features independientes y mantener críticas existentes.

## Tasks & Acceptance

- [ ] `supabase/migrations/*_critic_applications.sql`: Migración CLI de candidaturas/notifications: FKs, fecha/versión/estado servidor, unique parcial pendiente, índices de dueño/cola; RLS default-deny y API sin escritura/lectura de tablas privadas, también service_role. Edge da únicamente vistas autorizadas; sin nuevo definer. Datos de muestra nunca en seed de producción.
- [ ] `supabase/functions/critic-applications/index.ts y _shared/critic-applications.ts`: Operación invoker/Edge con JWT online, sesión existente, rol/estado vigentes y locks coherentesG1; submit, own-history, adminqueue, resolve, own-notices/markRead. Cola/historial paginados20 y orden estable. Campos: procedencia3–120, experiencia40–3000, muestra40–5000, hasta3URLsHTTPS/2048, motivo10–500; texto seguro/codepoints, body64KB, deadline10s y cancelación.
- [ ] `src/services/critic-applications.ts, src/features/critics/CriticApplicationPage.tsx, src/features/admin/CriticApplicationsPage.tsx, src/features/notifications/NotificationsPage.tsx y src/app/App.tsx`: Rutas /critic/apply, /admin/users y /notifications; enlaces descubribles según sesión y permisos actuales. Formulario/historia propia, cola con evidencia privada y resolución motivada, estado verificación separado y bandeja mínima. Loading/empty/error/retry, borrador por autor,409 y ACK incierto consultan estado antes de repetir; sin decisiones optimistas falsas.
- [ ] `supabase/tests/critic-applications.test.sql y tests/integration/applications-live.test.ts`: SQL/RLS/HTTP: anon/dueño/tercero/critic/mod/admin, escalada/IDOR, sesiones revocadas/suspensión, doble solicitud/resolución, objetivo cambiado, rechazo/reintento antes/después/límite exacto7d con reloj servidor, notificación privada, atomicidad con fallos inducidos de audit y aviso. Admin no obtiene preferencias ni bandejas ajenas.
- [ ] `tests/e2e/applications.spec.ts, scripts/local-applications-tests.mjs y .github/workflows/ci.yml`: E2E real candidato→otra sesión→adminresuelve→aviso→rol crítico verificado funcional; rechazo y espera de7d comprobada, teclado/axe, limpieza. CI sin credenciales remotas; check/SQL/Deno y regresionesG1/G2/GH020/GH022, tres revisiones.
- [ ] `qa-reports/G3-APPLICATIONS.md, docs/plans/G3.md, BACKLOG.md, docs/REQUIREMENTS.md y docs/PROGRESS.md`: Actualizar QA/plan/BACKLOG/matriz/PROGRESS con evidencia local; sin cerrar G3 ni anunciar despliegue.

## Verification

Cada fila de matriz cubierta por test realmente ejecutado; npm run check, SQL/RLS, Deno frozen/DB, HTTP/E2E reales y regresiones. Fixtures no acreditan RAWG ni local acredita remoto.

## Implementation Notes

Pendiente resolver elegibilidad y checkpoint humano. Irreversibles: migración y datos solo locales, sin despliegue ni cargos. Huella: nuevas tablas/Edge, tres pantallas, servicio, rutas, pruebas y documentación. Verificar funciones existentes antes de reutilizar autoridad; avisos suspendidos requieren sesión vigente, sin exigir estado activo.

## Spec Change Log

## Review Triage Log
