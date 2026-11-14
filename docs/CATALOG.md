# Catálogo RAWG local

GH-014–017 implementado en esta historia; no habilita comunidad ni despliega funciones. El modo predeterminado sigue siendo el catálogo editorial identificado. Para conectar RAWG, configurar `VITE_CATALOG_MODE=rawg`, URL Supabase y clave publicable en archivo local ignorado. Una configuración RAWG ausente o fallida muestra error recuperable; no intercambia silenciosamente proveedor ni totales.

La clave `RAWG_API_KEY` pertenece exclusivamente al servidor, en `.env.server.local` ignorado y con permisos `600`. Nunca ponerla en variables `VITE_`. Aplicar la migración local por CLI, después servir `catalog` con el archivo de servidor. No aplicar a remoto ni publicar sin autorización. Identidad G1 conserva migración y funciones existentes.

## Contrato

GET `/functions/v1/catalog/games` acepta `q` (100 caracteres), `genre`, `platform`, `year` (1900–2099), `tag`, `order` (`title`, `year`, `rating`) y `page` (1–100). Tamaño fijo 12. Año incompleto o inválido se valida localmente sin HTTP; reintento de filtros y búsqueda son independientes. Los filtros combinan en una URL reproducible; la UI espera 300 ms al escribir texto RAWG, cancela peticiones anteriores y no muestra resultados de otra URL. Se usan `search_precise=true` y `search_exact=true` para buscar términos completos, conservando el orden seleccionado. La prueba real mostró que `precise` solo todavía relegaba Hollow Knight entre 2055 candidatos; `exact` redujo a 13 e incluyó el título en página 1.

Plataformas padre públicas permitidas: PC=1, PlayStation=2, Xbox=3, Nintendo=7. Por defecto se consulta ese conjunto. `/genres`, `/platforms` y `/tags` aportan taxonomías del servidor; tags ofrece las primeras 40 etiquetas del proveedor. No hay taxonomía RAWG inventada en cliente. El score GameHive se pospone hasta agregados G3.

GET `/games/{id numérico}` devuelve ficha o `null` para 404. `/games/{id}/screenshots` carga hasta 3 capturas permitidas al abrir la ficha completa; cuenta con la misma reserva/caché y su error/reintento independiente conserva los metadatos visibles. Identidad estable `rawg:{externalId}` y UNIQUE proveedor+ID. Descripción, etiquetas, desarrolladores, publishers y requisitos mínimo/recomendado por plataforma (hasta 8 bloques, 1800 caracteres/campo) como texto plano, sin HTML insertado en DOM; imágenes HTTPS restringidas a `media.rawg.io` sin credenciales/query. Fuente RAWG enlazada con slug validado; rating externo muestra origen, escala 5 y muestra. Fechas o campos ausentes quedan explícitos y comunidad permanece «Sin evaluaciones».

## Persistencia y límites

`public.games` permite SELECT público y deniega toda escritura Data API, incluidos JWT admin y `service_role`. `private.catalog_cache` y `private.catalog_attempts` tienen RLS y grants revocados; funciones `SECURITY INVOKER` solo utilizables mediante conexión DB del servidor. Ninguna autorización depende de metadata JWT.

Antes de cualquier intento upstream se reserva presupuesto persistente bajo bloqueo transaccional: 1000/mes UTC, 20 en ventana móvil de 60 segundos. Fallos y timeout consumen reserva; rechazos no consultan proveedor. Caché normalizada de 6 h, máximo 500 entradas incluso con escrituras concurrentes; lectura de caché no reserva presupuesto. Cache de búsqueda nunca borra descripción/resumen/desarrolladores/publisher completos ya persistidos. Timeout de 8 s cubre cabeceras y cuerpo, respuestas limitadas a 1 MiB y documentos de juego a 64 KiB en DB; la normalización reduce metadatos opcionales a 48 KiB UTF-8 compactos, preservando identidad, título, fuente y rating. Truncamiento por puntos de código conserva Unicode válido. Clave de caché privada hasta 2048 caracteres para admitir la URL canónica de consultas internacionales aceptadas sin cambiar la API. Solo origen API RAWG fijo, rutas/params permitidos y redirects rechazados; errores externos y URLs con clave no llegan a cliente/logs/reportes.

El presupuesto de GameHive es deliberadamente inferior a los límites anunciados por RAWG. La prueba manual de ocho juegos consume llamadas separadas medidas en su informe y debe ejecutarse excepcionalmente.

## Verificación

- `npm run check`: código cliente, contratos y HTTP con dependencias aisladas. Esas fixtures no certifican conexión real.
- `npm run test:e2e`: regresión offline; pruebas reales de navegador se registran aparte.
- `npm run test:sql`: permisos de anon/user/tercero/critic/moderator/admin, integridad, preservación de ficha y límites.
- `npm run test:catalog:db`: Deno importa el adaptador de producción tras controlar upstream, consulta DB local real y prueba TTL expirado/fresco, clave Unicode >512 y constraint jsonb multibyte. Captura CLI status solo en memoria; no emite credenciales ni realiza llamadas RAWG. Incluido en CI.
- `node scripts/test-catalog-concurrency.mjs`: únicamente contenedor DB `supabase_db_gamehive`; crea esquema aleatorio independiente y lo elimina al terminar. Prueba 40 reservas concurrentes y 600 escrituras sin tocar datos de catálogo reales ni gastar RAWG.
- `node scripts/verify-rawg.mjs .env.server.local`: ocho IDs observados en la prueba real; salida saneada por stdout. `--output ruta-nueva` guarda un informe nuevo sin sobrescribir. Nunca imprime clave ni URLs upstream. No repetir innecesariamente. Evidencia real y condiciones: [G2-RAWG](../qa-reports/G2-RAWG.md).

[RAWG API y términos](https://rawg.io/apidocs), [esquema oficial](https://api.rawg.io/docs/?format=openapi) consultados 2026-11-01. Caso académico no comercial; backlink por página con datos o imágenes. No depender de where-to-buy, vídeos ni similares Business. Restricciones RLS contrastadas con [documentación Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).


El coordinador confirmó flujo HTTP real Edge→RAWG→DB, cache hit sin gasto, inválidos400 y E2E real `catalog-live` (buscar→Hollow Knight→requisitos/capturas→recargar+axe), más ocho200 del verificador real. La revisión posterior usa pruebas dirigidas; revalidación global e integración corresponden al coordinador.
