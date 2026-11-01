---
title: 'GH-014–017: descubrir juegos mediante RAWG'
type: 'feature'
created: '2026-11-01'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 470eceb79cc34bf3b2e6977c6100f1066a5d0ce5
context: ['AGENTS.md', 'GAMEHIVE_MASTER_SPEC.md', 'docs/plans/G2.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

Explorar y buscar juegos reales, combinar filtros y abrir una ficha con metadatos/fuente. Sustituir la dependencia exclusiva del catálogo offline por RAWG encapsulado en servidor; conservar el modo curado explícito al faltar configuración. No presentar pruebas aisladas como conexión real.

## Boundaries & Constraints

**Siempre:** presupuesto cero; clave RAWG solo servidor; parámetros limitados; timeout, caché acotada y cuota global persistente; atribución enlazada en cada página RAWG; fechas/datos ausentes honestos; cancelación y errores recuperables. Identidad estable proveedor+ID externo, única en DB. Consultar condiciones y probar ocho juegos antes de cerrar GH-014.

**Nunca:** copiar referencia; revelar URLs con clave; proxy arbitrario; HTML del proveedor sin sanear; datos comunitarios inventados; sustituir score GameHive por RAWG; compras, vídeos o similares de pago; cambiar G1 ni desplegar funciones nuevas sin autorización.

## I/O & Edge-Case Matrix

| Escenario | Entrada | Resultado | Error |
|---|---|---|---|
| Explorar | texto/género/plataforma/año/tag/orden/página | consulta combinada y URL reproducible | 400 saneado |
| Ficha | ID válido/inexistente | metadatos, portada HTTPS permitida, fuente y rating externo con escala/muestra | vacío o reintento |
| Respuestas tardías | navegación rápida | resultado corresponde a URL actual | cancelación |
| Proveedor falla | 429/5xx/timeout/payload inválido | error y reintento; sin éxito simulado | nunca filtrar clave |
| Sin configuración | clave ausente | modo curado identificado o aviso servidor no configurado | no mezclar totales |
| Cuota/caché | concurrencia y variantes | caché limitada, reserva atómica previa a upstream | 429 sin gasto adicional |

</frozen-after-approval>

## Code Map

- `src/domain/models.ts`: ampliar Game/CatalogQuery/Provider sin romper catálogo curado.
- `src/features/catalog/{CatalogPage,GameDetailPage,curated}.tsx`: reutilizar URL, Resource, cancelación; curated es .ts. Quitar taxonomías/textos offline fijos en modo live.
- `src/app/App.tsx`, `src/services/{config,errors,supabase}.ts`: selección de adaptador y fronteras públicas existentes.
- `supabase/functions/_shared/identity.ts`: patrón de errores; no modificar Auth para este ticket.
- `tests/{unit/catalog,integration/catalog-ui}.test.*`, `tests/e2e/foundation.spec.ts`: regresiones existentes que conservar.

## Tasks & Acceptance

- [x] `supabase/migrations/` vía CLI: juegos RAWG públicos de solo lectura; caché y presupuesto privados con RLS/grants y operaciones invoker exclusivas del servidor. Ninguna escritura Data API.
- [x] `supabase/functions/catalog/`, `_shared/catalog*.ts`: allowlist de rutas/parámetros, normalización y URLs seguras, cuota 1000 intentos/mes y 20/minuto, caché 6h/500 entradas y payload limitado. Persistir ficha sin que una búsqueda borre campos completos.
- [x] `src/services/catalog.ts`, `models.ts`: adaptador tipado y configuración live explícita; sin cambio silencioso de proveedor ante errores.
- [x] `CatalogPage.tsx`, `GameDetailPage.tsx`, `styles.css`: debounce, filtros/taxonomías servidor, paginación, ficha breve/completa, fuente y ratings separados, estados y reintento accesibles.
- [x] `tests/`, `supabase/tests/`: tabla de escenarios, RLS de cuatro roles, SSRF/XSS/secretos, caché/cuota concurrente, HTTP local y E2E con fixtures solo aislados.
- [x] `scripts/verify-rawg.mjs`, `qa-reports/G2-RAWG.md`: clave desde archivo ignorado, prueba real medida de ocho juegos y campos/errores; sin clave mantener blocked.
- [x] `docs/PROGRESS.md`, `BACKLOG.md`, `docs/REQUIREMENTS.md`: evidencia y brechas.

Dada consulta combinada, al navegar/refrescar, entonces se conservan filtros y no se muestran resultados anteriores. Dado tercero o admin con JWT, al escribir juegos/caché/cuota mediante Data API, entonces se deniega. Dada ficha con rating externo, al consultarla, entonces indica origen/escala/muestra y comunidad sin evaluaciones. Dada clave ausente, al probar, entonces no se declara RAWG verificado.

## Implementation Notes

Historia aprobada por el humano el 2026-11-01. Solo implementación local: no push ni operaciones remotas. CLI/Docker y red pueden requerir permisos fuera del sandbox. No imprimir salidas crudas de supabase start/status: capturar en temporal privado y eliminar al acabar; parar solo stack gamehive. Deno verificado disponible en /tmp/gamehive-deno/deno (DENO_DIR=/tmp/gamehive-deno-cache). La clave real RAWG fue aportada por el humano posteriormente, solo en archivo servidor ignorado. No tocar G1-REMOTE ni la migración identity inicial.

## Spec Change Log

## Review Triage Log

| Hallazgo | Veredicto | Ruta | Evidencia |
|---|---|---|---|
| BL-01 | medium | patch | App instancia proveedor en módulo; parsePublicConfig lanza con URL/clave parciales, pese al contrato de error recuperable existente. Capturar en el constructor ya preparado. |
| BL-02 | medium | patch | q internacional aceptada puede generar clave URL >512; SQL rechaza después de fetch/reserva. Alinear límite privado con el máximo de ruta existente, sin nuevo endpoint. |
| BL-03 | medium | patch | onChange de año escribe 2/20/202 y dispara HTTP400 con q vacío durante escritura normal. No consultar mientras el año esté incompleto/inválido; feedback local. |
| BL-04 | low | reject | Misses simultáneos idénticos gastan múltiples intentos, todos contabilizados correctamente dentro del límite aprobado. Single-flight distribuido añade estados/contratos para pico poco habitual en esta demo; no corregir aquí. |
| BL-05 | medium | patch | retry compartido entre efectos hace que reintentar filtros oculte resultados correctos y que reintentar búsqueda vuelva a pedir tres taxonomías. Separar dependencias existentes. |
| BL-06 | medium | patch | Strings/listas válidas multibyte pueden producir documento normalizado >64KiB y SQL503. Acotar representación normalizada antes de persistir conservando campos obligatorios. |
| BL-07 | low | reject | Fallo parcial de taxonomías descarta resultado conjunto; UI muestra fallo/reintento explícito y búsquedas siguen disponibles. Recuperación parcial exigiría cambiar contrato, complejidad mayor que beneficio en fallo infrecuente. |
| BL-08 | medium | patch | Timeout aislado actual cubre espera de headers, no cuerpo detenido; añadir regresión de stream que falla al abortar. |
| BL-09 | low | patch | Semilla -2min cae en mes anterior al inicio UTC y expectativas mensuales fallan; timestamp debe pertenecer al mes y respetar también ventana de minuto. Corrección de fixture y expectativa temporal, no regla de producto. |
| BL-10 | low | patch | Evidencia root reciente y textos pending de implementación no están reconciliados; registrar resultados finales y alcance, sin atribuir revisión o despliegue que no ocurrieron. |
| EC-01 | medium | patch | Duplicado BL-01: parsePublicConfig puede lanzar antes de renderizar cualquier ruta. |
| EC-02 | medium | patch | Duplicado BL-02: longitud normalizada privada incompatible con entrada pública aceptada. |
| EC-03 | low | patch | Verificador pone nombre placeholder truthy y admite200 sin name; validar ID/nombre obligatorio antes de contar éxito. |
| VG-01 | medium | patch | Brecha precomprobada: UI mockea proveedor, adaptador solo verifica substring de URL y contrato no asserts genres. Añadir query combinada pasando adaptador+handler reales con upstream controlado. |
| VG-02 | medium | patch | Brecha precomprobada: TTL real del adaptador DB no protegido por mocks/cleanupSQL. Sembrar entrada expirada y verificar el adaptador real con upstream controlado en verificación local/CI. |
| VG-03 | medium | patch | Brecha precomprobada duplica BL-08: deadline de cuerpo sin test consumidor que lo observe. |

## Verification

`npm run check`, E2E offline, SQL/RLS, HTTP y navegador local con backend real; `deno check --frozen` de todos los handlers. La prueba RAWG real y remoto se registran separadamente. No aprobar G2 por mocks ni compilar.

## Verificación previa a revisión

Prueba del proveedor: ocho títulos reales, filtros comprobados por registro y paginación. Script verify-rawg ejecutado con ocho respuestas200; salida saneada en temporal privado. Backend local: HTTPreal Edge→RAWG→DB pasó, caché repetida no consume reserva y documentos persisten; entradas inválidas400. Navegador real catálogo→Hollow Knight→requisitos/capturas→recarga y axe pasó. SQL134, concurrencia40→20 y600→500, AuthHTTPregresión, dblint/advisors locales pasaron. Se preserva la separación de evidencia aislada y proveedor real. No se publicó G2.

Todas las capas BMAD fueron ejecutadas. Dictámenes individuales antes de agrupar. Parches directos reutilizan límites, errores y dependencias existentes; sin nuevas superficies públicas, privilegios ni cambios al bloque aprobado. BL-04/07 son mejoras rechazadas por impacto bajo y complejidad adicional, no defectos de autorización.

## Cierre de historia local

Revalidación global101Vitest/134SQL,5E2Eaislados,1AuthHTTP+1AuthE2E y1E2ERAWGreal pasaron; Deno frozen3handlers y adaptadorDBreal también. Sin publicar catalog remoto. GH-018/GH-019 y scoreG3 fuera de esta historia. Evidencias en G2-RAWG y PROGRESS.
