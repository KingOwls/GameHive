# GH-022 — análisis crítico completo local

Fecha: 2026-11-01. Estado: implementación en verificación; revisión BMAD de tres capas y revalidación global a cargo del coordinador. No marca G3 completo ni autoriza publicación remota.

## Cambios

- Migración CLI `20261101232944_critical_reviews.sql`: tipo histórico `user`/`critic`, ocho criterios con explicación en detalles vinculados a la reseña, respuestas con FK a banco público versionado e inmutable y RLS heredada de publicación/elegibilidad del padre. Escrituras Data API revocadas también para service_role; funciones invoker privadas, sin definer nuevo.
- La operación de autor vigente verifica sesión, rol y versión bajo el lock G1; publica, convierte y edita con auditoría atómica. La media simple de ocho notas se calcula con numeric y redondeo a dos decimales en DB. La copia del cliente de la nota final carece de autoridad. Cambiar media exige una opinión pública normalizada distinta.
- `user` y `critic` activos pueden mantener reseñas ordinarias; solo critic crea/convierte/modifica detalles críticos. Perder rol mantiene tipo y nota; un autor user conserva edición básica, retiro y republicación. Admin/moderator no heredan autoría. Verificación real sincronizada desde private.authz, independiente del rol.
- Banco inicial rotulado contenido editorial propio con preguntas generales y por género; selección máxima12 basada en géneros del catálogo persistido y plataforma validada contra ese juego. Las reseñas guardadas mantienen IDs/versiones/textos anteriores al cambiar banco. Operadores publican nuevas versiones por migración; solo `enabled` es mutable.
- Editor y lectura pública en ambas fichas, transparencia, media, criterios, contexto y spoilers cerrados. Conversión explícita mantiene ID/estado. Borrador crítico por autor+juego conserva la versión y el baseline ante409, refresh y ACK incierto. Texto Unicode cuenta puntos de código. La media orientativa suma centésimas enteras para coincidir con numeric en redondeos límite.
- Límite del endpoint262144bytes con deadline/cancelación existente; el helper manual mantiene20000bytes por defecto.

## Evidencia ejecutada por implementación

- `npm run lint` y `npm run typecheck`: PASS tras cambios.
- `npx vitest run tests/unit/critical.test.ts tests/unit/reviews.test.ts tests/integration/reviews-ui.test.tsx`:60PASS inicial; se añadieron luego casos de Unicode/redondeo.
- `npx vitest run tests/unit/critical.test.ts tests/integration/critical-ui.test.tsx`:19PASS incluyendo media2.005→2.01 y borrador Unicode restaurado.
- `npm run test:sql`:300PASS inicial (G1/G2/GH020 y GH022); se añadió luego un caso numeric de redondeo que requiere revalidación final.
- `npm run test:reviews`:2PASS HTTP real local GH020 y GH022: cuenta crítica no verificada, RAWG previamente persistido y Celeste manual con fuente oficial, cuatro roles, criterios/plataformas inválidos, score manipulado, versiones/carreras, roles, banco, conversión sin duplicados, suspensión/revocación, moderación, lectura privada y auditoría fallida. Cuentas/datos temporales eliminados.
- `npm run test:unit` dentro del sandbox:138PASS/4FAIL; los cuatro fallos pertenecen a `verify-rawg.test.ts` por `spawnSync EPERM` del sandbox, sin defecto funcional observado. Repetir escalado en revalidación global.

Los primeros intentos HTTP encontraron fallos del propio test: `psql RETURNING` incluía la etiqueta INSERT y PATCH sin filtro era rechazado400 antes de verificar privilegios. Se corrigieron parser/filtros, se eliminó por UUID la única pregunta temporal residual del primer intento y se repitió con éxito. No se imprimieron claves ni tokens.

## Pendiente y límites

E2E real/aislado, Deno frozen/DB y SQL actualizado ya pasaron, según revalidación focalizada posterior. Pendientes: tres revisiones BMAD y check/regresiones globales del coordinador. La fila RAWG previamente persistida no acredita una nueva llamada al proveedor; el modo `GH_REVIEWS_ISOLATED=1` usa una fixture explícita de contrato y no acredita RAWG. Las reseñas/Auth/Edge/DB sí se ejercitan realmente en local. Sin solicitudes de críticos, votos, comentarios, seguidores, agregados ni Vercel.

## Revalidación focalizada de implementación

- `npm run test:sql`:301PASS tras añadir redondeo2.005→2.01 y limitar todos los conteos de detalles/respuestas a IDs de fixture. Se añadieron después dos casos de selección máxima12 y fallback general que deben figurar en el siguiente total.
- `npx vitest run tests/unit/critical.test.ts tests/unit/reviews.test.ts tests/integration/critical-ui.test.tsx tests/integration/reviews-ui.test.tsx tests/integration/rawg-ui.test.tsx`:69PASS. Incluye cuerpo Unicode superior160KB/inferior256KB, rechazo de overflow y preservación del default manual20KB.
- `DENO_DIR=/tmp/gamehive-deno-cache /tmp/gamehive-deno/deno check --frozen supabase/functions/reviews/index.ts`:PASS.
- `npm run test:reviews -- --e2e`:2HTTP+2E2E PASS en la versión final del código funcional. HTTP crítico ejercita texto Unicode superior160KB con readback exacto, además del resto de negativos. E2E crítico6.8s y GH0205.3s; RAWG persistido/manual, dos sesiones, nota5.5→6.5, conflicto y borrador/restauración, conversión de ordinaria, pérdida de rol y edición básica, retiro/republicación, teclado/spoilers y axe.
- Panel Críticos de RAWG corregido: comunica análisis publicados/cálculo pendiente en vez de ausencia incondicional. Assertions de catálogo/foundation actualizadas; el E2E crítico verifica el mensaje después de publicar sin inventar agregados ni muestras.

Diagnóstico E2E: se verificó independientemente que el selector Playwright `getByLabel` exacto incorpora el contenido inicial de un textarea dentro de su label; el nombre accesible correcto sí coincide con `getByRole('textbox', {name,exact:true})`. Se corrigió exclusivamente ese selector, conservando la aserción del borrador. El primer timeout fue enmascarado por cierre de contexto; la limpieza final ahora tolera cierre de navegador y siempre limpia fixtures. Las dos cuentas de esa ejecución agotada y su registro manual se limpiaron por alias/prefijo exacto, comprobando cero cuentas residuales.

Al revalidar SQL durante una ejecución E2E se detectaron cinco expectativas basadas en conteos globales del test nuevo; el dato adicional era la crítica temporal del navegador. Se aislaron los conteos por prefijo de las cuentas SQL y se revalidó301PASS. El runner local ejecuta ahora Playwright con un worker para mantener ambas suites secuenciales.


## Estado al entregar a revisión

`npm run test:sql`:303PASS final, incluyendo selección máxima12 y fallback general. `GH_REVIEWS_ISOLATED=1 npm run test:reviews -- --e2e`:2HTTP+2E2EPASS, fixture de catálogo aislada explícita y backend local real, limpieza verificada por helper. La ejecución real y la aislada fueron secuenciales en4173. BuildPASS con aviso existente del bundle537KB (>500KB); sin dependencia nueva. `git diff --check`:PASS.

Las revisiones BMAD y la revalidación global del coordinador siguen pendientes; conservar `in_progress` para GH022 hasta registrarlas. No hay implementación funcional pendiente conocida de la especificación dentro del alcance local. Sin commits ni publicación remota del implementador.

`GH_DENO_BIN=/tmp/gamehive-deno/deno DENO_DIR=/tmp/gamehive-deno-cache npm run test:reviews:db`:PASS final, cuerpo Unicode y carreras reales de autoridad/suspensión/revocación; cero llamadas RAWG.

## Iteración 1 — recuperación y correcciones de revisión (2026-11-02)

Se usó la especificación ampliada como fuente de verdad; la referencia positiva de iteración0 se revisó y se corrigieron los hallazgos antes de validar. No se modificó el bloque de intención congelado.

- BL01: nuevo `reviewDraft.ts` valida la estructura sin exigir completitud editorial. Restaura números vacíos/NaN serializados como null y rechaza almacenamiento corrupto sin crash. Conserva las instantáneas completas de preguntas junto al borrador.
- BL02/03/07, EC02: estado independiente loading/error para preguntas y reintento; cargar/comprobar no descarta el borrador. Alta/conversión permiten reconciliar el banco actual por question_key conservando criterios, contexto, texto y respuestas existentes; las preguntas nuevas quedan vacías con aviso. Edición persistida conserva el conjunto histórico.
- BL04: DB permite plataforma histórica sin cambio aunque cambie el catálogo; sigue rechazando una plataforma nueva ajena al catálogo actual. El coordinador sincronizó únicamente CREATE OR REPLACE de `private.review_operation` y sus permisos; no reaplicó migración ni reseteó datos.
- BL05/06/08, EC01: cancelación de preparación crítica conserva campos ordinarios y nota previa (incluida vacía); está disponible también si el autor pierde rol antes de persistir. La crítica guardada no permite degradar tipo. Nota mostrada y enviada coincide con la media orientativa; el servidor calcula la definitiva. Catálogo sin plataformas muestra bloqueo explícito.
- BL09/10: precisión Edge ajustada a la representación decimal serializada, sin tolerancia que aceptase 1.00000000001; conserva 9.99 válido. Guía local explica que criterios/contexto/justificación/respuestas son públicos sin spoilers y dirige revelaciones a la sección protegida.
- VG01: E2E público verifica las ocho notas/explicaciones, justificación, respuestas, prompt/versiones y copia facilitada true/false después de alta y edición con recargas. El mismo recorrido prueba banco cambiado durante preparación, fallo GETquestions aislado, reintento/reconciliación conservadora, cancelación con nota ordinaria vacía y publicación correcta.

Evidencia actual:

- `npm run check`: PASS lint/typecheck,216Vitest y4omitidas explícitas de backend local; build PASS. Se añadió al final un caso de autor despromovido: suite dirigida de borrador/UI35PASS. El coordinador debe registrar el total global final actualizado.
- `npm run test:sql`:305PASS (G1/G2/GH020/GH022), incluyendo plataforma histórica intacta y rechazo de cambio no admitido.
- Deno frozen del handler `reviews`:PASS; `test:reviews:db` con Deno configurado:PASS (cuerpo Unicode, cancelación y carreras de autoridad/sesión reales).
- `npm run test:reviews -- --e2e`:2HTTP+2E2EPASS en código final. Log saneado `/tmp/gh022-iteration1-real-final.log`; crítica8.5s y regresiónGH0206.8s. Fuente RAWG ya persistida y manual con fuente; no se acredita nueva consulta upstream ni publicación remota.
- `git diff --check`:PASS. Build conserva aviso de chunk mayor500KB (~541KB); ninguna dependencia nueva.

Diagnóstico de intentos previos: un selector getByLabel exacto incluía el texto restaurado del textarea; se sustituyó por rol textbox/nombre accesible y el recorrido pasó. Una repetición HTTP recibió500 externo donde el handler propio solo produce400/503. El coordinador observó `CPU time soft limit reached` en el worker longevo del runtime; repetición secuencial completa pasó sin reinicio ni cambios DB. Las fixtures se limpian incluso al fallar; no se imprimieron credenciales.

La verificación dentro del sandbox produjo cuatro `spawnSync EPERM` de las pruebas existentes verify-rawg; el check escalado las pasó. No se cambió código de producto para acomodar permisos del entorno. Pendientes: vía CIaislada final y tres revisiones/revalidación del coordinador; conservar in_progress.

Cierre de la ejecución de implementación de iteración1: `GH_REVIEWS_ISOLATED=1 npm run test:reviews -- --e2e` terminó2HTTP+2E2EPASS sobre la misma versión final (crítica8.9s, GH0206.3s). Log saneado `/tmp/gh022-iteration1-isolated-final.log`. RAWG es fixture de contrato explícita en esta vía; Auth/Edge/DB siguen siendo reales locales. Ambas suites4173 fueron secuenciales; limpieza por helpers y eliminación exacta de preguntas temporales finalizaron sin errores. Quedan las tres revisiones BMAD y revalidación global a cargo del coordinador. No hay suite activa, commit, reset, modificación de demo5173 ni publicación remota.

## Coordinación final — segunda revisión (2026-11-02)

Se completaron dos rondas de tres revisiones independientes. Todos los hallazgos y sus veredictos están en `spec-gh-022-critica-completa.md`; una rederivación amplió únicamente tareas técnicas de recuperación, conservando idéntica la intención aprobada. Parches posteriores protegen la democión durante preparación, respuestas retiradas, plataformas obsoletas, selección por género/UUID equivalente y comprobaciones RLS no vacuas.

Revalidación root posterior a parches: `npm run check`227PASS/4omitidas, SQL316PASS y Deno/DBPASS. La primera vía real2HTTP+2E2EPASS. La posterior vía aislada halló un500 en concurrencia: el log del runtime a11:53:59UTC mostró `CPU time soft limit reached` seguido de `WorkerAlreadyRetired`, exactamente durante la petición. No se cambió la expectativa409 ni se añadió retry que ocultara el error.

Corrección local de infraestructura: `[edge_runtime].policy="oneshot"` en config.toml y reinicio exclusivamente de `supabase functions serve`, sin reset ni modificación remota. [Referencia oficial de configuración](https://supabase.com/docs/guides/local-development/cli/config): oneshot atiende una petición por worker. El runtime local anterior `per_worker` acumulaba CPU en sesiones extensas. No se generaliza esta evidencia a fiabilidad o carga del runtime alojado. Revalidación completa posterior a este ajuste en curso; no declarar verified hasta registrar su resultado.

### Resultado final verificado

La revalidación posterior al ajuste local pasó: real2HTTP+2E2E; CIaislado2HTTP+2E2E dos veces seguidas; Auth1HTTP+1E2E, manual1HTTP+1E2E, RAWG real1E2E y offline5E2E/5omitidos intencionales. Cero `WorkerAlreadyRetired` y cero avisos de retiroCPU en el nuevo runtime durante todos esos recorridos. Check227PASS/4omitidas y SQL316PASS corresponden al código final; Deno frozen5entrypoints/DB y db lintPASS. No se cambiaron expectativas para aceptar errores.

Limpieza independiente por conteos: cuentas de fixture, juegos manuales de reseñas, juegos RAWG aislados, triggers de fallo y preguntas de recuperación todos0. Clave RAWG no encontrada en archivos versionables. Build543KB/gzip158KB conserva advertencia de fragmento grande para G6; no se afirma rendimiento final ni alta carga.

GH-022 `verified` únicamente en local. No hay hallazgos diferidos: los falsos/bajo impacto rechazados tienen evidencia individual en la historia y los aceptados están corregidos. G3 sigue incompleto por GH023–026. La demo/guía se actualiza sin crear usuarios críticos/admin predefinidos ni publicar cambios remotos.

### CI y demo estable

Commit de código `e001062f05ecc231c31b72238ae2b6e26e1d426c`, [PR#5](https://github.com/KingOwls/GameHive/pull/5). [CI41441855148](https://github.com/KingOwls/GameHive/actions/runs/41441855148) SUCCESS en foundation e identity-backend, confirmada tras completar ambos jobs.

Demo estable local en127.0.0.1:5173 desde snapshot de ese commit, separada de dist para permitir pruebas posteriores. Smoke real fichaRAWG→reseñas,0pageerrors y auditoría axe completa0violaciones; captura revisada `/tmp/gamehive-gh022-demo.png`. El primer helper de smoke usó browser.newPage y axe exigió contexto explícito; se corrigió el helper a browser.newContext y se repitióPASS, sin cambiar producto. No prueba despliegue remoto ni cierra G3.
