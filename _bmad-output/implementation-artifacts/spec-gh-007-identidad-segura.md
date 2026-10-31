---
title: 'GH-007–013: identidad persistente y autorización'
type: 'feature'
created: '2026-10-31'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
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
- [ ] `docs/plans/G1.md`: matriz CRUD anon/dueño/tercero/critic/moderator/admin antes de SQL.
- [ ] `supabase/config.toml`: generar con CLI real; restringir schemas.
- [ ] `supabase/migrations/`: crear mediante CLI; perfiles, settings y authz privado; alias normalizado único, constraints e índices; no editar autoridad desde Data API.
- [ ] `supabase/tests/`: integridad, concurrencia, RLS y cambios de dueño con datos aislados.
- [ ] `supabase/functions/`: operaciones privilegiadas mínimas con JWT, rol/estado vigentes y auditoría transaccional; revisar cualquier definer privado indispensable.
- [ ] `src/services/auth.ts`, `src/features/auth/`: servicio tipado, formularios accesibles y sesión real; no guardar contraseñas.
- [ ] `src/features/onboarding/`: preferencias persistentes y avatar por defecto.
- [ ] `tests/integration/`, `tests/e2e/`: dos sesiones y cuatro roles reales, negativos Data API.
- [ ] `docs/PROGRESS.md`, `BACKLOG.md`, `qa-reports/`: evidencia y brechas.

**Criterios:**
- Dada instalación limpia, al migrar, entonces esquema reproducible sin secretos en Git.
- Dados alias equivalentes concurrentes, al registrar, entonces solo uno persiste sin privilegios adicionales.
- Dado tercero/anon, al consultar settings por UUID, entonces no obtiene datos; moderador/admin tampoco por defecto.
- Dado user, al cambiar rol/estado/reputación mediante API/metadatos, entonces servidor rechaza y conserva autoridad.
- Dado login válido, al refrescar/logout, entonces UI refleja sesión real y errores permiten recuperación.

## Implementation Notes

Humano eligió proyecto nuevo. Organización y cuota se resuelven antes de creación remota. Docker 29.4.0 está disponible para preparar integración local al aprobar esta historia. Aún no hay migración ni Auth implementados.

## Spec Change Log

## Review Triage Log

## Design Notes

Separar datos evita filtración por columnas. RLS por fila más grants por columna; validar estado vigente evita confiar en JWT obsoleto. No exponer authz.

## Verification

`npm run check`, `npm run test:e2e`, SQL/RLS y advisors mediante comandos descubiertos en CLI. Registrar matriz completa y errores reales. Nunca certificar G1 con mocks.
