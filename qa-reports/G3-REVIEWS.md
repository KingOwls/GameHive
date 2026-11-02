# GH-020–021 — reseñas propias locales

2026-11-01. Implementación local de la [historia aprobada](../_bmad-output/implementation-artifacts/spec-gh-020-resena-propia.md). GateG3 `in_progress`; este informe inicial no acredita revisión BMAD independiente, CI remota ni despliegue G3.

## Cambio

Una identidad por autor+juego persistido RAWG/manual, publicación/consulta propia/edición/retiro/republicación; versión optimista y fecha del servidor. Cambio de nota exige opinión pública distinta tras normalizar espacios (también internos y Unicode). Texto renderizado como texto, pros/contras acotados, spoilers cerrados por registro. Alias y avatar públicos sin correo.

Operación privada invoker, JWT online, sesión real bloqueada `FOR SHARE`, autoridad actual y lock718007013 coordinados conG1; solo usuarios activos escriben. Suspensión oculta reseñas mediante trigger invoker privado. Reseña moderada no puede restaurarse ni editarse por autor. Auditoría atómica con UUID de reseña en JSON y usuario en target, sin texto/correo/tokens. Roles Data API sin INSERT/UPDATE/DELETE ni EXECUTE privado.

## Evidencia ejecutada por implementador

- `npm run test:sql`: **248 PASS** (178 regresionesG1/G2 y70 reseñas). Cubre UNIQUE/XOR/FKs, estados, versiones, límites, cuatro roles, anon/service_role, suspensión/revocación, edición normalizada, bloqueo moderado y rollback de auditoría. Se añadió después una aserción BOM Unicode; coordinador debe ejecutar la versión final (249 esperadas).
- Pruebas focalizadas de servicio/dominio/UI y regresiones de fichas: **48 PASS** inicialmente; ampliación de recuperación de autoridad: **11 UI PASS**. Root ejecutó `npm run check`: **169 PASS/3 omitidas** antes del último ajuste de parseo de borradores/avatar y la ruta CI aislada; revalidación final pendiente del coordinador.
- `npm run test:reviews`: **1 HTTP real local PASS**; también pasó al invocarlo con `--e2e`. Dos altas concurrentes201/409, dos ediciones200/409, FK inexistente400, validación400, roles403, dueño/tercero aislados, retiro/republicación, suspensión y sesión eliminada, ocultación moderada y auditoría fallida503 sin fila parcial. Ambos juegos reales; fingerprint RAWG idéntico; limpieza por autor+auditoría comprobada.
- `npm run test:reviews -- --e2e`: **1 Playwright PASS (7.6s)** recorriendo manual y RAWG real persistido, dos sesiones del mismo autor y visitante, editar nota+texto,409, borrador después de refresh hasta carga explícita, retiro/republicación, persistencia, spoiler cerrado tras recarga, tecladoEnter y axe sin violaciones. Esto verifica reseñas sobre fichas reales; no repite el verificador de ocho juegos RAWG ni certifica remoto.
- `DENO_DIR=/tmp/gamehive-deno-cache GH_DENO_BIN=/tmp/gamehive-deno/deno npm run test:reviews:db`: **PASS**, dos pruebas Deno: cuerpo Unicode completo y límite manual20KB preservado; carreras reales DB contra cambio de rol, suspensión y borrado de sesión, sin escrituras/auditorías parciales.
- Coordinador ejecutó `deno check --frozen supabase/functions/reviews/index.ts`: PASS. La CI incluye este entrypoint, las carreras DB y vía de reseñas aislada sin clave RAWG.
- `GH_REVIEWS_ISOLATED=1 npm run test:reviews -- --e2e`: fase HTTP **PASS** con fixture catalogal explícita y limpieza; Playwright no inició porque preview4173 estaba ocupado por otra suite del coordinador. Esta colisión también cambió `dist` mientras se ejecutaba la suite offline; no acredita fallo del producto. Coordinador reconstruirá y repetirá secuencialmente ambas suites. La ruta aislada sustituye solo detalle de catálogo en navegador y no certifica proveedor RAWG.

## Hallazgos corregidos antes de revisión

- Clave React duplicada entre `details` y la sección nueva: retirada; regresión de ficha RAWG vuelve a pasar.
- Error inicial transitorio al consultar identidad dejaba editor sin reintento útil: botón reintenta autoridad y reseña completas, con prueba focalizadaPASS.
- Mensaje de rol mostraba lenguaje de implementación: cambiado por disponibilidad para cuentas de jugador/críticos.
- Borrador con nota temporalmente vacía serializabaNaN a null: restauración conserva el texto y recupera el control vacío, sin perder borrador.

- Prueba offline heredada esperaba dos placeholders «Sin evaluaciones»: actualizada para comprobar vacío de críticos y texto honesto de comunidad/ficha offline; ejecución final corresponde al coordinador.
- Últimas pruebas focalizadas tras avatar/parseo de borrador y caso de nota vacía: **51 PASS** (servicio/dominio/UI + regresiones de fichas). Lint y typecheck finalesPASS. Borrador de nota vacía comprobado tras remount; resultado503 exige comprobar propia antes de permitir reintento, con cobertura focalizada; bloque congelado comparado con copia aprobada: idéntico.

## Pendiente de cierre del coordinador

Tres revisiones BMAD independientes, resolver sus hallazgos y revalidar globalmente (check, SQL final, Deno frozen/DB, HTTP/E2E real e aislado, regresionesG1/G2). La normalizaciónBOM agregada al archivo de migración necesita sincronizarse en DB local antes del SQL final; no se ha desplegado a remoto.

No se habilitan críticas completas, votos, comentarios, biblioteca, reputación ni agregados. Cuenta real de reseñas y cálculo pendiente; no se presenta un score simulado. Bundle local ~530KiB sin gzip (~154KiB gzip): aviso de tamaño existente ampliado, pendiente de rendimientoG6. Publicación G3/Vercel requiere permiso posterior.


## Revalidación del coordinador antes de revisión

Check final171PASS/3omitidas; SQL249PASS tras sincronización local del normalizadorBOM; Deno frozen5handlersPASS; reviewsDB2 y regresión manualDB3PASS. E2E aislados5PASS/4omitidos. Reseñas reales HTTP1+E2E1PASS y víaCIaislada HTTP1+E2E1PASS en secuencia. RegresionesG1 y manualG2 HTTP/E2E1+1 cada unaPASS; RAWG real búsqueda→ficha→capturas→recarga1PASS. db lint sin errores. La expectativa RAWG heredada también se actualizó para comprobar vacío de críticos y cuenta real vacía de comunidad por separado, conforme al comportamiento aprobado; no se cambiaron reglas de negocio. Revisión BMAD pendiente.


## Cierre local después de tres revisiones BMAD

Blind Hunter10, Edge Hunter3, Verification Gap2 y dos comprobaciones del coordinador tienen dictamen individual en la historia. Se conservaron las decisiones explícitas de no rebasar borradores automáticamente y de mantener una lectura propia coherente bajo el lock existente; no se certifica rendimiento bajo carga alta. Los hallazgos aceptados se corrigieron: borrador tras retiro/republicación, edición durante petición, lectura/parseo de respuesta incierta y5xx, actualización de identidad/lista al comprobar, límites Unicode completos y paginación más allá de1000. Se agregó HTTP Unicode>20KB con readback exacto y navegador en límites120/10000/20000puntos. La restauración de borradores sincroniza la validez nativa; se descartó correctamente una sospecha de bloqueo tras carga porque el formulario se desmonta antes de cargar.

Revalidación final del coordinador: `npm run check`185PASS/3omitidas; `test:sql`249PASS; Deno frozen5handlersPASS; reviewsDB2PASS y manualDB3PASS. E2E aislados5PASS/4omitidos; reseñas reales HTTP1+E2E1PASS, CIaislado HTTP1+E2E1PASS; regresionesAuth y manual HTTP1+E2E1cadaunaPASS; RAWGreal búsqueda→ficha→capturas→recarga1PASS. db lint sin errores sobre esquema final. Pruebas de navegador/build ejecutadas secuencialmente.

Limpieza final:0usuarios,0reseñas,0manuales,0fixturesRAWG,0triggers de fallo. Clave privada RAWG ausente de archivos versionados y dist; bloque de intención aprobado idéntico. GH-020–021 verified **localmente**. G3 sigue abierto por críticas, solicitudes, votos, comentarios y agregados; ninguna función de esta historia publicada en remoto. Bundle~530KB/~154KB gzip: optimizaciónG6 pendiente.


## CI y demo funcional de GH-020–021

Commitb763cb0894b4d93d470ffd9f89a9c97c9160a6fb publicado en PR#4. CI [41361924943](https://github.com/KingOwls/GameHive/actions/runs/41361924943) SUCCESS en foundation e identity-backend, incluidas reseñas HTTP/E2E locales con contrato de catálogo aislado explícito.

Demo local de esta sesión en http://127.0.0.1:5173/, build verificado conservado en /tmp/gamehive-demo-b763cb0 para aislarlo de la implementación siguiente. Backend local; el registro crea cuentas locales. Esta dirección no es un despliegue público Vercel.

Historia comprobada: búsqueda Hollow Knight→catalog Edge→ficha RAWG persistida y Data API de reseñas→renderizado. Servidor informó VITE8.3.5 ready149ms; APIs catalog/reviews200 observadas en navegador, título/fuente correctos,0pageerror y axe completo0. Captura visual pública temporal revisada; ficha y estados sin desbordamiento. Flujo autenticado de publicación/otra sesión/edición/retiro ya comprobado por E2E real, no inferido de captura. Reinicio de servidor sobre copia estable conserva el recorrido. No se añadieron secretos ni se publicaron funcionesG3.
