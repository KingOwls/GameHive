# GH-024 — votos irreversibles

Historia aprobada el 2026-11-02; verificación retomada el 2026-11-06. Alcance exclusivamente local, sin commits, costes, reset ni publicación remota. G3 permanece `in_progress`; esta historia no implementa comentarios, reputación, solicitudes de crítico ni puntuaciones agregadas.

## Implementación y contrato

Migración CLI `20261102121142_review_votes.sql`: PK reseña+votante, FKs con cascada, signo ±1, fecha de servidor, índice votante+fecha y RLS de lectura propia con sesión activa. Escritura Data API revocada para anon/authenticated/service_role. Trigger invoker impide UPDATE histórico y sincroniza contadores útiles/no útiles ante INSERT y limpieza/cascada DELETE. Ningún nuevo SECURITY DEFINER.

La operación privada invoker comparte lock de autoridad718007013, bloquea sesión `FOR SHARE`, valida estado actual, elegibilidad y cuotas en la misma transacción que el voto, los contadores y la auditoría mínima. Los cuatro roles participan sin heredar autoría.20 votos por ventana móvil de60s y100 por día UTC. La ventana excluye timestamps iguales a `ahora−60s`; el día incluye medianoche UTC.

- GET `/functions/v1/review-votes?reviewIds=UUID,UUID`:1–10 IDs distintos; responde `{votes:[{reviewId,value,helpfulCount,unhelpfulCount}]}` en orden solicitado. Solo devuelve el voto propio, incluso cuando el objetivo pasa a inelegible; entonces ambos contadores son `null`. Un ID inexistente no revela contenido ni identidad: valor/counts `null`.
- POST `/functions/v1/review-votes`: exactamente `{reviewId,value:1|-1}`;201 con DTO del voto y contadores confirmados.401 JWT,403 sesión/estado/elegibilidad,400 entrada,409 voto existente,429 cuota y503 resultado incierto, con mensajes saneados. Sin identidades ajenas en el cliente.
- Runtime reutiliza deadline10s, cuerpo1024bytes, consulta SQL8s y cancelación del helper existente. JWT se verifica online; ninguna metadata o campo body aporta autoridad.

Controles en ambas fichas: contadores públicos, acceso desde visitante, aviso antes de votar, consulta propia por página, bloqueo inmediato de doble clic y estado irreversible. Una respuesta perdida provoca GET propio; sin GET confirmado no se vuelve a escribir. La recuperación conserva borrador y spoilers. Las respuestas de consultas antiguas no sustituyen un voto pendiente/confirmado; una lista nueva de mismos IDs reconsulta contadores.

## Evidencia ejecutada

- `npm run test:sql`:371PASS, seis archivos (incluye55 nuevos casos de votos) el2026-11-02.
- `npm run check`:240PASS/5omitidas, lint/typecheck/build PASS con workers acotados el2026-11-06. Incluye13 pruebas nuevas de servicio/UI; UI4PASS dirigidas tras cubrir refresco de contadores y respuesta GET obsoleta.
- Deno `check --frozen` nuevo handler y runtime test:PASS.
- `GH_DENO_BIN=/tmp/gamehive-deno/deno DENO_DIR=/tmp/gamehive-deno-cache npm run test:votes:db`:PASS, cuerpo/deadline y carreras reales dos sesiones, suspensión de votante/autor y revocación concurrentes sin estado parcial.
- `npm run test:votes -- --e2e`:fase HTTP real1PASS, incluye roles/anon/propietario/tercero, valores/manipulación, carrera, privacidad, UPDATE/DELETE, suspensión/revocación, recuperación propia de objetivo inelegible, auditoría fallida,20/minuto con carrera del último slot,100/día y cascada. La fase manual del navegador real pasó (ACK perdido, segunda sesión, recarga, contadores visitantes, borrador/spoiler y axe); la fase RAWG quedó bloqueada por503 del catálogo local, sin formulario disponible. El coordinador comprobó timeouts de conectividad al proveedor directo. No se certifica E2E real completo.

- `GH_REVIEWS_ISOLATED=1 npm run test:votes -- --e2e`:1HTTP+1E2E PASS (27.87s/17.8s), ambas fichas con contrato de catálogo explícito y Auth/Edge/DB reales. Incluye teclado/axe y limpieza. No certifica proveedor RAWG actual.

## Incidencias corregidas

1. El driver postgresjs fijado serializó `sql.array(ids)::uuid[]` como escalar y produjo22P02/400. Se sustituyó por `string_to_array` sobre parámetro validado UUID (nunca SQL interpolado). HTTP real posterior pasó.
2. El test de cascada borraba admin de fixture antes de limpiar el juego manual; su auditoría quedaba sin actor y el helper no encontraba el juego. Ahora elimina moderator y conserva admin hasta limpieza. El coordinador eliminó el único juego huérfano previo con guard ID+marcador y sin reseñas.
3. Un refresco de lista con mismos IDs podía conservar contadores viejos de estado local. Snapshot de versión/counts inicia GET y generaciones por reseña descartan respuestas anteriores a la escritura, preservando busy/lock. Prueba de rerender y respuestas desordenadas PASS.
4. `npm run check` dentro del sandbox falló en cuatro tests existentes que crean subprocesos Node (`EPERM`). Una repetición sin limitar workers produjo timeouts de arranque; el coordinador midió13/15GiB RAM usados y swap4GiB agotada. Se fijó `maxWorkers:2` y se ejecutan suites secuenciales: `npm run check` posterior PASS (240pruebas/5omitidas, lint/typecheck/build). No se cambiaron expectativas para ocultar fallos.
5. El primer E2E agotó120s y su cierre de contexto ocultaba el punto del error e impedía limpieza. Ahora las acciones tienen límite15s, setup y teardown quedan protegidos por finally, limpieza DB precede cierres con allSettled. El coordinador limpió exactamente3cuentas,1reseña,1juego y3auditorías del marker `r4a10be3100`. Una repetición HTTP coincidente con presión global agotó fetch15s; la repetición secuencial posterior pasó1HTTP en27s.

6. La eliminación de moderatorfixture anonimizaba sus auditorías antes de que el helper pudiera borrarlas poractor. El test ahora borra únicamente las auditorías de ese actor antes de borrar la cuenta. Repetición HTTP final PASS (27.50s): captura los IDs exactos de auditoría de todos los actoresfixture antes del DELETE y verifica que no existen tras cleanup. También valida loteGET propio de10IDs, cuentas/reseñas/juego manual e instancia aislada de catálogo. No se borran auditorías anónimas genéricas de corridas antiguas sin procedencia demostrable.

## Pendientes de cierre

E2E RAWG real completo bloqueado por conectividad actual del proveedor (503local/timeoutdirecto), sin cambiar TTL ni sustituirlo por fixtures. HTTP final del parche de limpieza PASS. SQL global371PASS y regresión AuthHTTP/E2EPASS confirmados por el coordinador. Resto de regresiones GH020/GH022/G2 y tres revisiones BMAD/revalidación a cargo del coordinador; el bloqueo RAWG impide todavía cerrar toda la aceptación. No marcar GH024 verified hasta cerrar esa evidencia. La ruta CI aislada utiliza fixture de catálogo explícita y Auth/Edge/DB locales reales; no requiere secreto RAWG ni acredita proveedor o remoto.

## Handoff final de implementación

Diff estable el2026-11-06, sin pruebas activas ni reserva de4173/dist por el implementador. Fuente SQL igual a la migración ya aplicada; ningún reset, commit ni operación remota. CI añade frozen del sexto handler, DenoDB de votos y suite aislada explícita. El script admite `--browser-only` para diagnosticar sin repetir HTTP. `npm run check`240PASS/5omitidas y lint/typecheck final PASS; DenoDB2PASS, SQL371PASS, HTTP final1PASS y E2E aislado1PASS. No se declara verified por el bloqueo E2E RAWG real y las revisiones/regresiones pendientes.

## Revalidación del coordinador — 2026-11-06

- Check completo:240PASS/5omitidas, lint/typecheck/build PASS. Las suites HTTP optativas omitidas tienen ejecuciones independientes; no cuentan como PASS del check.
- SQL/RLS global:371PASS; db lint sin errores. Las tres funciones de la migración de votos coinciden exactamente con sus cuerpos en PostgreSQL local.
- Seis entrypoints Deno: `check --frozen` PASS. Runtime/DB de votos repetido por el coordinador:PASS.
- Regresiones Auth1HTTP+1E2E, catálogo manual1HTTP+1E2E, reseñas/críticas2HTTP+2E2E:PASS. Reseñas/críticas usan catálogo controlado explícito, no acreditan RAWG actual.
- La clave RAWG privada no aparece en los archivos fuente versionados/nuevos ni en `dist`. El entorno Python local ajeno a esta implementación se conserva y se ignora en Git.
- E2E sin configuración:5PASS/6omitidas; las seis suites que requieren backend/configuración se ejecutan por sus scripts independientes. Limpieza final:0cuentas de fixtures,0juegos manuales de fixtures y0instancias aisladas de catálogo. No se borraron auditorías anónimas antiguas sin procedencia demostrable.
- Consulta de diagnóstico al catálogo público ya desplegado de GameHive Next:503 también. Solo lectura pública; sin desplegar, aplicar migraciones ni cambiar configuración remota. Este resultado no identifica por sí solo la causa del fallo.

RAWG real continúa bloqueado según B-06 de `docs/BLOCKERS.md`. Por el paso3 de BMAD, la aceptación incompleta impide pasar todavía a las tres revisiones del paso4; no se marca esta historia `verified` ni `done`.
