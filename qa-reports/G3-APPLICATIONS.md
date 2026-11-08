# GH-023 — candidaturas privadas de críticos

Estado: `verified local`, 2026-11-07. Primera ronda independiente completa; segunda ronda sustituida por revisión manual con autorización humana (ADR-003). G3 abierto; sin publicación Supabase/Vercel ni certificación RAWG. CI nueva pendiente de subir la entrega.

## Implementación y contrato

Migraciones generadas por CLI y aplicadas con `migration up --local`, sin reset ni reinicio del runtime/demo:

- `20261107185417_critic_applications.sql`: evidencia/avisos privados, constraints/índices/RLS y operación invoker.
- `20261107190405_critic_application_terminal_integrity.sql`: nulabilidad terminal explícita y no autorresolución.
- `20261107190748_critic_application_target_guard.sql`: autoridad objetivo ausente denegada y elegibilidad activa en avisos.
- `20261107191944_critic_application_user_seal_eligibility.sql`: aclaración humana sobre usuarios con sello previo.
- `20261107193819_critic_application_rederive.sql`: normalización Unicode canónica, predicado privado de espera, historial administrativo y consulta exacta con autoridad actual. Generada por CLI y aplicada mediante `db push --local --yes`; cuatro migraciones anteriores preservadas byte por byte.

Tablas privadas con RLS denegatoria y revocaciones explícitas para public/anon/authenticated/service_role. Función invoker sin grants API; lock718007013 compartido con identidad, sesión FOR SHARE y autoridad/objeto bloqueados.

POST `/functions/v1/critic-applications`: exactamente `{operation,input}`. Operaciones: `submit` ({organization,experience,sample,links}), `own-history`, `admin-queue`, `admin-history`, `own-notices` ({page}), `admin-get` ({id}), `resolve` ({id,version,decision:approved|rejected,reason}), `cancel` ({id,version,reason}), `markRead` ({id}). Páginas20 con orden created_at DESC,id ASC. JWT getUser online, sesión real, cuerpo64KiB, plazo10s y query8s/cancelación. Respuestas201/200, inválidos400, token401, permisos/sesión403, conflicto409, fallo503 saneados.

Aclaración humana2026-11-07: «Sí: cualquier usuario; solo críticos sin verificar». Todos los usuarios activos pueden solicitar (sello false o true); críticos activos solo false. Snapshot conserva el sello real. Solicitar no modifica rol/sello/reputación. Aprobar concede critic+true y resuelve/avisa/audita atómicamente. Rechazo conserva autoridad y exige168horas completas. Anulación motivada solo por cambio de rol/sello y objetivo activo; suspensión conserva pendiente. Avisos propios disponibles para suspendidos con sesión vigente.

Rutas `/critic/apply`, `/admin/users`, `/notifications`, formulario/historia/cola/bandeja, borradores por actor y solicitud, loading/empty/error/retry. Tras409 o ACK incierto se exige consulta sin repetir escritura. No archivos/correos/descargas de evidencias. React revisado con skill react-best-practices: efectos cancelables, claves por actor, labels, borradores y estado derivado. Evidencia larga tiene ajuste de línea.

## Verificación de iteración 0 (histórica)

| Comando | Resultado real |
|---|---|
| `npm run check` | lint/typecheck/buildPASS;266VitestPASS/8omitidas de suites locales ejecutadas separadas. Bundle581–583KiB mantiene aviso de rendimientoG6. |
| `supabase test db --local` | 8archivos/510PASS,92GH023. |
| Deno `check --frozen` | 8handlers + runtime nuevoPASS; sin nuevas dependencias. |
| `GH_DENO_BIN=/tmp/gamehive-deno/deno DENO_DIR=/tmp/gamehive-deno-cache npm run test:applications:db` | 2PASS:64KiB/cancelación y carreras reales de alta/resolución/democión/suspensión/revocación/cambio de sello. |
| `npm run test:applications -- --e2e` final | HTTP1PASS18.34s, incluido tamaño65536aceptado/65537denegado, user+sello previo y paginación21avisos. E2E1PASS21.9s, teclado/axe, admisión, rechazo y sello previo. |
| `supabase db lint --local` | Sin errores de esquema. |
| `supabase db advisors --local --type security --level warn --fail-on warn` | CeroWARN/ERROR. |

Las regresiones siguientes terminaron estrictamente una a una antes de la aclaración puntual de elegibilidad; la cuarta migración modifica solo el nuevo gateway privado y su DTO. SQL/check/runtime y HTTP/E2E de GH023 se reejecutaron después de ella.

| Regresión local | HTTP | E2E |
|---|---|---|
| `npm run test:backend -- --e2e` | 1PASS | 1PASS6.1s; caso sin configuración omitido en entorno configurado |
| `npm run test:manual -- --e2e` | 1PASS | 1PASS4.5s |
| `GH_REVIEWS_ISOLATED=1 npm run test:reviews -- --e2e` | 2PASS | 2PASS:crítica28.7s/reseña23.2s |
| `GH_REVIEWS_ISOLATED=1 npm run test:votes -- --e2e` | 1PASS | 1PASS16.6s |
| `GH_REVIEWS_ISOLATED=1 npm run test:library -- --e2e` | 2PASS | 2PASS19.5s/6.4s |

Catálogo aislado es fixture explícita; no acredita disponibilidad ni respuesta real de RAWG. Transcripciones de regresión privadas, sin claves: `/tmp/gh023-test-backend.log`, `/tmp/gh023-test-manual.log`, `/tmp/gh023-test-reviews.log`, `/tmp/gh023-test-votes.log`, `/tmp/gh023-test-library.log`.

La afirmación temporal de esta iteración acreditaba una llamada posterior al límite real; no igualdad exacta. La rederivación siguiente reemplaza esa evidencia por pruebas deterministas del predicado usado por la operación.

## Matriz aprobada y evidencia

| Fila de intención | EvidenciaPASS |
|---|---|
| Alta elegible privada | SQL/HTTP/UI/E2E; historial de tercero vacío y cola denegada a moderador. |
| Usuario con sello previo | SQL/DTO/HTTP/E2E:expected_verifiedtrue; solicitar conserva user:true y reputación0; rechazo conserva user:true. |
| Pendiente duplicada/carrera | SQL/HTTP/runtime:un ganador201,un409,una fila. |
| Admisión/rechazo admin vigente | SQL/HTTP/runtime/E2E:rol+sello+aviso+auditoría atómicos. |
| Actor sin permiso/autoresolución/falsificación | SQL cuatro roles+anon/API/service_role y HTTP; guard visual admin; metadata extra denegada. |
| Autoridad cambiada/versión obsoleta | SQL/HTTP/runtime:409 sin sobrescribir; autoridad objetivo ausente también409. |
| Anulación motivada/estado suspendido | SQL/HTTP:anula por cambio de sello,libera pendiente,sin autoridad; suspensión bloquea resolver/anular y conserva pendiente. |
| Fallo aviso/auditoría | SQL con triggers restringidos a UUIDfixture:rollback completo de autoridad,estado y aviso. |
| Rechazo y espera | SQL/HTTP/E2E:antes168hdenegado,desde límiteaceptado,nuevoID e historia conservada. |
| Avisos propios suspendidos | SQL/HTTP/UI:lectura/marcado propios permitidos; tercero/revocación denegados. |

Aprobar conserva `reviews.kind=user` histórico y propaga únicamente sello real (SQL). Paginación privada21avisos/2páginas sin duplicación ni pérdida (HTTP). Borrador,409/ACK, remount/actor, decisión motivada y guard admin cubiertos por5UI+4contratosVitest.

## Defectos y correcciones revalidados

1. Date.now durante render detectado por lint: reloj trasladado a estado actualizado al leer y timer de vencimiento; checkPASS.
2. CHECK terminal podía admitir NULL: migración posterior exige fecha/motivo y prohíbe autorresolver; SQLPASS.
3. Primer check en sandbox bloqueó cuatro tests existentes con spawnSyncEPERM: repetición autorizada fuera del sandboxPASS, sin modificar esas pruebas ni simular proveedor.
4. Revocación detectada por getUser devolvió401, aunque el test esperaba403; expectativa HTTP ajustada a401, SQL sigue comprobando42501 de sesión inexistente; HTTPPASS.
5. Una repetición SQL coincidió indebidamente con navegador y contaba avisos globales: filtros porUUID y triggers de fallo restringidos al fixture. Todas las suites posteriores estrictamente secuenciales; SQL510PASS.
6. Selector E2E `getByLabel(Decisión,exact:true)` no coincidía con label que incluye opciones. Cierre en finally enmascaró el sitio inicial. Limpieza se realiza antes de close, límites15s/20s en todos los contextos y selector combobox por nombre; revalidación21.9sPASS sin ampliar timeout. Cinco cuentas del primer fallo limpiadas por UUID exactos.
7. Nueva prueba UI comparaba espacio final normalizado por Testing Library: `.trim()` en expectativa; check266PASS.
8. Revisión propia detectó autoridad objetivo ausente: guard explícito en migración posterior, SQL/runtimePASS.
9. Interpretación inicial excluía user+true: humano aclaró el caso concreto; cuarta migración/DTO/UI/SQL/HTTP/E2E aplicados y revalidados.

## Limpieza y entrega al coordinador

Comprobación final real:0perfiles/evidenciasfixtureGH023,0grantsAPI de tablas/funciones nuevas,0tablas nuevas sinRLS. Puerto4173libre; demo5173sigue escuchando sin cambios. No procesos de Vitest/Playwright/runnerGH023 activos. Funciones y stack locales conservados para auditoría.

Pendiente únicamente auditoría completa y tres revisiones BMAD del coordinador antes de considerar `verified`; resolver cualquier hallazgo con migración nueva si afecta esquema/función ya aplicada. No hay autorización de commit/push/publicación remota del implementador.


## Rederivación 1 — implementación y evidencia (2026-11-07)

BL01: Edge normaliza con `String.trim` antes de contar codepoints; SQL usa una enumeración explícita idéntica de whitespace y refuerza checks de almacenamiento. SQL/DTO/HTTP deniegan texto vacío Unicode; un alta válida normalizada se recupera por DTO sin envenenar la cola. No se cambian los límites ni los campos exactos.

BL02/BL03/BL05: `admin-history` y `admin-get` solo aceptan admin activo con sesión vigente. La cola y las lecturas administrativas incluyen únicamente rol/estado/sello actuales, junto al snapshot conservado. La UI muestra ambos, explica suspensión frente a cambio de autoridad y presenta resultado/motivo/resolver/fecha reales después de un200. Después de una respuesta perdida consulta el ID afectado; si sigue pendiente exige revisión explícita. Historial conserva evidencia y resultados terminales.

BL04/BL06/BL07/BL08: borrador JSON de decisión+motivo por admin y candidatura, ocultación de datos e identidad previos cuando falla una lectura, enlace administrativo condicionado por identidad activa y retorno a la última página válida al vaciar la segunda. Acceso propio al historial conservado para personas que dejan de ser elegibles. Las pruebas dirigidas cubren restauración, pérdida de permisos, recuperación pendiente/terminal y paginación.

BL10/VG02: `application_cooldown_elapsed` no tiene grantsAPI y se usa con `clock_timestamp()` en submit. SQL prueba168horas menos1microsegundo, igualdad exacta y más1microsegundo; HTTP comprueba el reloj real y no recibe `now`. Prueba UI con reloj controlado habilita el mismo formulario exactamente al vencimiento, sin otra lectura.

BL09/VG01: navegador mantiene abierta la segunda sesión del candidato y, tras admisión, publica una crítica completa con ocho criterios, preguntas y sello real. También provoca pérdida de la respuesta administrativa después del commit real, recupera la decisión por ID, anula desde pantalla tras cambio real de rol, verifica historial y aviso, comprueba autoridad intacta y presenta nueva candidatura.

Resultados confirmados de esta rederivación: check276PASS/8omitidas; SQL528PASS (110GH023); Deno8handlersPASS; runtimeDB2PASS; HTTP1PASS con entradas adversariales Unicode, historial administrativo paginado y denegaciones; E2E1PASS37.7s con teclado/axe, ACK perdido, crítica funcional, rechazo/espera y anulación completa. Regresiones y seguridad finales se registran al cerrar esta ronda.

Fallo real corregido: el primer E2E ampliado consiguió publicar la crítica pero su aserción posterior nombraba una columna inexistente (`author_verified`) y esperaba un valor de kind incorrecto. Se corrigió al contrato existente (`critic_verified`, `kind=critic`), sin cambiar producto ni ampliar timeouts; repetición completa PASS. Limpieza se ejecutó en finally en ambos intentos.

G3/GH023 permanecen `in_progress` hasta auditoría final y tres revisiones del coordinador. No se ejecutó reset, commit, push ni publicación remota; RAWG no está acreditado por el catálogo aislado.


Parche de coordinación, rederivación1: se conserva el ID de recuperación hasta completar también la lectura de cola/historial. La prueba dirigida reproduce `adminGet200 → queue503 → reintento`, exige volver a consultar el mismo ID y demuestra que no repite escritura. Check final276PASS/8omitidas, sin avisos de lint ni errores de tipos/build.

Regresiones secuenciales de la rederivación: G1Auth1HTTP+1E2EPASS; manual1HTTP+1E2EPASS; reseñas/críticas2HTTP+2E2EPASS; votos1HTTP+1E2EPASS; biblioteca2HTTP+2E2EPASS. Las rutas de reseñas/votos/biblioteca usan catálogo aislado declarado y no certifican RAWG. `db lint --local` y advisors de seguridad sin errores/avisos.


Cierre de verificación de rederivación1: repetición final GH023 HTTP1PASS y E2E1PASS38.3s sobre el parche de recuperación. Logs locales saneados: `/tmp/gamehive-gh023-rederive-final-check.log`, `/tmp/gamehive-gh023-rederive-sql.log`, `/tmp/gamehive-gh023-rederive-deno.log`, `/tmp/gamehive-gh023-rederive-runtime.log`, `/tmp/gamehive-gh023-rederive-final-applications.log` y regresiones con sufijos auth/manual/reviews/votes/library/lint/advisors.

Limpieza final consultada:0cuentasfixtureGH023,0candidaturas,0avisos,0juegos manuales temporalesGH023;0grantsAPI de tablas/funciones nuevas y0tablas nuevas sinRLS.4173libre;5173continúa escuchando. Stack y funciones locales conservados para auditoría. Las cuatro migraciones originales y el bloque congelado de intención coinciden byte por byte con la copia preservada.

## Cierre final del coordinador — 2026-11-07

La segunda ronda independiente se interrumpió por límite de uso en los tres agentes y no produjo revisiones válidas. El propietario autorizó continuar con revisión manual y pruebas automáticas mientras falten revisores; [ADR-003](../docs/decisions/ADR-003-review-fallback.md). La primera ronda independiente y sus doce hallazgos se conservan; la rederivación resolvió todos. No se afirma una segunda ronda independiente.

Siete hallazgos manuales valorados antes de agrupar y corregidos: evidencia oculta inmediatamente tras401/403 al decidir, resultado anterior retirado durante otra escritura, claves estables para enlaces repetidos, límites del contexto de anulación, pruebas de navegación por rol/error, HTTPS case-insensitive y etiquetas españolas. Detalle individual en Review Triage Log de la historia. La sexta migraciónCLI `20261108004948_critic_application_https_scheme.sql` se aplicó solo localmente; nombre generado enUTC, decisión/revisión del7noviembre enBogotá. Ninguna migración aplicada se reescribió.

Verificación final coordinada y secuencial: check285PASS/8omitidas de suites locales separadas,SQL529PASS,Deno8handlersPASS,runtimeDB2PASS,HTTP1PASS,E2E1PASS40.6s,lint/advisorssinissues. Las últimas etiquetas españolas se revalidaron con lint/tipos/build y navegador39.3s. Logs privados600 `/tmp/gamehive-gh023-final-*.log`;28contratos/UI dirigidosPASS. Regresiones de rederivación G1/manual/reseñas/críticas/votos/bibliotecaPASS permanecen aplicables; los parches finales afectan únicamente GH023.

Consulta final independiente:0cuentasfixture,0candidaturas,0avisos,0manualestemporales,0grantsAPI de tablas/funciones nuevas,0tablas nuevas sinRLS. La matriz congelada se conserva idéntica a la aclaración humana; límite exacto acreditado por predicado privado usado por submit y testUI, HTTP con reloj real. Bundle~585KB sigue pendiente de optimizaciónG6. No hay diferidos nuevos de revisión ni cambios al repositorio de referencia.

GH023 verified local; G3/G4 abiertos. Revisión manual limitada a un coordinador, no tres personas independientes. GitHub/CI de esta entrega se registrarán al subir; ninguna evidencia local certifica despliegue remoto.

Demo final actualizada desde copia idéntica del build conectado: /tmp/gamehive-demo-gh023-2bh3al6z, puerto5173. HTTP200 en /,/library,/critic/apply,/admin/users,/notifications y bundle verificado con backendlocal; navegador sobre la misma compilaciónPASS. Escáner461archivos fuente/build:0coincidencias de clave privadaRAWG. Servicios locales conservados.
