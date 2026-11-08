# GH027–028 — biblioteca y privacidad

Fecha:2026-11-07. Estado:verified local, alcance GH027–028. Especificación aprobada: `_bmad-output/implementation-artifacts/spec-gh-027-biblioteca-privada.md`. No certifica G3/G4 completos ni RAWG actual.

Implementación: entradas con UUID/FKs XOR/unicidad/constraints/versión; RLS dueño activo o biblioteca pública de cuenta activa. Predicado privado definer estrecho justificado por lookup de preferencias/autoridad inaccesibles al lector; retorna booleano sin PII, search_path fijo y grants mínimos. Mutaciones invoker privadas con bloqueo de autoridad/sesión. Sin writes DataAPI incluso service_role. Privacidad canónica versionada y revocación de UPDATE directo. Pasarela online JWTfalse con sesión derivada, body4KiB/deadline10s/query8s/cancelación. Listados20, reseñas10, conteos exactos/filtros previos/paginación estable; joins sin RAWG por tarjeta. Rutas y controles reales, catálogo persistido con alcance explícito. Perfil básico sin reputación/insignias/estadísticas inventadas.

## Verificación ejecutada

- Migración creada con CLI2.122.0 y aplicada localmente por coordinador sin reset. Permisos: anon/authenticated/service_role no actualizan visibilidad; user_library RLS y vista security_invoker confirmados por coordinador. Advisors seguridad sin avisos según coordinador.
- `npm run test:sql`:418PASS,47casos nuevos de biblioteca; incluye los cuatro roles, privado/público, privilegios directos, retirada/reañadido, CAS nulo y suspensión/revocación.
- `GH_DENO_BIN=/tmp/gamehive-deno/deno DENO_DIR=/tmp/gamehive-deno-cache npm run test:library:db`:PASS cuerpo4KiB/cancelación, carrera de dos sesiones y bloqueo concurrente de suspensión/revocación sobre DB real. Limpieza por UUID exactos.
- Deno check frozen del nuevo handler y runtime:PASS.
- Vitest dirigido biblioteca:10PASS (5contratos/5UI). `npm run check` final:lint/typecheck/251VitestPASS+6omitidos/buildPASS; log `/tmp/gamehive-library-check.log`.

## Hallazgos corregidos durante implementación

Inspección del coordinador detectó antes de aplicar SQL la comparación CAS con NULL: ahora requiere identidad y versión tipadas/no-null y compara IS DISTINCT FROM; negativos SQL/HTTP cubren el caso. Inspección UI detectó remount de borrador sobre versión nueva: ahora conserva base, bloquea escritura, muestra estado consultado y exige reconciliación explícita; prueba UI PASS. Inspección detectó GETprivacidad antiguo tras POSTconfirmado: se descarta con generación de lectura/mutación y prueba deferredPASS. Listado padre se recarga tras guardar/retirar. Estos fueron hallazgos por inspección, no incidentes productivos.

Primer SQL test falló porque el rol anon heredaba claims del dueño usados por la matriz; fixture corrigió claims vacíos y suite pasó. Primer HTTP falló por DELETE sin filtro, rechazado400 por DataAPI antes del permiso; se filtra propietario para probar la denegación real. Segundo HTTP falló por buscar fixture sin filtro en primera página20 de un catálogo mayor; se busca su ID exacto. Primer runtime tenía error sintáctico en el test, corregido antes de PASS. No se cambiaron expectativas para tolerar mutaciones.

## Pendiente y límites

Regresiones y tres revisiones completadas; cierre final y resultados vigentes al final de este informe. G1HTTP/E2E ya revalidado:1HTTP+1E2EPASS,1E2E sin configuración omitido; log `/tmp/gamehive-library-auth-regression.log`. CI incluye runtime y HTTP/E2E de biblioteca con fixture de catálogo explícitamente aislado; ese modo no acredita upstream RAWG. Ningún reset, cargo, publicación remota, cambio al repositorio de referencia o cierre de G3/G4.

## Reanudación y verificaciones del2026-11-07

Último E2E antes de interrupción: FAIL a12.8s en axe `landmark-unique` por dos navegaciones con el mismo nombre. Los controles de paginación ahora tienen nombres distintos para biblioteca/catálogo/reseñas. El intento posterior fue rechazado antes de ejecutarse porque la revisión automática alcanzó su límite de uso; no fue un rechazo por riesgo. Tras reanudar, el primer helper detectó runtime ausente y salió antes de crear fixtures; coordinador restauró functions serve sin reset.

Prueba deferred adicional reprodujo realmente GETsettings iniciado DURANTE POSTprivacy y resuelto después de confirmación: FAIL antes de invalidar generación también al confirmar/fallar la mutación,5UI PASS después. La suite global inicial detectó2fallos de catálogo por AuthContext ausente tras integrar biblioteca: tests aislados de catálogo ahora declaran sesión anónima;4fallos del verificador RAWG fueron EPERM del sandbox al crear subproceso, requieren ejecución autorizada. No se afirma PASS global por ese intento.

Logs saneados de verificación actual: `/tmp/gamehive-library-check.log` y `/tmp/gamehive-library-live-e2e.log`. El primero contiene la revalidación final PASS; el segundo conserva el fallo previo de edición para trazabilidad. El runtime tiene log privado separado del coordinador; no se comparte por contener configuración sensible.

## Resultados finales del implementador

- HTTP real biblioteca:1PASS, ambos catálogos, cuatro roles, CAS/ABA, IDs/versionesnull, preferencias antiguas, RLS/joins, sesión revocada y suspensión. Log `/tmp/gamehive-library-live-e2e.log` (HTTPPASS seguido del E2Efallido previo a corrección de payload).
- E2E real actualizado:1PASS18.7s. Guarda desde ficha manual, edita desde segunda sesión, conserva borrador ante409, simula ACK perdido tras commit y consulta sin repetir escritura, publica/privatiza y comprueba tercero, añade RAWG y retira/reañade manual desde buscador disponible, verifica filtros, perfil por alias, teclado y axe0. Log final `/tmp/gamehive-library-e2e-final.log`.
- Durante esa ampliación, la edición real reveló un defecto del servicio: propagaba campos completos de entry dentro de marks y SQL rechazaba400 por campos extras. Corrección: whitelist expresa de las cuatro marcas al construir payload. Regresión unitaria verifica las siete claves válidas de actualización, y E2E finalPASS acredita edición real.
- Prueba de contrato comprueba paginación20 de biblioteca/catálogo,10 de reseñas públicas, orden estable, conteoexacto y filtros antes del rango. No se describe como un ensayo de perfil con11reseñas reales.
- Advertencia de build:bundle~566KB minificado/gzip163KB; no impide build, optimización de rendimiento sigue fuera de esta historia.

La limpieza de cada helper exitoso usa UUID exactos y comprueba ausencia de sus usuarios/reseñas/auditoría/juegos manuales y fixtureRAWG aislado. No se certifica disponibilidad actual del proveedor RAWG ni publicación remota.

- Vía CI aislada ejecutada localmente: `GH_REVIEWS_ISOLATED=1 npm run test:library -- --e2e`,1HTTP+1E2EPASS18.9s con Auth/Edge/DB reales y catálogo de contrato explícito. Log `/tmp/gamehive-library-ci-isolated.log`. Limpieza del helper finalizó sin errores.
- Entrega al coordinador: suites del implementador detenidas y4173/libre; build final corresponde al recorrido CIaislado. Ninguna modificación SQL posterior a su aplicación inicial.

## Revalidación del coordinador —2026-11-07

- SQL418PASS (7archivos); Deno frozen7handlersPASS; runtime/DBbiblioteca/manual/reseñas/votosPASS. Logs locales privados `/tmp/gamehive-g4-root-{sql,deno,library-db,manual-db,reviews-db,votes-db}.log`.
- Regresiones HTTP/E2E: manual1+1PASS, reseñas/críticas2+2PASS y votos1+1PASS con catálogo aislado explícito; G1implementador1+1PASS/1omitido. El recorrido aislado no acredita RAWG actual. Advisors local:sin issues.
- Manual E2E inicialmente falló al comprobar título mientras aún aparecía listado previo: se exige URL exacta y h1 del artículo cuya fuente coincide con la del alta propia. Repetición1HTTP+1E2EPASS4.5s; no se borraron registros legítimos homónimos.
- Inspección del perfil encontró límite de biografía contado como UTF16 frente a char_length de PostgreSQL. Corregido a caracteres Unicode; test acepta500emoji y rechaza501,6unitariosdirigidosPASS.
- Tras finalizar todas las suites, inspección de solo lectura detectó tres cuentas y un juego del grupo del test interrumpido2026-11-06. Se validaron UUIDs, alias/correo de fixture, fecha, ausencia de reseñas/biblioteca y auditoría manual_game.create del juego exacto antes de limpiar en transacción. Conteos posteriores:0perfilesfixture/0juegosmanualesfixture. No se borró auditoría anónima ni datos ajenos.

### Auditoría de matriz aprobada

| Fila | Evidencia PASS ejecutada |
|---|---|
| Marcas y dos sesiones | HTTPbiblioteca y navegadorreal/aislado, incluida edición desde segunda sesión. |
| Lectura privada contra terceros/anon/mod/admin | SQL418incluye47biblioteca; HTTPcuatro roles y joins. |
| Publicar/privatizar | Navegador comprueba0→1→0juegos desde visitante tras confirmaciones. |
| CAS y retirar/reañadir | SQL/HTTPABA y carrera200/409; UI y navegador conservan borrador y exigen reconciliación. |
| Sesión/estado/campos falsificados | SQL/HTTP y runtimeDB con espera concurrente y rechazo sin mutación. |
| ACK incierto | UI consulta sin repetir; navegador pierde respuesta después de commit y consulta progreso45. |
| Preferencias antiguas | Unitwhitelist; HTTPdeniega cambio directo y guardado ordinario conserva privacidad. |
| Alias y ambos catálogos | Igualdad normalizada unitaria y perfil por mayúsculas/guionbajo; fichamanual y buscadorRAWG/manual con rutas reales. |

Intención congelada idéntica al checkpoint aprobado. Revisión BMAD independiente pendiente; historia todavía no verified.


## Cierre verificado local —2026-11-07

Tres revisiones BMAD independientes (blind/edge/verification-gap) completas;16hallazgos individualmente valorados en la historia antes de agrupar:11medium en8correcciones/pruebas;2low y3false rechazados con evidencia. Sin diferidos de revisión. La advertencia de tamaño del bundle permanece para G6.

Correcciones finales: reintento real del perfil, ajuste de página tras retirar el último elemento, borrador sucio independiente de otro editor y errores por operación. Se cubren settingsfail→listsuccess y listfail→privacy200. La primera verificación global señaló resets síncronos de estado prohibidos por Reactlint: se eliminaron y cada callback asíncrono limpia solo su error; no se suprimió la regla. La nueva prueba de perfil detectó HTTP300 por relación profiles ambigua vía votos; se desambiguó profiles!author_id como en el servicio de reseñas existente, sin alterar RLS.

| Comprobación final del coordinador | Resultado |
|---|---|
| check:lint/tipos/Vitest/build | PASS;257pruebas/7omitidas que se ejecutan en sus suites locales; bundle~567KB/gzip163KB |
| E2E sin configuración/curado |5PASS/8omitidas por exigir backend |
| SQL/RLS |418PASS,7archivos |
| Deno frozen |7handlersPASS |
| Runtime/DB biblioteca/manual/reseñas/votos |4suitesPASS, carreras/sesiones/estado/cancelación |
| Auth, catálogo manual |1HTTP+1E2EPASS cada uno; caso sin configuración omitido solo en Authconectado |
| Reseñas/críticas |2HTTP+2E2EPASS, catálogo aislado explícito |
| Votos |1HTTP+1E2EPASS, catálogo aislado explícito |
| Biblioteca con catálogos persistidos |2HTTP+2E2EPASS,26.0s navegador |
| Biblioteca víaCIaislada |2HTTP+2E2EPASS,26.7s navegador |
| db lint/advisors local |sin errores/sin issues |

Las fixtures adicionales de paginación son aisladas y explícitas:24entradas/manuales y11reseñas creadas realmente en DB temporalmente. Se prueban páginas20+4, filtro21con20+1, interés11, metadatos/IDs sin duplicados, remoción/clamp, y perfil10+1 con títulos/textos/rutas y reemplazo real de página. No se presentan como juegos reales ni certificación de proveedor. El recorrido principal sí usa el manual con fuente y RAWG real ya persistido; ningún test acredita disponibilidad actual RAWG.

HTTP envía JSON válido con padding>4096bytes al handler real y recibe400 sin cambio; interéstrue→false se relee preservando otrasmarcas. E2E pierde ACKprivacy después de commit, comprueba estado incierto/controles bloqueados y consulta versión2 pública sin repetirPOST.

Logs finales locales600: `/tmp/gamehive-g4-final-*.log`. Conteos tras terminar:0perfilesfixture,0juegospaginación,0reseñasfixtureperfil,0manualesfixtureconfuente. El escáner de la clave privada RAWG en fuente/build pasó; primer intento de inventario desde subprocessNode encontróEPERM del sandbox y se repitió separando inventarioGit, sin exponer la clave. No se escanearon credenciales remotas.

Intención aprobada preservada. GH027–028verified local; G3/G4 completos abiertos. Sin reset, cargos, publicación Supabase/Vercel o cambios al repositorio de referencia. Este cierre certifica ejecución local; la CI remota se comprueba al subir la rama.

## Corrección de prueba en CI — 2026-11-07

El [run 42380474379](https://github.com/KingOwls/GameHive/actions/runs/42380474379) pasó foundation y todas las etapas de backend anteriores a biblioteca. Su E2E principal falló por selector ambiguo: en la base nueva, el juego manual aparecía tanto en resultados de búsqueda como en la biblioteca y ambos artículos tenían «Organizar este juego». El segundo E2E y las pruebas HTTP pasaron. No fue un defecto de persistencia ni de permisos.

El selector exige ahora el progreso31 de la entrada propia, además de su enlace exacto; no usa first/nth ni cambia la aplicación. Revalidación: navegador con catálogo persistido2PASS26.0s y aislado2PASS27.5s; check completo257PASS/7omitidas, lint/tipos/buildPASS. Logs privados `/tmp/gamehive-library-ci-selector-{real,isolated}.log` y `/tmp/gamehive-g4-ci-selector-check.log`. La nueva CI queda pendiente de ejecutarse tras subir esta corrección.

Auditoría de dependencias: npm audit informa10moderadas,0altas/0críticas, en herramientas de desarrollo; npm audit --omit=dev informa0vulnerabilidades. G4 no cambió versiones ni lockfile. La actualización compatible de herramientas y su revalidación se registra para G6; no se aplicaron actualizaciones forzadas.

CI posterior confirmada por coordinador2026-11-07: [42403298993](https://github.com/KingOwls/GameHive/actions/runs/42403298993) PASS, commit727bdb396a61f190e02087c4340d8b51d099e707, PR#6. Sustituye el pendiente de nuevaCI; conserva el fallo histórico [42380474379](https://github.com/KingOwls/GameHive/actions/runs/42380474379) y su corrección documentada.
