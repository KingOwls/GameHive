---
title: 'GH027–028: conservar y compartir la biblioteca personal'
type: feature
created: '2026-11-06'
status: done
route: dispatch
review_loop_iteration: 0
baseline_commit: a4212084674417e537b1319dfd7bc981d4f7ede8
context: ['AGENTS.md','GAMEHIVE_MASTER_SPEC.md','docs/IDENTITY.md','docs/plans/G4.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

Una persona guarda juegos reales en su biblioteca, organiza sus marcas desde dos sesiones y decide expresamente si otras personas pueden consultarla desde su perfil.

## Boundaries & Constraints

Los cuatro roles activos con sesión vigente administran únicamente su colección. Una entrada por dueño+juego persistido RAWG/manual. Estado opcional wishlist/playing/completed/backlog; favorito e interés independientes; progreso opcional entero0–100. Guardar sin marcas permite una entrada sin clasificar. Cambiar un campo no fuerza cambios en otros. Retirar quita la entrada; añadir después crea una identidad nueva.

Biblioteca privada por defecto, pública solo por elección explícita; dueño activo conserva acceso privado. Tercero/moderador/admin no acceden a bibliotecas privadas por URL, IDs, conteos, joins ni DataAPI. Suspensión oculta colección pública e impide acceso propio/escritura; sesión revocada no concede acceso propio. Preferencias y correo nunca se hacen públicos. Perfil básico usa alias/bio/avatar existentes y reseñas públicas paginadas; no inventar reputación, insignias ni estadísticas.

Servidor valida sesión, estado, propiedad, juego y versiones. Evitar duplicados y sobrescritura por dos pestañas, incluso tras retirar/añadir. Un formulario antiguo de preferencias nunca vuelve a publicar la biblioteca. Recuperación de conflicto/ACK incierto consulta estado y conserva borrador; no repite escrituras a ciegas. Biblioteca permite buscar/añadir juegos ya persistidos, indicando ese alcance; listado sin llamadas RAWG por tarjeta. Sin recomendaciones, seguidores, exportación/baja, publicación remota ni cierre de G3/G4 en esta historia.

## I/O & Edge-Case Matrix

| Dado | Cuando | Entonces |
|---|---|---|
| Cuenta activa y juego persistido | guarda/cambia marcas | entrada única, campos exactos visibles en otra sesión |
| Colección privada | tercero/anon/mod/admin consultan directamente | ninguna entrada privada ni preferencias |
| Elección explícita pública, luego privada | otra sesión consulta después de cada confirmación | visible primero; nuevas lecturas denegadas después |
| Versiones concurrentes o entrada retirada/añadida | pestaña antigua escribe |409 sin sobrescribir; borrador conservado |
| Sesión revocada, suspensión o identidad/campos falsificados | intenta operar |401/403/400 sin mutación |
| ACK perdido o error | intenta recuperar | consulta propia determina estado sin duplicar |
| Preferencias antiguas y privacidad cambiada | guarda formulario viejo | no modifica visibilidad actual |
| Alias con mayúsculas/guion bajo y juego RAWG/manual | abre perfil/biblioteca | igualdad exacta normalizada, metadatos y rutas correctos |

</frozen-after-approval>

## Code Map

Identidad: `20261031235359_identity.sql` mantiene privacidad canónica en private_user_settings, authz, sesiones y lock718007013. OnboardingPage/auth.ts actualmente envían library_visibility en cada guardado: separar ese cambio, revocar UPDATE directo de la columna y usar versión exclusiva de privacidad. Mantener preferencias restantes.

games.document/manual_games: fuentes reales, joins sin N+1. Profiles.username_normalized: igualdad, no ILIKE. Reutilizar AuthContext/StatePanel/deadlines; conservar reseñas/votos/demo5173.

## Tasks & Acceptance

- [x] `supabase/migrations/*_library.sql`: generar con CLI. Entradas UUID, dueño/FKs XOR, unicidad, checks, versión/fechas/índices; RLS dueño activo o colección pública activa, sin writes API incluido service_role. Vista pública del catálogo persistido security_invoker para buscador. Predicado privado booleano: justificar definer por lookup inaccesible al lector, search_path fijo/grants mínimos; nunca preferencias. Operaciones invoker con sesión/autoridad bloqueadas, conflictos ID+versión y privacidad canónica versionada.
- [x] `supabase/functions/library/index.ts, supabase/functions/_shared/library.ts y supabase/config.toml`: Pasarela JWTfalse/verificación interna online; sesión, propietario derivado, campos exactos/body4KB, deadline10s/query8s/cancelación; consultar/crear/actualizar/retirar/privacidad.401/403/400/409/503 saneados; recuperar ACK consultando.
- [x] `src/services/library.ts y src/domain/models.ts`: DTO/contratos validados;20 entradas/página, orden estable/total real, filtros estado/favorito/interés antes de paginar, joins de metadatos y búsqueda paginada de juegos persistidos; perfil/reseñas públicas10/página.
- [x] `src/features/library/LibraryAction.tsx, src/features/library/LibraryPage.tsx, src/features/profiles/ProfilePage.tsx, src/app/App.tsx, src/features/auth/AccountControl.tsx, src/features/catalog/GameDetailPage.tsx y src/features/catalog/ManualGameDetailPage.tsx`: controles/rutas /library, /u/:handle, /u/:handle/library; estados accesibles, privacidad explícita, borradores actor+juego. Curados no persistidos no son guardables.
- [x] `src/features/onboarding/OnboardingPage.tsx y src/services/auth.ts`: privacidad solo mediante control versionado; excluirla del payload ordinario y enlazar biblioteca. Preservar onboarding/tema; actualizar contratos/pruebas existentes.
- [x] `supabase/tests/library.test.sql, supabase/tests/library-runtime.test.ts, tests/unit/library.test.ts, tests/integration/library-live.test.ts, tests/integration/library-ui.test.tsx, tests/e2e/library.spec.ts, scripts/local-library-tests.mjs, scripts/test-library-db.mjs y .github/workflows/ci.yml`: matriz SQL/HTTP/UI, carreras y sesiones/suspensión concurrentes, RLS/joins, cuatro roles, ambos catálogos/dos sesiones. Limpiar fixtures por IDs exactos; teclado/axe; CI aislado etiquetado.
- [x] `qa-reports/G4-LIBRARY.md, docs/plans/G4.md, BACKLOG.md, docs/REQUIREMENTS.md y docs/PROGRESS.md`: check/SQL/Deno/HTTP/E2E, regresionesG1/manual/reseñas/votos y tres revisiones BMAD; incidencias y límites. Verified solo tras evidencia.


## Design Notes

Solo migración/datos locales; sin reset, despliegue ni cargos. Nueva identidad al reañadir evita ABA. No revocar copias descargadas legítimamente. CLI2.122.0, runtime oneshot, pruebas secuenciales.

## Verification

Cada fila exige test PASS. E2E: añadir desde ficha manual y buscador persistido RAWG/manual, editar y compartir entre sesiones; Auth/Edge/DB locales reales. RAWG actual no acreditado. G3/G4 abiertos.

## Implementation Notes

Aprobación humana2026-11-06: «Aprobar y continuar implementando». Deno=/tmp/gamehive-deno/deno; DENO_DIR=/tmp/gamehive-deno-cache. Stack propio gamehive y runtime oneshot activos. Coordinar con el agente principal aplicación de migración/reinicio de functions serve; no resetear. Demo fija5173 independiente de dist;4173 reservado a suites secuenciales. El agente principal conserva y prueba infraestructura; el implementador avisa antes de usar dist/4173.

## Spec Change Log

## Review Triage Log


### Ronda1 —2026-11-07

Veredictos individuales antes de agrupar. Tres capas recibidas completas; diff154715bytes, mínimo blind10. No hay intent_gap/bad_spec: sobreviven correcciones internas y pruebas de estados ya demostrados, sin superficie pública nueva.

| ID | Veredicto | Evidencia y decisión individual |
|---|---|---|
| BL01 | medium | LibraryPage profileeffect solo depende api/handle; Reintentar cambia revision y no reintenta resolución fallida de alias. Corrección directa de dependencia existente. |
| BL02 | medium | Listado acepta total20/items[] mientras page2 permanece2 tras retirar último elemento; ninguna corrección del rango. Se muestran cero resultados de página aunque hay20anteriores. |
| BL03 | medium | Buscador y listado montan Action independientes para mismo actor+juego; write borra Mapcompartido y own consulta eseMap para decidir conservar estado. Tras guardar A, B puede perder borrador al consultar después de409. |
| BL04 | low | Falta acción dedicada de descartar, pero recuperación muestra todas las marcas guardadas y permite reconciliar; también es posible abandonar sin escribir. Es conveniencia acotada a conflictos, no obliga a sobrescribir datos. Rechazado: encuentro infrecuente en uso guiado y arreglo añade nueva acción/comportamiento, no corrección directa. |
| BL05 | low | Recarga completa borra formularios no guardados en Map. Recuperación guiada dispone de Consultar sin recarga y preserva borrador. Persistencia entre recargas exige nueva retención/serialización/limpieza; rechazado por impacto acotado y complejidad para un caso fuera del recorrido guiado cotidiano. |
| BL06 | false | Map indexado por UUIDactor+juego; otro usuario no recibe marcas ajenas. Volver a entrar como la misma cuenta recupera su propio borrador; no se demuestra daño ni acceso cruzado al cerrar sesión. No hay contrato de vencimiento de borradores que se esté incumpliendo. |
| BL07 | medium | list.then limpia error compartido; si settings falla antes y listado termina después, desaparece el error y queda Consultando sin causa. Mover reinicio al inicio de intento conjunto conserva cualquier fallo posterior. |
| BL08 | false | reviews consulta tabla PostgreSQL tipada, sin jsondocument ni agregadosnullable: PK, FKsXOR, rating/título/textosNOTNULL+checks y filas serializadas por PostgREST. El consumidor usa campos garantizados por esas constraints. [null] no es respuesta alcanzable de ese query en backend actual; inyectar respuesta arbitraria no demuestra el fallo alegado. |
| BL09 | medium | Tests de servicio solo verifican parámetros con arrays vacíos; falta prueba de límites efectivos con>20entradas y>10reseñas persistidas. Brecha real en consumidores paginados, corregible mediante fixtures acotados y pruebas. |
| BL10 | medium | E2E pierde ACK solo en updateentrada; no hay fallo privacy que compruebe privacyUnknown/controles deshabilitados/versiónrecuperada sin repetir mutación. Brecha confirmada leyendo UI/HTTP/E2E. |
| EC01 | medium | Misma pérdida de borrador que BL03: cada instancia conserva estado propio pero una confirmación borra Map compartido y segunda consulta reemplaza marcas. |
| EC02 | medium | Misma página fuera de rango que BL02; callback solo incrementa revision y listado mantiene page2 tras reducir total a20. |
| EC03 | false | Mismo reclamo de DTOmalformado BL08; tabla reviews y serialización DataAPI precluyen elementosnull y tipos inválidos de los campos renderizados. Error HTTP/JSON inválido sí termina en catch/StatePanel. No hay origen alcanzable demostrado para [null]. |
| VG01 | medium | Brecha pre-verificada de consumidorperfil: once reseñas y navegación página2 no se ejercitan; actual E2E soloalias/enlace y unit devuelve[]. Mantener disposiciónpatch. |
| VG02 | medium | Brecha pre-verificada: runtime test llama helper, nuncahandler; sustituir readManualBody por request.json dejaría verdes pruebas. Añadir HTTP autenticado>4096bytes y comprobar rechazo sin mutación. |
| VG03 | medium | Brecha pre-verificada: race varía interested, pero no afirma valortrue del ganador; navegador no activa Me interesa. Añadir true→false determinista con independencia de otrasmarcas. |

Agrupación y rutas, después de todos los veredictos:

- P1patch BL01: reintento de perfil por dependencia existente.
- P2patch BL02+EC02: ajustar página al total confirmado tras retirada; prueba de último elemento de página2.
- P3patch BL03+EC01: borrador sucio propio de cada editor no depende de borrado ajeno del Map; comprobar dos editores y consulta tras conflicto.
- P4patch BL07: limpiar error al iniciar intento conjunto, no al terminar una lectura exitosa; cubrir orden de fallos.
- P5patch BL09+VG01: verificar resultados persistidos multipágina, filtros/conteos y consumidorperfil con once reseñas y enlaces correctos.
- P6patch BL10: pérdida de ACKprivacy tras commit y recuperación de versión sin repetirPOST.
- P7patch VG02: límite real del handler HTTP, estado no mutado.
- P8patch VG03: interéstrue→false persistido con otras marcas intactas.

BL04/BL05 rechazadoslow; BL06/BL08/EC03 rechazadosfalse con refutaciones anteriores. Sin entradasdefer. Todos los arreglos retienen intención y contratos aprobados.

Auditoría del coordinador2026-11-07: seis tareas de implementación comprobadas, ocho filas de matriz cubiertas por pruebas ejecutadasPASS. Documentación de revisión final se cierra en el paso4; no se anticipa verified. Ver qa-reports/G4-LIBRARY.md.


Cierre2026-11-07: ocho grupospatch corregidos por el mismo implementador. P4 usa errores independientes y limpia solo el propio en callbacks asíncronos;10UI cubren ambos órdenes de fallo. VG01 detectó además el embed ambiguo profiles: desambiguación directa profiles!author_id, perfil11reseñasPASS. Verificación final coordinador:check257/7omitidas,SQL418,Deno7,runtime4suites, biblioteca2HTTP+2E2Ereal y2+2CIaislada, regresionesG1/manual/reseñas/críticas/votos, db lint/advisors y limpiezaPASS. Todos los tasks y ocho filas auditados; ningún cambio a la intención congelada. Sin diferidos de revisión ni despliegues.
