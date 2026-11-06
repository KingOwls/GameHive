---
title: 'GH-024: voto útil o no útil irreversible'
type: feature
created: '2026-11-02'
status: in-progress
route: dispatch
review_loop_iteration: 0
baseline_commit: e001062f05ecc231c31b72238ae2b6e26e1d426c
context: ['AGENTS.md','GAMEHIVE_MASTER_SPEC.md','docs/IDENTITY.md','docs/plans/G3.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

Una persona autenticada valora una reseña ajena como útil o no útil una sola vez y ve el resultado persistido desde otra sesión.

## Boundaries & Constraints

Voto+1/−1 único por votante+reseña; una primera escritura confirmada impide cambiar signo, retirar o repetir. Interfaz advierte irreversibilidad antes de actuar. Solo cuentas activas con sesión vigente; reseña publicada de autor activo, sin auto-voto. Los cuatro roles pueden votar como participantes; esto no concede autoría de reseñas ni privilegios de gestión.

Autoridad, estado y tiempo provienen del servidor; impedir escalada mediante metadata/body y llamadas DataAPI. Antispam20 votos por ventana móvil de60segundos y100/día UTC por votante, verificado atómicamente. Reintento tras ACK incierto consulta el voto propio antes de habilitar otra escritura. Contadores públicos verdaderos separan útiles/no útiles; identidad de votantes privada, incluso frente a moderador/admin mediante DataAPI. Votos históricos confirmados conservan signo al cambiar rol/estado; no conceden reputación ni rol automáticamente.

Mantener reseñas/críticas, spoilers y borradores. Sin comentarios, scores de notas, reputación, reportes ni despliegue remoto en esta historia.

## I/O & Edge-Case Matrix

| Dado | Cuando | Entonces |
|---|---|---|
| Cuenta elegible y reseña ajena | vota | un voto y contadores exactos persistidos |
| Dos sesiones/signos concurrentes | intentan primer voto | un ganador; segunda operación409 |
| Reseña propia/retirada/oculta o autor suspendido | intenta votar | 403 sin voto |
| Voto existente o valor/rol manipulado | intenta UPDATE/DELETE/cambiar signo | denegado sin cambio |
| Cuenta suspendida/sesión revocada/cuota agotada | intenta alta | 403/429 sin escritura |
| Fallo de auditoría o ACK perdido | se procesa voto | rollback o consulta propia determina resultado sin duplicar |
| Tercero | consulta voto privado y contadores | identidad denegada, contadores públicos visibles |

</frozen-after-approval>

## Code Map

`supabase/migrations/20261031235359_identity.sql`, `20261101174238_reviews.sql` y `20261101232944_critical_reviews.sql`: lock718007013, auth.sessions FOR SHARE, private.is_active_owner y private.audit_logs. `src/features/reviews/ReviewsSection.tsx` renderiza tarjetas y actualiza lista; `src/services/reviews.ts` usa deadline cliente y errores HTTP. Reutilizar runtime deadline10s/cancelación/query8s, helpers fixtures locales y ambos catálogos. RLS del padre ya oculta reseñas no elegibles.

## Tasks & Acceptance

- [x] `supabase/migrations/*_review_votes.sql`: Crear migración CLI: review_votes con PK/FKs/valor±1/fecha servidor, índices para cuota y FKs; RLS dueño activo/sesión y revoke de escritura API incluido service_role. Contadores en review protegidos y sincronizados atómicamente también ante limpieza administrativa/cascada; sin nuevo definer.
- [x] `supabase/functions/review-votes/index.ts y _shared/review-votes.ts`: Operación privada invoker+Edge de consulta propia/voto: JWT online, actor/sesión/rol vigentes, serialización con autoridad, elegibilidad y cuota; auditoría mínima misma transacción.401/403/400/409/429/503 saneados; body pequeño y timeout/cancelación.
- [x] `src/services/review-votes.ts, src/domain/models.ts, src/features/reviews/VoteControls.tsx y ReviewsSection.tsx`: Servicio/modelos y controles en tarjeta pública con counts, consulta propia en lote máximo10 IDs por página, estado propio, aviso y loading/empty/error/retry. Visitante puede leer, iniciar sesión para votar; doble click bloqueado. Ante fallo incierto, refrescar voto y contadores sin tocar borrador ni spoilers.
- [x] `supabase/tests/review-votes.test.sql y tests/integration/votes-live.test.ts`: SQL/RLS y HTTP real: todos roles/anon/owner/third, no auto-voto, signo inválido, duplicado/carreras, UPDATE/DELETE, suspensión/revocación, cuota frontera, auditoría fallida y cascada contadores. Sin seleccionar identidades ajenas en cliente.
- [ ] `tests/e2e/votes.spec.ts, scripts/local-votes-tests.mjs y .github/workflows/ci.yml`: E2E real: autor publica, otro vota, segunda sesión conserva signo/contadores y no puede cambiarlo; ambos catálogos, teclado/axe y limpieza. Añadir CI aislado explícito sin RAWG secreto; ejecutar check/SQL/Deno/regresiones y tres revisiones.
- [ ] `qa-reports/G3-VOTES.md, docs/plans/G3.md, BACKLOG.md, docs/REQUIREMENTS.md y docs/PROGRESS.md`: Registrar QA/plan/BACKLOG/REQUIREMENTS/PROGRESS; verified solo tras evidencia local, G3 permanece abierto.

## Design Notes

Añade migración/datos de prueba exclusivamente locales; sin despliegue, costes ni operaciones remotas del implementador. Deno=/tmp/gamehive-deno/deno, cache=/tmp/gamehive-deno-cache. Stack local gamehive y runtime oneshot activos, coordinados por agente principal; no reiniciar/resetear sin coordinar. Demo estable5173 independiente de dist; reservar4173 para suites secuenciales.

## Verification

npm run check; test:sql; Deno frozen y DB/HTTP; E2E real y aislado, regresiones GH020/022/G1/G2. Cada fila de matriz requiere test ejecutado. Proveedor real no acreditado por fixture ni remoto por local.

## Implementation Notes

Aprobación humana explícita2026-11-02: «Aprobar y continuar implementando». Agente implementador sin commits ni operaciones remotas. Pedir aplicación de migración/reinicio al coordinador; no resetear datos.



DTO técnico: GETpropio por1–10IDs devuelve `value` histórico aun para padre inelegible; countsnull para ese objetivo. POSTrechaza campos extra y usa `string_to_array` sobre parámetro UUIDvalidado por compatibilidad del driver fijado. UIreconcilia snapshots y descarta GETanteriores a unPOST sin tocar borrador/spoilers. Evidencia incremental: `qa-reports/G3-VOTES.md`; sin cambiar intención congelada. Check240/SQL371/DenoDB/HTTP y E2Eaislado PASS. Fase manual real pasó; RAWGreal bloqueado503/timeoutproveedor. Limpieza HTTP final PASS por IDs exactos. Pendientes regresiones y tres revisiones de coordinación.

## Spec Change Log

## Review Triage Log
