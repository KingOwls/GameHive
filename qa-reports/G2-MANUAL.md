# GH-018 — Catálogo manual independiente

Fecha: 2026-11-01. Implementación local de la historia aprobada `spec-gh-018-catalogo-manual.md`. No hay nuevas operaciones remotas ni despliegue Vercel en esta historia.

## Alcance implementado

`public.manual_games` tiene SELECT público con RLS y ninguna escritura Data API (incluido `service_role`). La función privada `SECURITY INVOKER` exige sesión existente bloqueada y admin activo bajo advisory lock 718007013 compartido con G1. Fuente canónica UNIQUE; alta y auditoría privada son una transacción. Auditoría usa `target_id=NULL`, `gameId=manual:UUID`; motivo y actor no forman parte del documento público.

El endpoint `admin-games` verifica token mediante Auth antes de leer session_id. No toma actor/rol del body como autoridad. Valida y acota texto plano, fecha calendario, plataformas, géneros y URL HTTPS pública, sin consultar ninguna URL aportada. Repite límites y validación en DB; errores HTTP saneados 400/401/403/409/503. Timeout de Auth/cuerpo y statement_timeout DB; cuerpo máximo 20 KB. No cambia handlers G1, `public.games`, caché ni presupuesto RAWG.

Rutas `/admin/games`, `/manual-games`, `/manual-games/:id` con identidad `manual:UUID`. Consulta pública paginada de 12 y búsqueda por título, sin mezclar proveedores/totales; enlaces de ida/vuelta con Explorar. Estados loading/empty/error/success y reintento, ficha sin imágenes ni ratings inventados, fuente enlazada y fecha opcional. Formulario vuelve a comprobar identidad vigente; servidor decide. Estado de consulta y formulario se reinicia al cambiar ruta/sesión para evitar mostrar datos anteriores.

## Pruebas ejecutadas por implementación

- Migración creada por `supabase migration new manual_games` y aplicada únicamente localmente con `supabase migration up --local`. Refinamiento de función privada con `CREATE OR REPLACE` vía CLI, mismo contenido que migración, sin reiniciar stack.
- `npm run check`: lint + tipos + 132 Vitest PASS, 2 suites reales omitidas deliberadamente en entorno aislado + build PASS. 22 pruebas unitarias nuevas (URL, HTML, límites, fecha, configuración, identidad, cancelación/paginación) y 9 UI nuevas (lectura/empty/error/reintento/ficha/guardias).
- `npm run test:sql`: 178 PASS, de ellas 44 nuevas; conserva 134 G1/RAWG. Cuatro roles, permisos API, fuente canónica, HTML, suspensión/revocación, duplicado y rollback por fallo inyectado de auditoría. Todas las fixtures adversariales SQL se revierten mediante rollback.
- Deno `check --frozen` de los cuatro handlers PASS.
- `test:manual` y CI incorporan el helper HTTP/navegador local real, que requiere runtime local ya disponible; evidencia de coordinación se añade abajo cuando concluye. Las pruebas aisladas anteriores no certifican funcionamiento remoto.

## Incidentes resueltos y límites

1. Primera corrida de check dentro del sandbox falló en cuatro pruebas RAWG preexistentes por `spawnSync Node EPERM`; corrida autorizada fuera del sandbox pasó, sin cambiar esas pruebas.
2. La primera repetición SQL coincidió con alta real Celeste del test HTTP y detectó que la fixture SQL con fragmento utilizaba la misma fuente canónica. Se aisló la fixture adversarial con path propio y los recuentos con título/actor de prueba; repetición 178 PASS. No se relajó UNIQUE.
3. CLI db query no admite varias sentencias preparadas en un archivo: se aplicó exclusivamente CREATE OR REPLACE en una sentencia y se revalidó SQL.
4. Build muestra advertencia de bundle ~518 KB (~150 KB gzip); optimización general pendiente G6.

La fuente oficial real de la fixture de navegador es [Celeste](https://www.celestegame.com/), verificada por el coordinador; sinopsis propia y fecha opcional sin inventar. Metadatos de pruebas adversariales se identifican como fixtures aisladas. No edición/borrado público ni imágenes manuales; quedan fuera de GH-018. Publicación manual remota requiere autorización específica posterior. Cierre sujeto a verificación HTTP/E2E y revisión BMAD independiente de tres capas por coordinador.

## Verificación real coordinada

El coordinador ejecutó `node scripts/local-manual-tests.mjs --e2e`: 1 HTTP real PASS (cuatro roles, concurrencia dos solicitudes →201/409, una alta/auditoría, lectura pública sin actor/motivo, CRUD Data API denegado, admin suspendido403/revocado401 y documento RAWG idéntico) +1 E2E PASS (admin→alta Celeste→visitante→búsqueda→recarga→guardia anon+axe). Limpieza exacta de las fixtures en finally comprobada por el coordinador. Son pruebas contra stack local real, sin mocks y sin operar remoto.

El primer intento HTTP esperaba403 después del logout; Auth rechazó correctamente con401 antes de DB. Se corrigió únicamente la expectativa a401, conforme a la matriz aprobada401/403, y el helper completo pasó. La revisión independiente BMAD de tres capas permanece pendiente al entregar la implementación.

Matriz auditada: se añadió y ejecutó fallo inyectado de auditoría por actor local; endpoint respondió503 saneado, sin alta parcial. Trigger/función aislados eliminados en finally. Revalidación independiente del coordinador:check132/2omitidas,SQL178,Deno4handlers y E2Eaislados5/3omitidos pasaron.

## Correcciones focalizadas de revisión — 2026-11-01

- Repetir la misma búsqueda incrementa attempt y completa una nueva consulta. Guardia/formulario se reinicia por ID de usuario; un refresh de token de la misma cuenta conserva el borrador. Plataformas/géneros se validan antes de HTTP con mensajes nativos de los controles existentes.
- Un deadline compartido de 10s cubre Auth, lectura del cuerpo, cola del pool y consulta. Una promesa/listener de aborto por petición; cancelación y liberación del reader en cierre. `Query.cancel()` de postgresjs3.4.5, verificado en código de la versión fijada, retira consultas en cola o cancela activas. Timeout mantiene503 saneado y orientación a comprobar la fuente ante ACK incierto, también en cliente.
- Índice local/migración alineados con ORDER BY title,id. No se afirma que ese índice acelere ILIKE con comodín inicial.
- Fixtures oficiales con query única `?gamehive_fixture=...`; query preservada por contrato. Limpieza espera advisory lock y recupera juegos exclusivamente de auditorías de actores fixture antes de borrar auditorías/cuentas, incluso sin recordar ID de respuesta. HTTP ejercita explícitamente limpieza con lista de IDs vacía. No borra altas ajenas.
- SQL negativos usan fuente distinta y SQLSTATE exacto; no pueden pasar por UNIQUE si se elimina validación de géneros. Nuevo test DB concurrente comprueba democión/suspensión bajo advisory lock y borrado de sesión bajo bloqueo de fila:42501, sin juego/auditoría. Cero RAWG.
- E2E envía búsqueda sin coincidencia, verifica empty/exclusión Celeste y luego lo restaura; comprueba sinopsis, plataformas, géneros y fecha ausente tras recarga. UI cubre metadatos y ramas fecha válida/ausente con fixtures aisladas.

Solo se ejecutó verificación focalizada:40 Vitest manuales PASS,45 SQL manuales PASS,3 Deno runtime/DB PASS,1HTTP manual real PASS y1E2E manual real PASS sobre Vite dev temporal (sin build global), ESLint de archivos editados y Deno frozen del handler/test editados PASS. Helper nuevo `npm run test:manual:db` mantiene estado/credenciales CLI en memoria y reduce fallos a mensajes saneados; CI usa explícitamente GH_DENO_BIN con el runtime fijado. Verificación global posterior a cargo del coordinador; sin publicación remota.

## Cierre de revisión y revalidación independiente

Tres capas BMAD completadas; cada hallazgo tiene dictamen en la historia. Se aplicaron los parches aceptados y se rechazó el supuesto bypass de canonicalización: el único caller Edge normaliza URL antes de SQL y los roles API no pueden invocar la función privada. No se modificó el bloque de intención aprobado.

Verificación final del coordinador: `npm run check` (lint, tipos, 141 Vitest pasadas y 2 pruebas reales omitidas en ese entorno, build); `npm run test:sql` (178, de ellas 44 manuales); `npm run test:manual:db` (3 Deno con DB real, sin RAWG); Deno frozen de cuatro handlers y test; E2E aislados (5 pasadas, 3 casos reales ejecutados aparte). `npm run test:manual -- --e2e` pasó 1 HTTP real y 1 E2E real sobre build final; regresión G1 HTTP y E2E Auth pasó por separado. Consulta posterior de residuos locales: juegos/cuentas/triggers/tablas de prueba = 0/0/0/0. El assert textual del índice se retiró: no representa una prueba de comportamiento; los casos SQL ejercitan permisos, integridad y errores reales.

La primera verificación global posterior a los parches detectó TS2322 en el mapa de errores opcionales; se corrigió su tipo y la siguiente pasada global pasó. El refinamiento de cleanup concurrente detectó TS7006 en su callback Deno; se tipó y tanto frozen como las tres pruebas Deno/DB pasaron. No se relajaron asserts funcionales. Advertencia de bundle ~519 KB (~151 KB gzip) pendiente de rendimiento G6.

GH-018 verificado localmente; migración/función administrativa remotas todavía requieren publicación autorizada. No se declara el producto completo ni G3–G6 verificados.

Regresión final RAWG real contra GameHive Next:1E2E pasó sobre el build final de GH-018. db lint local: sin errores/avisos.


## Publicación posterior

Alta manual publicada y pruebas remotas/limpieza verificadas; ver [G2-REMOTE](G2-REMOTE.md), incluyendo incidencias de fixtures, corrección accesible del logo y advertencia Auth pendiente. No implica completar G3–G6.
