# G1 — evidencia local de identidad segura

Fecha: 2026-10-31. Historia GH-007–013; implementación independiente. No se realizaron operaciones remotas ni push desde el agente de implementación.

## Implementado

- CLI Supabase 2.122.0 generó config y migración `20261031235359_identity.sql`; `project_id` local minúsculo `gamehive`.
- Perfiles públicos sin email, preferencias privadas separadas, autoridad/auditoría en `private` no expuesto a Data API. RLS en las cuatro tablas; grants explícitos de columnas impiden cambio de dueño, reputación y autoridad.
- Trigger Auth: perfil/settings/rol user atómicos; alias ASCII 3–24, índice único sobre minúsculas. Metadata de rol/verificación ignorada. Avatar SVG propio y selección sin uploads.
- Edge `identity` y `admin-identity`: JWT validado online con Auth, sesión vigente en DB, rol/estado actuales, parámetros SQL, motivo/auditoría transaccional, errores saneados. Ningún RPC privilegiado en public. Primer admin solo por operador DB confiable. Autoedición de autoridad denegada.
- Formularios accesibles de registro/login y preferencias/perfil; sesión persistida por SDK, logout con confirmación y reintento. Contraseñas no persistidas por aplicación. Biblioteca/comunidad siguen fuera del alcance G1.

## Pruebas reales

- `npm run check`: lint, typecheck, 32 Vitest de G0 y build pasaron; la suite backend se omite en este comando cuando falta GH_RUN_LOCAL, no se contabiliza como verificación servidor.
- `npm run test:backend -- --e2e`: suite HTTP real pasó sin mocks; 5 E2E pasaron (fundación + Auth real), 1 omitido deliberadamente porque valida el entorno sin configuración. Dos contextos de navegador y dos sesiones reales, preferencias persistentes tras refrescar y desde segunda sesión, login erróneo sin sesión, logout.
- HTTP: cuatro roles almacenados, anon/tercero/critic/moderator/admin sin preferencias ajenas; mutación de autoridad/reputación/dueño y altas/bajas directas denegadas; metadata admin ignorada. Cuenta suspendida y admin degradado con tokens previos pierden permisos inmediatamente. Auditoría real de administración. Registro HTTP concurrente de alias equivalentes: un ganador y ningún usuario Auth huérfano.
- pgTAP: 43 assertions pasaron tras `supabase db reset --local` terminado sin errores (recreó base, aplicó migración y reinició contenedores). `supabase db lint --local`: sin errores de esquema. Advisors security repetidos después del reset: sin avisos.
- `supabase db advisors --local --type security --level warn`: sin avisos en primera ejecución.
- Axe sobre registro/perfil real y las rutas G0: sin violaciones en criterios automatizados consultados. No constituye auditoría manual completa.

## Defectos encontrados y corregidos

1. **Edge 503 / ENOTFOUND (alta, resuelto).** HTTP fallaba aunque Docker resolvía el host internamente. El driver npm postgres con compatibilidad Node en este runtime no resolvía la conexión. Cambiado a driver nativo Deno postgresjs fijado v3.4.5; retest HTTP/E2E pasó. `project_id` también normalizado a minúsculas. Sin IP fija ni desactivación de TLS. Referencia oficial: https://supabase.com/docs/guides/functions/connect-to-postgres.
2. **Log de CLI local con credenciales (media, mitigado).** Una lectura del final de un temporal de arranque mostró el bloque de credenciales locales generado por la CLI. No correspondía al remoto, no se guardó en Git ni se reproduce aquí. Temporal eliminado; helpers capturan status en memoria y solo pasan clave publicable a Vite. Traces/screenshots/vídeo de tests Auth desactivados para evitar capturar secretos. El stack se detiene al terminar las pruebas; no reutilizar credenciales locales como secretos remotos.
3. **Logout fallido ocultaba reintento (alta, resuelto).** SDK 2.118.0 elimina la sesión local incluso si la revocación falla por red. La UI perdía el botón antes de poder reintentar. Servicio ahora usa primero el mismo endpoint Auth de revocación con token propio y solo limpia estado local después del ACK servidor. E2E aborta la petición real de logout, comprueba reintento visible y recupera la red para cerrar. Retest: HTTP y 5 E2E pasaron.
4. **Puertos CLI publicados en todas las interfaces (media, limitación del entorno).** Docker reportó 0.0.0.0/IPv6 pese a configurar host_binding_ipv4=127.0.0.1 en la red del stack. No se cambió firewall/sistema. Se apaga el stack gamehive tras verificar. Para futuras pruebas, iniciar temporalmente en equipo/red controlados y apagar al terminar; no afirmar bind loopback sin comprobarlo.

## Límites y revisión

G1 permanece in_progress hasta revisión BMAD/humana y aplicación/verificación remotas por orquestador. El proyecto remoto nuevo está creado por el orquestador; configuración Auth y despliegue de funciones no fueron realizados por este agente. No reutilizar proyectos anteriores.

Decisión académica: confirmación email desactivada localmente; permite registrar correos no comprobados y aumenta suplantación/abuso. No habilitar un servicio público abierto con esta configuración. Supabase Auth conserva rate limits locales de CLI. Sin CAPTCHA de pago.

`SECURITY DEFINER` revisados: trigger privado inicializador y predicado privado booleano de dueño activo, ambos con search_path vacío, referencias calificadas y privilegios mínimos. Resto invoker, no callable por API. Auditoría append-only frente a clientes; el operador DB puede modificarla, no se afirma inmutabilidad absoluta.

## Cierre de verificación local

Después del reset limpio: 43 SQL, HTTP real y 5 E2E reales pasaron, incluidos fallo/reintento de logout y regresiones G0. El escenario sin configuración se comprueba aparte sobre build sin variables; el caso Auth real se omite allí por diseño. No se contabilizan omisiones como aceptación.

`npm run check` final: lint/tipos/32 Vitest/build pasaron (suite backend omitida solo allí y ejecutada explícitamente aparte). `npm run test:e2e` sobre build sin configuración: 5 pasaron y Auth real omitido; prueba de ausencia de configuración pasó. `git diff --check`: sin errores. Stack local gamehive detenido al finalizar.

## Revalidación del orquestador tras revisión

40 pruebas Vitest pasaron con lint/tipos/build (`npm run check`); backend separado pasó HTTP real y 1 E2E Auth ampliado. pgTAP 43 assertions, db lint y advisors de seguridad locales pasaron. Build sin variables + E2E: 5 pasaron; los casos excluidos por entorno se comprobaron en su suite correspondiente, sin contar omisiones como éxito. Deno check --frozen pasó en ambos entrypoints. Ver [correcciones de revisión](G1-REVIEW-FIXES.md) y [evidencia remota separada](G1-REMOTE.md). G1 sigue in_progress por configuración/verificación autenticada remota pendiente.

CI ampliada pasó en GitHub para `9388ce198bcb93c312df03c4c1f6d9d70894f5d7`: [41256220707](https://github.com/KingOwls/GameHive/actions/runs/41256220707). Jobs foundation e identity-backend exitosos, incluido teardown. PR borrador: https://github.com/KingOwls/GameHive/pull/1.
