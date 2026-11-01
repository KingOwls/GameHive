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
