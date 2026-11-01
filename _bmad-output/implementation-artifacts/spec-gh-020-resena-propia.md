---
title: 'GH-020–021: publicar y editar una reseña propia'
type: 'feature'
created: '2026-11-01'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 220df76851a40e9e267fa84397bbeb6b7fbf87f8
context: ['AGENTS.md', 'GAMEHIVE_MASTER_SPEC.md', 'docs/IDENTITY.md', 'docs/CATALOG.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

Permitir a un usuario publicar, consultar desde otra sesión, editar y retirar su única reseña de un juego real. Integrar formulario y lectura pública en fichas RAWG/manuales, con spoilers ocultos dentro del mismo registro y persistencia protegida por servidor.

## Boundaries & Constraints

**Siempre:** una identidad de reseña por autor+juego, incluso retirada; actor derivado del JWT, cuenta activa y sesión vigente; fecha/versión del servidor, edición atómica y conflicto409 ante versión obsoleta. Cambiar nota exige cambiar también opinión pública normalizada, no solo espacios, título o spoilers. Rating finito0–10, título3–120, opinión20–10000 y spoilers hasta20000 caracteres; texto plano escapado. Pros/contras opcionales acotados. Auditoría privada atómica sin correo/tokens ni copia innecesaria de contenido.

Esta historia habilita escritura para role=user. El mapa maestro reserva autoría a Usuario/Crítico: formato crítico completo llegará en GH-022, sin herencia de moderador/admin. Todos pueden leer contenido público. La regla10h pertenece a comentarios, no a esta primera reseña.

**Nunca:** autor/juego transferibles, escritura Data API, duplicado tras retirar, autor restaurando contenido oculto por moderación, visibilidad pública de autores suspendidos ni autoridad desde metadata. No reseñas persistentes para slugs offline sin vínculo real. Críticas completas, solicitudes, votos, comentarios, reputación y agregados son siguientes historias; no simular scores. Al existir reseñas mostrar su cuenta real y cálculo pendiente, sin afirmar «Sin evaluaciones» para ellas. Operaciones remotas/Vercel requieren permiso posterior.

## I/O & Edge-Case Matrix

| Escenario | Entrada/estado | Resultado | Error |
|---|---|---|---|
| Publicar | user activo + juego persistido + texto válido | una fila y auditoría; lectura visitante | inválido400 |
| Doble alta | mismo autor+juego concurrente o retirado | una identidad; recuperar reseña existente | 409 |
| Editar | dueño + versión actual + nota/opinión coordinadas | misma fila, nueva versión | obsoleta409; nota sin texto400 |
| Retirar/republicar | dueño activo | misma fila; retirada solo dueño | sin bypass de ocultación moderada |
| Acceso indebido | tercero/rol no autor/suspendido/revocado | sin mutación ni auditoría de éxito | 401/403 |
| Leer | publicada/retirada/suspendida; spoilers | solo publicada elegible o propia autorizada; spoilers cerrados | inexistente explícito |
| Fallo/ACK perdido | DB/auditoría/timeout | rollback si fallo transaccional; comprobar propia antes de reintentar | saneado503 |

</frozen-after-approval>

## Code Map

Reutilizar `src/domain/{models,rules}.ts` (ReviewInput/validateReview), `components/SpoilerReveal.tsx` cerrado por ID y `features/auth/AuthContext.tsx`/`services/auth.ts` para sesión. Migraciones identity/manual: authz, sesión FOR SHARE, lock718007013 y audit_logs (reviewId en JSON; target_id es usuario). `games.id` texto/manual_games.id UUID: FKs separadas+XOR. `_shared/manual-game-deadline.ts`: techo opcional conservando20KB manual. Integrar `features/catalog/{GameDetailPage,ManualGameDetailPage}.tsx` y `app/App.tsx`.

## Tasks & Acceptance

- [x] Migración CLI reviews: FKs/XOR, UNIQUE autor+juego, versión/estado, RLS; autor activo sincronizado con trigger invoker protegido de authz.
- [x] Edge reviews y función privada invoker: Auth/sesión/rol actuales, validación/versión, cuatro acciones, auditoría atómica, cancelación/errores saneados.
- [x] Servicio/modelos tipados y UI paginada en ambas fichas; alias/avatar públicos, sin correo. Borrador persiste tras refresh/409 hasta recarga explícita.
- [x] SQL/HTTP/E2E: matriz, concurrencia, dos sesiones, FK inexistente, retiro/republicación, suspensión/revocación, XSS/espacios y auditoría fallida. Limpieza protegida.
- [x] Actualizar qa-reports/G3-REVIEWS.md, plan, PROGRESS, BACKLOG y requisitos; G3 sigue abierto.

## Implementation Notes

Aprobación humana recibida2026-11-01. Trabajo en /home/jhonatan-crow/Documentos/ChatGPT/Universidad/GameHive, rama feat/g3-reviews. Implementación y pruebas locales; no operaciones remotas ni commits del implementador. Docker local gamehive ya activo; runtime Edge existente: coordinar cualquier reinicio con el coordinador. Deno=/tmp/gamehive-deno/deno, DENO_DIR=/tmp/gamehive-deno-cache. No imprimir salida cruda de supabase status ni secretos. Cambio previo b0c4f28 registra verificación remotaG2 y corrección mecánica de etiqueta del logo; baseline220df se conserva.

Contrato implementado y operación local: `docs/plans/G3.md`. Endpoint `GET /functions/v1/reviews?gameId=...` devuelve propia o null; POST recibe `{action,gameId,version?,input?}` con create/update/withdraw/republish. Cuerpo160KB, límites por caracteres del Intent; pros/contras hasta5 de200 caracteres. Lectura pública Data API paginada10 y cuenta exacta; borrador sessionStorage por usuario+juego con versión original. Evidencia inicial en `qa-reports/G3-REVIEWS.md`; SQL/HTTP/E2E reales y DenoDB pasaron; revisión BMAD y revalidación global finales corresponden al coordinador. CI usa fixture catalogal explícita y no certifica RAWG real.

## Spec Change Log

## Review Triage Log

| ID | Dictamen | Evidencia individual | Ruta |
|---|---|---|---|
| BL01 | medium | submit sustituye draft y borra sessionStorage también en withdraw/republish, que no guardan texto enviado. Pierde edición no guardada. | patch |
| BL02 | medium | Inputs siguen habilitados con busy; respuesta de mutate reemplaza draft posterior. | patch |
| BL03 | medium | response.json de mutate queda fuera del catch de fetch; cuerpo interrumpido escapa sin ReviewError y sin incertidumbre. | patch |
| BL04 | medium | UI solo reconoce503;502/504 devuelven error recuperable pero permiten repetir sin comprobar resultado. | patch |
| BL05 | false | Comprobar conserva deliberadamente versión/texto del borrador y muestra versión real; existe carga explícita para reconciliar.409 evita sobrescritura. El contrato aprobado conserva borrador hasta recarga explícita, no exige rebase automático. | rechazado |
| BL06 | medium | reload actualiza own, pero no invalida lista; tras ACK perdido puede mostrarse publicada una retirada confirmada. | patch |
| BL07 | medium | maxLength nativo mide unidades UTF16 y valida menos emoji que límites por puntos de código del dominio/servidor. | patch |
| BL08 | medium | Servicio y botón limitan página100 con total exacto potencialmente mayor1000, dejando filas inaccesibles. | patch |
| BL09 | low | Own mantiene lock global durante una transacción SQL corta, sin Auth/red dentro del lock; serialización real preserva autoridad coherente. Impacto de saturación no demostrado en uso diario de demo; cambiar protocolo/locks añade complejidad. Regla BMAD rechaza low improbable con solución no directa. | rechazado |
| BL10 | medium | reload solo consulta own, conserva identity obsoleta tras cambio de rol y deja formulario que servidor rechaza. | patch |
| EC01 | medium | Campos editables mientras mutate pendiente permiten sobrescribir borrador nuevo al responder. | patch, misma causa BL02 |
| EC02 | medium | Parseo del cuerpo exitoso no normaliza fallo de lectura y omite recuperación de resultado incierto. | patch, misma causa BL03 |
| EC03 | medium | Acciones de visibilidad sin input sustituyen borrador y almacenamiento silenciosamente. | patch, misma causa BL01 |
| VG01 | medium | Hallazgo pre-verificado: test de cuerpo Unicode invoca helper con límite propio; ningún HTTP exitoso supera20KB. Eliminar override del handler dejaría pruebas verdes. | patch, prueba HTTP larga |
| VG02 | medium | Revisor comprobó Chromium:15000emoji con maxlength20000 produce10000puntos; UI impide valores válidos. | patch, misma causa BL07 |
| QA01 | false | Trazado completo: reload pone identity=null y desmonta el formulario antes de cargar; el nodo nuevo no conserva customError. No se reproduce bloqueo tras carga explícita. | rechazado |
| QA02 | low | Al restaurar borrador inválido tras remount, onChange no se ejecuta y el control no refleja su límite por puntos de código. El dominio sí impide guardarlo, por lo que no hay fallo de integridad. Sincronizar validez al render es corrección directa y la nueva prueba de restauración lo verifica. | patch |


## Verification

Check, SQL/RLS, Deno frozen y carrerasDB. HTTP/E2E real RAWG/manual: publicar→otra sesión→editar nota+texto→recargar→retirar/republicar; spoilers cerrados, axe/teclado, regresionesG1/G2 y tres revisiones BMAD. Separar fixtures, proveedor real y remoto; no certificar despliegue sin permiso.

Coordinación antes de revisión: check171PASS/3omitidas; SQL249PASS; Deno frozen5handlersPASS; reviewsDB2 y manualDB3PASS; aisladoE2E5PASS/4omitidos; reseñas HTTP/E2E real1+1 y víaCIaislada1+1PASS; regresionesG1 y manualG2 HTTP/E2E1+1 cada unaPASS; RAWGrealE2E1PASS; db lint sin errores. Matriz: publicar/duplicado/editar/retiro/privilegios/lectura/fallo cubiertos por reviews.test.sql y reviews-live; spoilers/borrador/409 por reviews-ui y reviews E2E; carreras por reviews-runtime. Bloque aprobado idéntico.

Cierre local tras tres revisiones: dictámenes individuales registrados; todos los parches aceptados corregidos y revalidados. Check185PASS/3omitidas; SQL249; Deno5handlers; reviewsDB2/manualDB3; E2Eaislado5/4omitidos; HTTP/E2Ereseñasreal1+1 y CIaislado1+1; regresionesAuth/manual1+1cadauno y RAWGreal1 pasaron. Limpieza0usuarios/reseñas/manuales/fixturesRAWG/triggers. Se conserva protocolo de lock en lectura propia; no se certifica carga alta. Sin publicación remotaG3.
