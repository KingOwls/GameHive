# G2 — viabilidad real de RAWG

2026-11-01. Clave aportada por el humano en `.env.server.local`, ignorado y modo 600. Nunca se imprimió ni se guardó en este informe. Prueba operada por orquestador, distinta de mocks aislados.

## Evidencia real inicial

19 peticiones exitosas en la prueba final: taxonomía de plataformas (1), búsqueda+detalle de ocho juegos (16) y dos páginas con filtros combinados (2). Hubo 11 peticiones preliminares de investigación: búsqueda de Baldur’s Gate 3 no encontró coincidencia exacta porque RAWG usa **Baldur’s Gate III**; búsqueda ampliada permitió identificarlo. Total hasta este checkpoint: 30 intentos. No se agotó deliberadamente cuota ni provocaron 429 del proveedor.

| ID RAWG | Título observado | Descripción texto | Portada HTTPS | Estudio | Publisher | Requisitos |
|---|---|---|---|---|---|---|
| 9767 | Hollow Knight | sí | sí | sí | sí | sí |
| 274755 | Hades | sí | sí | sí | sí | sí |
| 22121 | Celeste | sí | sí | sí | sí | sí |
| 654 | Stardew Valley | sí | sí | sí | sí | sí |
| 324997 | Baldur's Gate III | sí | sí | sí | sí | sí |
| 326243 | Elden Ring | sí | sí | sí | sí | sí |
| 262382 | Disco Elysium | sí | sí | sí | no | sí |
| 4200 | Portal 2 | sí | sí | sí | sí | no |

Las ocho fichas devolvieron géneros, plataformas, tags, rating y tamaño de muestra. La ausencia de publisher/requisitos se conserva como ausencia, sin completar con datos inventados. IDs padres observados: PC 1, PlayStation 2, Xbox 3, Nintendo 7. Consulta combinada action/singleplayer/2020/plataformas/orden nombre devolvió HTTP 200, count 7259; páginas 1 y 2 de dos registros devolvieron cuatro IDs distintos. La comprobación posterior por registro confirmó género action, tag singleplayer, fecha 2020 y plataforma padre permitida en los cuatro resultados. Capturas: endpoint de Hollow Knight devolvió tres URLs media.rawg.io y HEAD de la primera respondió200 image.

## Condiciones y alcance

[RAWG API y plan Free](https://rawg.io/apidocs): proyecto académico no comercial; hasta 20000 requests/mes y enlace a RAWG en cada página con sus datos/imágenes. La página conserva una cláusula comercial diferente: no se utiliza para ampliar la demo. No redistribuir como servicio de datos para terceros. [Esquema oficial consultado](https://api.rawg.io/docs/?format=openapi).

No se asumieron vídeos, similares ni enlaces de compra del plan Business. Las portadas son URLs remotas proporcionadas por RAWG; no se descargaron ni se afirma propiedad de terceros. No se usa HTML del proveedor como HTML de la aplicación. Ratings externos quedan separados de puntuaciones GameHive.

## Recorrido implementado y revalidado

Tras las correcciones de revisión BMAD: HTTP Edge local→RAWG→DB→cliente devolvió200 para taxonomías, búsqueda Hollow Knight y detalle9767. Cuatro plataformas padre permitidas. La segunda ficha fue idéntica sin reserva adicional, descripción persistida; parámetros key, plataforma móvil4 y ruta arbitraria devolvieron400. Respuestas sin clave privada. La búsqueda inicial fuzzy no encontraba el título en primera página al ordenar por nombre; search_precise solo no bastó. search_exact junto con search_precise sí lo incluye, regresión cubierta.

Build live explícito y `GH_RUN_RAWG=1 npx playwright test tests/e2e/catalog-live.spec.ts --reporter=list`: 1 pasada real, sin mocks. Búsqueda→Hollow Knight→ficha completa→requisitos/capturas→recarga; atribución/rating/muestra y axe sin violaciones. Ocho200 del script real habían pasado antes del refuerzo de validación de ID/nombre; ese refuerzo se verificó con cuatro casos aislados, sin gastar otras ocho llamadas. No se presenta ese retest aislado como nueva consulta al proveedor.

Otros controles finales:101 Vitest +1 Auth omitida en suite aislada; Auth HTTP real y1 E2E real aparte;134 SQL/RLS; adaptador de producción con DB real y upstream controlado (TTL expirado, clave Unicode y documento multibyte); concurrencia aislada40→20,999→1 y600→500. Lint/tipos/build y Deno check --frozen de tres handlers pasaron. E2E offline5pasadas,2omitidas por requerir entornos reales; ambas se ejecutaron después por separado. Informes G2-IMPLEMENTATION y spec contienen revisión/triage.

Las30peticiones iniciales fueron un checkpoint, no un contador global: después hubo comprobaciones puntuales de filtros/capturas/búsqueda, el script de ocho fichas y el recorrido local medido por private.catalog_attempts. No se provocó429 real ni se afirma que su prueba aislada sea del proveedor.

## Brecha restante

Catálogo verificado con Supabase local y RAWG real. No hay migración/función catalog ni secreto RAWG publicados en GameHive Next; requiere autorización específica. GH-018 alta manual pendiente; GH-019 condicionado, ver G2-ENRICHMENT. Filtro score GameHive depende de G3. G2 completo todavía no verificado.
