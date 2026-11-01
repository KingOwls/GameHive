# G2 — catálogo en GameHive Next

2026-11-01, America/Bogota. Destino único autorizado: krfodhagjzovsebghekm. El humano aprobó aplicar dos migraciones, guardar RAWG_API_KEY como secreto servidor y desplegar catalog con verify_jwt=false para lectura pública. No hubo cambios en proyectos anteriores ni Vercel.

## Publicación comprobada

Se inspeccionaron las cuatro tablas G1 existentes antes del DDL. Aplicadas catalog_rawg y catalog_cache_key_bound; las siete tablas públicas/privadas resultantes tienen RLS. Catalog ACTIVE versión1. Se cargaron únicamente index y tres módulos de catálogo; handlers de identidad intactos. Clave leída desde archivo servidor ignorado de modo600 y enviada por --env-file; sin valor en argumentos/logs/repositorio.

El conector generó versiones20261101132128 y20261101132150. Huellas de sus fuentes coincidieron con archivos CLI (ffb15f8d7e410dd94942321fb4640893 y0c0fc4a41f4eedf1c57e3849ede8949f). Se alinearon solo las versiones de historia a20261101114156 y20261101120540 mediante transacción condicionada por versión/nombre/fuente y ausencia de colisión. Consulta posterior confirmó identity20261031235359, catalog_rawg20261101114156 y catalog_cache_key_bound20261101120540. Sin repetir DDL.

## Pruebas reales remotas — PASS

Taxonomías, búsqueda Hollow Knight, ficha9767 y hasta tres capturas respondieron200. Se comprobó título, descripción, portada media.rawg.io, rating externo escala5, cuatro plataformas padre permitidas, fuente y descripción persistida en public.games. La función permite lectura anónima pública incluso sin cabecera apikey, según diseño autorizado. Entradas key prohibido, plataforma móvil4 y ruta arbitraria respondieron400. Clave RAWG ausente en respuestas. Escritura Data API rechazada y caché privada inaccesible.

Después del recorrido hubo6reservas y6entradas de caché,12juegos obtenidos del proveedor. Repetir detalle devolvió200 y el contador permaneció6. Los roles anon/authenticated/service_role tienen INSERT=false sobre public.games; roles de aplicación se probaron también localmente con JWT/RLS. No se crearon cuentas remotas adicionales para catálogo.

Build con URL/clave publicable remotas y modo RAWG explícito; `GH_RUN_RAWG=1 npx playwright test tests/e2e/catalog-live.spec.ts --reporter=list`:1pasada contra destino remoto, sin mocks. Búsqueda→Hollow Knight→ficha completa→requisitos/capturas→recarga, fuente/rating/muestra y axe. La prueba local con RAWG real también pasó; evidencia separada en G2-RAWG.

Advisors security:0WARN/ERROR;4INFO por RLS sin políticas en tablas privadas. Default-deny/grants revocados es intencional. [Explicación Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). No se declara inmutabilidad frente al propietario DB.

CI del commit54c04bfc1f6e0cc2f836562d34d61f3fe4cbe13f pasó en [41310548282](https://github.com/KingOwls/GameHive/actions/runs/41310548282) y [41310603200](https://github.com/KingOwls/GameHive/actions/runs/41310603200). El CI no guarda clave RAWG ni hace llamadas reales al proveedor: prueba contratos, SQL, concurrencia y adaptadorDB con upstream controlado, más AuthHTTP/E2E real local.

## Límites del cierre

GH-014–017 verificados localmente y en destino remoto. G2 no se cierra todavía: GH-018 alta manual está aprobado y en implementación; GH-019 condicionado documentado en G2-ENRICHMENT. Score GameHive requiere G3, no se simula con rating RAWG. No se ha desplegado frontend Vercel.

Un intento posterior de consulta/build no se ejecutó porque la revisión automática agotó uso de cuenta; se informó y se retomó tras la nueva instrucción del humano. La consulta y E2E que constan aquí sí terminaron posteriormente con éxito.

Para usar este entorno sin alterar el modo aislado de tests: `npm run dev -- --mode remote` carga `.env.remote` ignorado con URL/clave publicable y VITE_CATALOG_MODE=rawg. La clave RAWG permanece exclusivamente en servidor; nunca copiarla a ese archivo público.


## GH-018 — publicación y verificación remota, 2026-11-01

Autorización humana explícita para aplicar migración, publicar admin-games y probar cinco cuentas temporales con limpieza. Solo GameHive Next `krfodhagjzovsebghekm`; sin Vercel ni cargos.

Migración manual_games aplicada; MD5 fuente `7e77875ce1245323fd2a02afa884f433` idéntico al archivo versionado. El conector generó versión20261101172902; tras comprobar nombre, hash y ausencia de colisión, se alineó solo el historial a20261101164026, sin repetir DDL. admin-games ACTIVEv1, verify_jwt=false autorizado; Auth online, sesión PostgreSQL y admin activo se validan dentro del servidor. SHA256 de despliegue `9c5c9c8938062ff64d73c67a109fbd035e32816f415b43713052a7488e0d9c40`.

HTTP real remoto PASS: registro no hereda admin de metadata; anónimo401, user/critic/moderator403; fuentes HTTP/localhost/IP/javascript y HTML400. Dos altas concurrentes con fuente oficial Celeste canónicamente equivalente dieron201/409, una fila y una auditoría. Lectura pública200 con procedencia, sin actor/motivo. INSERT/UPDATE/DELETE Data API rechazados para anónimo y los cuatro roles, incluido admin. Administrador suspendido403; restaurado y después logout, token revocado401. Contraseñas/tokens permanecieron solo en memoria; sin envío de correos.

Navegador real sobre build remoto: ficha manual→metadatos/fuente→recarga, respuesta Data API remota200 observada y auditoría axe completa sin infracciones. El alta autenticada se comprobó por HTTP remoto; el formulario completo ya se verificó E2E local, no se presenta como alta remota en navegador.

Limpieza confirmada: usuarios Auth0, profiles0, authz0, private_user_settings0, manual_games0. Conservada una auditoría mínima manual con actor anonimizado por FK. Catálogo RAWG idéntico antes/después: fingerprint136afd8e8710563cea6bfe094f8bcf7f. RLS manual activo; permisos INSERT/UPDATE/DELETE=false para anon/authenticated/service_role. Sin residuos de las tandas interrumpidas.

Incidencias de la preparación de pruebas: una ejecución sin TTY salió13 esperando entrada; se eliminaron sus cuentas sin crear juegos. Otra preparación de roles falló42804 por tipo enum; la prueba se detuvo con403 y se limpió. Repetición con conversión explícita y comprobación previa de los cuatro roles pasó. Nunca más de cinco cuentas de prueba coexistieron. Intento de recuperación mediante consulta de clave service_role rechazado por revisión automática: no se ejecutó; se descartó y repitió el registro público tras limpiar las cuentas.

Axe ampliado encontró label-content-name-mismatch en el logo porque aria-label omitía texto visible. Se eliminó la sobrescritura y se usa el contenido visible como nombre, con title orientativo. Rebuild remoto y recorrido/axe completo pasaron; lint/typecheck pasaron. Las comprobaciones anteriores usaban etiquetas WCAG2A/AA/2.1AA y no detectaban esta regla adicional.

Advisors actual:0ERROR,1WARN por protección de contraseñas filtradas desactivada,4INFO de tablas privadas RLS sin políticas intencionalmente denegadas. No se declara cero advertencias ni se cambia el plan gratuito. [Protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Pendiente evaluar disponibilidad/configuración sin cargos antes de entrega.

GH-018 verificado localmente y remoto. GH-019 sigue condicionado a endpoints oficiales viables; scores/filtro GameHive dependen de G3. G3–G6 y alojamiento Vercel permanecen incompletos.
