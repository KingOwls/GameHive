---
title: 'GH-023: solicitar y resolver admisión como crítico'
type: feature
created: '2026-11-06'
status: done
route: dispatch
review_loop_iteration: 1
baseline_commit: 727bdb396a61f190e02087c4340d8b51d099e707
context: ['AGENTS.md','GAMEHIVE_MASTER_SPEC.md','docs/IDENTITY.md','docs/plans/G3.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

Una persona presenta su candidatura privada a crítico, un administrador la admite o rechaza con motivo y la persona consulta el resultado persistido y su aviso interno.

## Boundaries & Constraints

Cualquier usuario activo, incluso con sello previo, y críticos activos sin verificar pueden solicitar; moderadores, administradores y críticos ya verificados no son elegibles. Una solicitud pendiente por cuenta; historial de resoluciones conservado. Decisiones humanas2026-11-06: aprobar concede rol critic y sello critic_verified=true en la misma operación; tras rechazo, esperar siete días completos desde la resolución antes de otra candidatura. Elegibilidad confirmada por el humano2026-11-07: «Usuarios y críticos sin verificar». Aclaración humana2026-11-07: «Sí: cualquier usuario; solo críticos sin verificar». Rol y sello siguen separados; solicitar no concede ninguno. El snapshot conserva el sello real del usuario, incluso true.

Candidatura contiene procedencia/grupo (admite independiente), experiencia, muestra textual y enlacesHTTPS opcionales. Nunca subir archivos, descargar enlaces ni enviar correos. Evidencias, decisiones y avisos son privados: dueño y admin activo pueden consultar candidatura; moderador no la resuelve ni lee evidencia ajena. No incluir email/secretos en respuestas públicas.

Resolver exige admin y sesión vigentes, cuenta objetivo activa que conserva el rol/estado elegible registrado al solicitar, versión/estado pendiente y actor distinto del solicitante. Conceder rol, resolver, insertar notificación y auditar en una transacción; concurrencia no duplica resolución. Rechazo no cambia autoridad. Solicitar no autoverifica ni incrementa reputación.

Decisión humana2026-11-07: si cambió rol/sello, admin puede anular con motivo, aviso y auditoría atómicos, sin cambiar autoridad; conserva historia y libera pendiente. Espera7d solo tras rechazo. Suspensión temporal conserva pendiente hasta reactivar; no habilita anulación.

Bandeja mínima propia permite leer/marcar leído con sesión vigente incluso estando suspendido (necesario para avisos futuros); nunca leer avisos ajenos. Sin perfil crítico, seguidores, gestión general de roles, sanciones ni despliegue remoto en esta historia.

## I/O & Edge-Case Matrix

| Dado | Cuando | Entonces |
|---|---|---|
| Cuenta elegible activa sin pendiente | envía candidatura válida | pendiente propia persistida; tercero no accede |
| Usuario activo con sello previo | solicita | elegible; sello real capturado, no autoconcede autoridad |
| Existe pendiente | repite o compite otra alta | 409 y una sola fila |
| Admin activo y solicitud vigente | admite o rechaza | resolución/autoridad/aviso/auditoría atómicos |
| Actor sin permiso o solicitante | intenta resolver o falsificar metadata | 403 sin resolución |
| Objetivo con rol/estado cambiado o versión obsoleta | admin intenta resolver | 409 sin sobreescribir autoridad |
| Rol/sello cambiado, objetivo activo | admin anula con motivo | terminal auditada, aviso propio, sin autoridad; permite nueva si elegible |
| Fallo de auditoría o aviso | se resuelve candidatura | rollback completo |
| Solicitud rechazada | reintenta antes de7d o desde7d exactos | antes denegado; desde límite nuevo ID e historia conservada |
| Suspendido con sesión vigente | consulta sus avisos | lectura propia permitida; ajenos/revocada denegados |

</frozen-after-approval>

## Code Map

`20261031235359_identity.sql`: authz/current_identity/admin_update_identity/audit_logs; reutilizar lock718007013 y capturar rol/estado/sello esperados. `20261106234148_library.sql`: sesión FOR SHARE y operación invoker. `_shared/library.ts` y `manual-game-deadline.ts`: JWTonline, body/deadline/query cancelable; avisos omiten solo estadoactivo, no sesión/dueño. Configurar critic-applications JWTfalse. Revokes explícitos también service_role; sin definer nuevo.

AuthContext conserva sesión suspendida; AdminGamesPage ofrece guard visual. `sync_review_author_status` propaga sello sin convertir kind.

## Tasks & Acceptance

- [x] `supabase/migrations/*_critic_applications.sql`: generarCLI; candidaturas/avisos privados, FKs/fechas/versión/estados/checks/índices, unique pendiente, anulación motivada y espera7d; RLSdeny y cero grantsAPIincluidoservice_role. Resolución+autoridad+aviso+auditoría invoker atómica, rol/estado/sello esperados y objeto bloqueados.
- [x] `supabase/functions/critic-applications/index.ts,supabase/functions/_shared/critic-applications.ts,supabase/config.toml`: JWTonline/sesiónvigente/campos exactos/cancelación; submit/own-history/adminqueue/resolve/cancel/own-notices/markRead; páginas20/ordenestable. Procedencia3–120, experiencia40–3000, muestra40–5000,3URLsHTTPS/2048máximo, motivo10–500; codepoints/body64KiB/deadline10s/query8s.401/403/400/409/503 saneados.
- [x] `src/services/critic-applications.ts,src/domain/models.ts,src/features/critics/CriticApplicationPage.tsx,src/features/admin/CriticApplicationsPage.tsx,src/features/notifications/NotificationsPage.tsx,src/app/App.tsx,src/features/auth/AccountControl.tsx`: contratos/rutas /critic/apply,/admin/users,/notifications; formulario/historia/cola motivada/bandeja. Evidencias privadas, loading/empty/error/retry, borrador por actor y recuperación409/ACK consultando sin repetir; anulación motivada.
- [x] `supabase/tests/critic-applications.test.sql,supabase/tests/critic-applications-runtime.test.ts,tests/unit/applications.test.ts,tests/integration/applications-ui.test.tsx,tests/integration/applications-live.test.ts`: matrizSQL/HTTP/UI cuatro roles+anon/dueño/tercero, revocación/suspensión/carreras, escalada/IDOR, rollbackaudit/aviso, anulación/cambio de sello,7d antes/exacto/después, avisos propios suspendidos. Aprobar no convierte reseña histórica.
- [x] `tests/e2e/applications.spec.ts,scripts/local-applications-tests.mjs,scripts/test-applications-db.mjs,.github/workflows/ci.yml`: candidato→otra sesión→admin→resultado/aviso/criticverificado funcional; rechazo/espera, teclado/axe, fixtures exactas/limpieza. RegresionesG1/manual/reseñas/críticas/votos/biblioteca; catálogo aislado no acreditaRAWG.
- [x] `qa-reports/G3-APPLICATIONS.md,docs/plans/G3.md,BACKLOG.md,docs/REQUIREMENTS.md,docs/PROGRESS.md`: evidencia/errores/correcciones/tresrevisiones; verified solo trasPASS, G3 abierto.

## Verification

Cada fila exigePASS; check/SQL/Deno/runtimeDB/HTTP/E2E/regresiones/advisors secuenciales. Local no acredita remoto/RAWG.

## Implementation Notes

Implementación local2026-11-07: migracionesCLI20261107185417/20261107190405/20261107190748/20261107191944 (original aplicada preservada), invoker privado con lock/sesión/autoridad, gatewayJWTonline y páginas solicitud/cola/avisos. Historial permanente, espera168horas, anulación por cambio de rol/sello, aprobación atómica y conservación de kind histórico. Contrato/evidencia/defectos en `qa-reports/G3-APPLICATIONS.md`.

Verificación del implementador:SQL510/check266PASS,Deno8handlers+runtimePASS,HTTP1/E2E1PASS; regresiones secuenciales G1/manual/reseñas/críticas/votos/biblioteca y lint/advisorsPASS. Limpieza0fixtures/4173libre/demo5173intacta. Estado `in-progress` hasta auditoría final y tres revisiones del coordinador; sin publicación remota/reset/commits.

## Spec Change Log

2026-11-07 — aclaración humana autorizada: «Sí: cualquier usuario; solo críticos sin verificar». Snapshot `expected_verified` conserva el valor real incluso true para user. Cuarta migraciónCLI y DTO/SQL/HTTP/E2E ajustados; resto del bloque aprobado preservado.

### Rederivación 1

2026-11-07 — BL01/02/03/05/10 provocan bad_spec: preparación no fijaba normalización coherente, lectura administrativa terminal/autoridad actual ni verificación temporal exacta. Se amplían solo secciones no congeladas para evitar cola envenenada, confirmaciones inciertas y anulación a ciegas. KEEP: límites/campos exactos/JWTonline/sesiónFORSHARE/lock718007013, invoker sin grants, atomicidad/auditoría/avisos, elegibilidad userconsealed y critsinverificar,7dservidor, snapshots/carreras, privacidaddueño/suspendido, tipo histórico y sello, body64KiB/deadline10/query8/cancelación, fixtures aisladas/limpieza, regresiones y demo5173. Reutilizar lo correcto tras rederivar; no repetir los estados malos catalogados.

KEEP operativo: cuatro migraciones ya aplicadas deben restaurarse idénticas desde /tmp/gamehive-gh023-iteration0-preserved/supabase/migrations antes de añadir cualquier migración CLI posterior. No reset ni borrar datos; DB local conserva migraciones y0fixtures. La copia privada /tmp/gamehive-gh023-iteration0-preserved contiene la implementación previa para preservar lo bueno y sus pruebas, nunca credenciales. La demo5173 sirve snapshot independiente y funciones siguen activas;4173está libre. Toda suite/build se ejecuta secuencialmente.

## Review Triage Log

Auditoría coordinador2026-11-07: diff completo /tmp/gamehive-gh023-coordinator-review.patch leído; seis tareas implementadas. Diez filas de matriz cubiertas por SQL510PASS, runtime2PASS y HTTP1/E2E1PASS23.0s, check266PASS/8omitidas y lint/advisorsPASS. Documentos mantienen in_progress hasta paso4; tres revisiones todavía pendientes. Intención renegociada idéntica al archivo aprobado.

### Revisión 1 — veredictos individuales

| Hallazgo | Veredicto | Evidencia verificada |
|---|---|---|
| BL01 normalización | high | SQLbtrim elimina espacio ordinario pero no40saltos de línea; Edge solo valida links. La fila pasa checks, parseApplication.trim rechaza y map(parse) rompe toda cola. Entrada autenticada alcanzable, no respuesta malformada hipotética. |
| BL02 consulta admin resueltos | medium | admin-queue filtra pending y own-history solo actor. Falta acceso administrativo a evidencia/resultado persistido autorizado por intención; registros existen pero ningún consumidor admin puede recuperarlos. |
| BL03 autoridad actual | medium | Cola solo lleva snapshot y ni lo muestra; cambios reales de rol/sello/suspensión probados llevan409 indistinguible. Admin no puede saber si debe anular o esperar sin intentar acciones a ciegas. |
| BL04 decisión restaurada | medium | sessionStorage solo guarda motivo; remount inicializa approved. Motivo de rechazo recuperado bajo admisión puede conceder autoridad equivocada. |
| BL05 ACK administrativo | medium | Al perder respuesta, refresh lee solo pendientes y setUncertain(false); desaparición no distingue approved/rejected/cancelled ni quién decidió. Contrato de consulta de resultado exige lectura exacta autorizada. |
| BL06 datos tras denegación | medium | catch conserva data y, si identity falla, identityadmin anterior. Evidencia/avisos siguen renderizados después de403/401 conocido; descartar/suprimir lectura fallida preservando borradores. |
| BL07 navegación | low | Enlace admin aparece para todos diariamente y termina restringido. Enlace propio sí da historial incluso si no puede solicitar; mantener esa función y condicionar enlace administrativo a identidad vigente. |
| BL08 página vacía | medium | Resolver último elemento página2 conserva page2,total20 y muestra cola vacía pese a20pendientes. Estados alcanzables con paginación20; ajustar página al total. |
| BL09 autoridad funcional | medium | E2Eleecritic:true porDB pero no ejerce operación crítica desde sesión ya abierta. Brecha del criterio criticverificado funcional; usar acción real protegida, sin simular rol. |
| BL10 límite exacto | medium | UPDATEclock_timestamp y llamada posterior prueban ligeramente después, no igualdad exacta. Frozen exige límite; extraer predicado privado usado por operación con reloj servidor y probar antes/igual/después sin reloj inyectable porAPI; corregir alcance de evidencia. |
| VG01 anulaciónUI | medium | Brecha pre-verificada: HTTPhelper usa cancel correcto pero UI/E2E solo approved/rejected. Desconectar cancel en servicio/pantalla deja tests verdes. |
| VG02 vencimientoUI | medium | Brecha pre-verificada: UInextAllowedAtnull en todos fixtures; E2E solo espera reciénrechazada. Quitar callbacktimer no falla pruebas; verificar misma pantalla montada con reloj controlado. |

Edge hunter:[]; sin hallazgos. Todos los veredictos anteriores se dictan antes de agrupar.

Agrupación/ruta posterior: B1bad_spec BL01 (normalización servidor/SQL/cliente); B2bad_spec BL02+BL05 (falta consulta administrativa terminal para recuperación/historia); B3bad_spec BL03 (datos autorizados de autoridad actual necesarios para elegir anulación o espera); B4bad_spec BL10 (verificación determinista del predicado temporal realmente usado). BL04/BL06/BL07/BL08/BL09/VG01/VG02 serían patch de estado/pruebas; quedan subordinados a rederivación y se incorporan a la preparación corregida. Sin defer ni cambio de intención.

### Segunda ronda — sustitución manual autorizada2026-11-07

Los tres agentes independientes terminaron por límite de uso sin entregar informes. El humano autorizó «Autorizar revisión manual y continuar» mientras no estén disponibles; decisión en `docs/decisions/ADR-003-review-fallback.md`. No se cuenta esta ronda como tres revisiones independientes. Paquetes autónomos históricos preparados localmente; primera ronda y doce hallazgos conservados.

| Hallazgo manual | Veredicto | Evidencia y resolución |
|---|---|---|
| M01 permiso de decisión retirado | medium | catch de resolve401/403 conservaba evidencia hasta refresh. Ahora oculta data/identidad/resultado inmediatamente, conserva borrador y exige consultar; dos pruebas dirigidasPASS. |
| M02 resultado anterior durante otra decisión | medium | result persistía al empezar otra escritura y podía confundirse con su resultado. Se limpia al iniciar decide; prueba con segunda respuesta diferidaPASS. |
| M03 enlaces repetidos | low | Hasta3URLs pueden repetirse y key=link colisionaba. Clave índice+URL, corrección directa sin cambiar datos. |
| M04 timeout de contexto de anulación | low | Nuevo cancelCtx no heredaba límites15s/20s prometidos para el test. Se fijan explícitamente; navegador completoPASS. |
| M05 navegación sin regresión observada | medium | Búsquedas de AccountControl/selector no localizaron aserciones de visibilidad por rol. Cinco combinaciones y fallo de identidad ahora comprueban salida real de navegación;PASS. |
| M06 esquema HTTPS en mayúsculas | low | StartsWith/regexSQL rechazaban esquema válido HTTPS. Corrección coherente case-insensitive en cliente/Edge/funciónSQL, sexta migraciónCLI; SQL/DTO/HTTPPASS conservando restricciones de host/credenciales. |
| M07 etiquetas de autoridad | low | UI mostraba enums user/active en inglés. Mapas tipados a español; lint/typecheck/build y repeticiónE2E39.3sPASS. |

Veredictos antes de agrupación; siete grupos independientes patch de alcance directo, todos corregidos por coordinador conforme a excepción autorizada. Ningún defer nuevo ni cambio al bloque congelado. Se revisaron también contratos/slots de sesión/locks, respuestas privadas, paginación, límites/cancelación y ejecución efectiva de matriz. No se habilitó reloj ni autoridad desdeAPI.

## Preparación corregida para rederivación 1

- Normalizar texto JS/SQL de modo coherente (Unicode trim y codepoints), incluidos procedencia/experiencia/muestra/motivo. Denegar texto solo whitespace y no permitir envenenar una página admin con datos aceptados por servidor pero rechazados por cliente. Prueba HTTP adversarial real y SQL/DTO.
- Añadir lectura administrativa paginada de historial y consulta por ID de candidatura, solo admin activo/sesión vigente; evidencia privada, resultado/motivo/resolver/fecha autoritativos. UI muestra resultado tras200 y, ante ACK perdido, consulta ese ID sin repetir escritura; pendiente exige revisión explícita, terminal muestra decisión real aunque la haya tomado otro admin. Owner/mod/anon denegados a lecturas admin.
- Cola administrativa incluye snapshot y autoridad actual del candidato (solo rol/estado/sello, nunca email/preferencias); presenta ambas y diferencia suspensión temporal de cambio de rol/sello. Guards servidor actuales se preservan.
- Persistir decisión seleccionada junto al motivo por admin+candidatura; no restaurar rechazo como aprobación. Ante lecturas denegadas/fallidas, ocultar data privada previa e identidad admin obsoleta, conservar borradores. Navegación administrativa solo para admin activo; acceso propio a historial no se pierde por dejar de ser elegible. Ajustar página al resolver última fila.
- Predicado temporal privado sin grantsAPI, usado por operación con clock_timestamp del servidor: tests deterministas inmediatamente antes/igual/después168h; HTTP sigue probando reloj real, nunca recibir now del cliente. UI con reloj controlado habilita mismo formulario al vencer sin recarga.
- E2E amplía anulación desde pantalla→historial/aviso/sin autoridad/pendiente liberada y acción crítica funcional desde sesión del recién admitido. Cubrir recuperaciónACK administrativo después de commit, selección/motivo restaurados y paginación/errores mediante pruebas dirigidas.



### Implementación de rederivación 1 — 2026-11-07

Restauradas las cuatro migraciones aplicadas idénticas desde copia preservada. Quinta migraciónCLI `20261107193819_critic_application_rederive.sql` aplicada solo localmente mediante `db push --local`: normalizaciónUnicodeSQL/Edge, checks canónicos, predicado privado168h usado con reloj servidor, historial/admin-get con autoridad actual. Servicio/UI incorporan recuperación exacta, decisión+motivo persistidos, datos descartados al fallar lectura, navegación administrativa condicionada, autoridad comparada y paginación corregida. Coordinación detectó recuperación descartada prematuramente tras adminGet200+queue503; corregida conservando ID hasta terminar ambas lecturas y prueba dirigida revalidada.

Verificación secuencial real: check276PASS/8omitidas,SQL528PASS,Deno8handlersPASS,runtimeDB2PASS,HTTP1PASS,E2E1PASS38.3s. Navegador ejerce ACK perdido tras commit, crítica funcional desde sesión recién admitida y anulación completa desde pantalla. RegresionesG1/manual/reseñas+críticas/votos/bibliotecaPASS; lint/advisorssinissues. Limpieza0fixtures/avisos/candidaturas/juego temporal,0grantsAPI,4173libre/demo5173intacta. Evidencia y fallo de aserciónE2E corregido en `qa-reports/G3-APPLICATIONS.md`. Mantener `in-progress` hasta auditoría y tres revisiones del coordinador; G3 abierto, sin reset/commit/push/publicación remota ni acreditaciónRAWG.

Auditoría coordinador de rederivación1: fuente/diff inicial más delta completo de1682líneas leídos; seis tareas verificadas. Diez filas de intención y ampliaciones de revisión ejecutadasPASS:check276/8omitidas,SQL528,runtime2,HTTP1+E2E1(39.3s), lint/advisorssinissues. El límite exacto se acredita por predicado privado real antes/igual/después; HTTP usa reloj servidor. Cuatro migraciones e intención preservadas; sin suites activas. Pendiente segunda ronda de revisión. Logs600 /tmp/gamehive-gh023-root-i1-*.log.

Cierre local2026-11-07: seis tareas y diez filas auditadas. Check285PASS/8omitidas (suites locales aparte),SQL529,Deno8,runtime2,HTTP1/E2E1PASS40.6s; cambio posterior solo etiquetas españolas revalidado con lint/tipos/build y navegador39.3s. Primera ronda independiente completa y segunda manual autorizada; siete correcciones finales, sin diferidos nuevos. Conteos finales0fixtures/0grantsAPI/0tablas sinRLS. Sin publicación Supabase/Vercel. Subida GitHub autorizada por petición humana original de crear/subir este repositorio nuevo, sin modificar referencia.
