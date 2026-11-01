# G2 — implementación y regresión local

2026-11-01. Alcance GH-014–017, implementación nueva. Sin push/despliegue ni cambios a migración/funciones Auth G1. Conexión real medida y pruebas backend/navegador del coordinador se registran por separado en [G2-RAWG](G2-RAWG.md).

## Resultado de implementación

Adaptador explícito `curated`/`rawg`; servicio público GET con parámetros/rutas limitados, origen fijo, deadline 8 s, payload 1 MiB y errores saneados. Secreto solo servidor. SQL con juegos públicos de solo lectura, caché/presupuesto privados, funciones invoker sin grants cliente, reserva global transaccional 1000/mes UTC y 20/60 s; caché 6 h/500 entradas. Identidad proveedor+ID única y búsqueda no borra ficha completa.

Catálogo con URL reproducible, texto con debounce, filtros servidor de género/plataforma/año/tag/orden/página, cancelación y reintento. Ficha breve/completa con descripción, desarrolladores, publishers, etiquetas, requisitos por plataforma, fuente/portada y rating RAWG con escala/muestra. Capturas hasta tres, en consulta separada al abrir ficha completa, con reserva/caché y error recuperable independiente. Sin tiendas/vídeos/similares ni comunidad simulada; score GameHive pendiente de G3.

## Comandos ejecutados por implementación

- `npm run check`: pasó en versión inicial de la integración (87 pruebas Vitest pasadas, 1 Auth real omitida en entorno aislado); build pasó. Última ampliación de capturas: `npm run lint`, `npm run typecheck`, `npm run test` pasaron con 89 pruebas y 1 Auth real omitida. El coordinador construyó live y verificó el flujo real; las correcciones posteriores pasaron suites dirigidas y revalidación global del coordinador (sección final).
- `DENO_DIR=/tmp/gamehive-deno-cache /tmp/gamehive-deno/deno check --frozen` sobre `catalog`, `identity` y `admin-identity`: pasó tras ampliar metadatos y capturas.
- `npm run build && npm run test:e2e`: build offline pasó; primer E2E sin escalación no pudo iniciar preview por bind del sandbox. Reejecución autorizada `npm run test:e2e`: **5 pasaron, 1 Auth real omitida**. Catálogo/ficha, refresco, teclado, 1280 px, ambos temas, axe y movimiento reducido conservados. Capturas llegaron después y tienen verificación aislada; navegador live final se registra aparte.
- `git diff --check`: pasó.

El coordinador confirmó 134 SQL/RLS (91 catálogo + 43 identidad), Auth HTTP G1, db lint/advisors locales sin avisos y concurrencia DB real aislada: 40 reservas → 20 admitidas; 999 intentos mensuales → 1 única reserva final de 10 simultáneas; 600 escrituras → 500 entradas. El coordinador confirmó después HTTP real Edge→RAWG→DB, cache hit con cero gasto e inválidos400; E2E real catalog-live pasó búsqueda→Hollow Knight→requisitos/capturas→recarga+axe. El script real de ocho fichas recibió ocho200. Las correcciones posteriores ya pasaron revalidación global del coordinador (sección final).

Las fixtures aisladas de `rawg.test.ts`, `catalog-http.test.ts` y `rawg-ui.test.tsx` cubren allowlist, móvil excluido de filtros, SSRF, HTML/XSS, ausencia, JSON/cuerpo inválido y grande, deadline, errores429/5xx/redirect, null404, reserva previa, cache hit, cuota agotada sin fetch, cancelación, estado/reintento, URL combinada y fallo de medios independiente. No se presentan como RAWG real.

## Defectos reproducidos y resueltos

- **S2, búsqueda poco útil:** con texto «Hollow Knight» y orden nombre, RAWG devolvía coincidencias difusas sin el título exacto en página1. `search_precise=true` todavía devolvió 2055 candidatos en prueba real del coordinador; `search_exact=true` redujo a 13 e incluyó el juego. Se aplican ambos parámetros documentados a textos no vacíos sin alterar orden ni exponer otra superficie pública. Regresión aislada comprueba ambos. Revalidación HTTP real en informe RAWG.
- **S3, regresión temporal de test de historial:** añadir demora a consultas offline retrasó la inicialización de una promesa controlada en la prueba existente. El catálogo offline local no necesita debounce; se aplica al texto de RAWG y se conserva cancelación del catálogo curado. La prueba de historial original pasa, más regresión live con debounce.

## Límites y revisión

No se agotó deliberadamente cuota RAWG ni se indujeron fallos externos; errores se verifican de forma aislada. Términos y ocho fichas requieren evidencia real enlazada. Cache normalizada previa a cambios de contrato permanece hasta 6 h; durante desarrollo la verificación debe expirar solo entradas locales afectadas para observar metadatos nuevos. El bundle produce aviso de tamaño >500 kB (aprox.504 kB, gzip147 kB); build no falla. Despliegue remoto y cierre G1 remoto siguen fuera de alcance autorizado. GH-018 y GH-019 quedan para historias posteriores.


## Correcciones de revisión — pruebas dirigidas

Se corrigió la inicialización con configuración parcial/inválida o modo desconocido: el adaptador conserva modo live y emite error recuperable al consultar, sin romper el módulo App. Año incompleto/inválido muestra validación local y no consulta; los reintentos de taxonomía y búsqueda tienen contadores independientes.

La migración de seguimiento `20261101120540_catalog_cache_key_bound.sql`, creada por CLI y aplicada localmente por el coordinador, amplía solo la clave privada a 2048 caracteres; conserva q100 y query1024 públicos. La normalización limita JSON UTF-8 compacto a48KiB para respetar el constraint jsonb64KiB incluso con metadatos multibyte, preservando identidad/título/fuente/rating. La prueba con DB descubrió que cortar UTF-16 podía crear surrogates inválidos; el truncamiento ahora opera sobre puntos de código y reemplaza surrogates aislados.

Se añadieron regresiones cliente real→handler real→upstream controlado de todos los filtros, timeout durante stream tras recibir cabeceras y verificación del script ante HTTP200 sin nombre, nombre vacío o ID distinto. Fixtures mensuales se mantienen dentro del mes UTC; expectativas respetan el límite móvil durante primeros minutos y el cambio natural de mes.

Se incorporó `supabase/tests/catalog-adapter.test.ts`, ejecutado normalmente mediante `npm run test:catalog:db` y CI. Captura CLI status solo en memoria; importa adaptador de producción después de controlar fetch, sin bypass/origen alternativo ni gasto RAWG. DB real demuestra TTL expirado que vuelve a upstream, hit fresco que no consulta, persistencia de query Unicode >512 y documento multibyte que cumple el constraint real. `deno.lock` incorpora hashes de imports dinámicos de la dependencia postgresjs3.4.5 ya utilizada; ejecución final usa `--frozen`.

Solo comprobaciones dirigidas en esta iteración: 57 pruebas de contratos/HTTP/UI pasaron; 4 pruebas del script con fetch sustituido pasaron; tras el ajuste Unicode se repitieron las52 de contratos/HTTP, satisfactorias. Integración Deno adaptador+DB pasó; pgTAP solo catálogo91 pasó; concurrencia aislada40→20,999→1 y600→500 pasó. No se ejecutó suite global ni hubo llamadas RAWG reales nuevas. Revalidación global queda a cargo del coordinador, que ya había confirmado HTTP real, cache sin gasto, inválidos400, E2E real con requisitos/capturas/recarga+axe y ocho200 del script.

## Revalidación final del coordinador

101Vitest+1omitida; lint/tipos/build;134SQL; adaptador real con DB y upstream controlado; Deno frozen3handlers; AuthHTTP1+AuthE2E1; E2Eaislados5+2omitidos; E2ERAWGreal1 y HTTP real caché/persistencia/inválidos pasan. Revisión completada y parches revalidados, sin publicación remota. Un fallo de regresión Auth durante reinicio runtime (DNS) se resolvió esperando disponibilidad y repitiendo, sin cambio de código. Build advierte bundle506KiB, pendiente optimizaciónG6.
