---
title: 'GH-022: análisis crítico completo en una sola reseña'
type: 'feature'
created: '2026-11-01'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: b763cb0894b4d93d470ffd9f89a9c97c9160a6fb
context: ['AGENTS.md', 'GAMEHIVE_MASTER_SPEC.md', 'docs/IDENTITY.md', 'docs/plans/G3.md', 'docs/CATALOG.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

Un crítico activo publica y edita un análisis completo de un juego RAWG/manual en su única reseña; otro visitante puede consultar criterios, contexto, transparencia y spoilers ocultos.

## Boundaries & Constraints

Decisiones humanas2026-11-01: nota final como media simple de ocho criterios0–10; preguntas por género amplían análisis sin alterar nota. El tipo original se conserva al cambiar rol; conversión explícita de reseña ordinaria a crítica completa conserva ID y unicidad autor+juego.

Ocho criterios: jugabilidad, narrativa, arte, sonido, rendimiento, accesibilidad, contenido, valor; todos obligatorios con nota y explicación. Mostrar media calculada por servidor, resumen público, plataforma, horas jugadas, finalización, fortalezas/debilidades, copia facilitada y justificación de nota editorial calculada. Ampliación con spoilers dentro del mismo registro. No confundir critic con critic_verified ni inventar verificación.

Autoría user/critic activos con sesión vigente; admin/moderator no heredan autoría. Solo critic crea/convierten análisis o modifica sus detalles críticos. Una crítica histórica conserva tipo al perder rol: su autor user puede editar texto básico o retirar/republicar; criterios, contexto crítico y nota calculada permanecen solo lectura. Un crítico puede mantener/editar una reseña ordinaria sin convertirla. Cambiar nota calculada exige opinión pública realmente distinta en la misma operación.

Mantener versión409, borrador, recuperación de resultado incierto, auditoría atómica mínima, fuentes/FKs reales y aislamiento de datos privados. Banco configurable mediante migraciones/operador, sin panel nuevo: preguntas versionadas y respuestas vinculadas a su versión; cambiar banco no reinterpreta análisis existentes. Datos comunitarios reales, sin puntuaciones simuladas.

No solicitudes/aprobación GH-023, votos, comentarios, seguidores, agregados GH-026 ni publicación remota/Vercel.

## I/O & Edge-Case Matrix

| Caso | Resultado |
|---|---|
| Crítico activo con análisis completo | una crítica persistida y nota media del servidor |
| Criterio ausente, fuera0–10, texto/contexto inválido |400 sin mutación parcial |
| Manipular nota final, rol o verificación | sin autoridad ni score cliente |
| Convertir reseña propia como critic | mismo ID, versión nueva; conserva estado retirada/publicada |
| Rol cambiado después de publicar | tipo histórico estable; detalles críticos protegidos |
| Editar obsoleto, duplicar, ocultación moderada |409/403; conserva borrador, sin duplicado |
| Suspensión/revocación o fallo auditoría | sin escritura/lectura privada; público oculto si suspendido; rollback |
| Banco cambia o no coincide género | versiones previas estables; preguntas generales si falta coincidencia |

</frozen-after-approval>

## Code Map

`reviews` migración/operación privada, Edge reviews y review-validation, servicio/domain y ReviewsSection ya cubren sesión/lock718007013, versiones, spoilers y borrador. Reutilizar helper deadline; conservar límite manual20KB y regresiones GH-020. `public.games.document.genres` y manual_games.genres son fuente autoritativa de géneros. RLS de detalles debe heredar publicación/autor activo del padre; propia por Edge sin exponer retiradas.

## Tasks & Acceptance

- [x] Migración CLI: kind por defecto user para registros actuales; detalles/criterios/respuestas ligados a review y banco versionado público de solo lectura. Escrituras solo operación privada invoker transaccional; sin nuevo definer.
- [x] Validar ocho claves exactas, notas finitas0–10 hasta dos decimales y explicación10–1000 caracteres; media redondeada a dos decimales en servidor. Plataforma permitida del juego, horas0–10000, finalización declarada; justificación20–2000. Reutilizar resumen/pros/contras/spoilers existentes.
- [x] Banco inicial rotulado como contenido editorial propio, preguntas generales y por géneros reconocidos; máximo12 preguntas por análisis, respuestas1–1000. Guardar versión/texto real elegido por servidor; no confiar preguntas/género del cliente. Preservar conjuntos históricos al editar.
- [x] Extender endpoint/servicio/UI: análisis y media transparente, insignia verificada real, conversión explícita, permisos según tipo/rol; lectura pública paginada y estados. Cuerpo acotado256KB, timeout/cancelación compartidos; borrador crítico preservado por autor+juego.
- [x] SQL/unit/integración/HTTP/E2E: cuatro roles y crítico no verificado; manipulación de score/detalles, cambio rol/banco, conversión sin duplicado, versión/carreras, suspensión/privacidad, auditoría fallida, ambos catálogos y dos sesiones. Pruebas reales/fixtures diferenciadas y limpieza.
- [x] Actualizar planG3, QA, BACKLOG, requisitos y PROGRESS; tres revisiones BMAD y regresionesG1/G2/GH020 antes de verified local.


- [x] Recuperación crítica: validar estructura de borrador sin exigir completitud editorial; conservar campos vacíos/NaN e impedir crashes por almacenamiento corrupto. Guardar preguntas inmutables (ID/key/versión/prompt) junto al borrador. Dado cambio de banco antes de alta/conversión, permitir recargar/reconciliar preguntas actuales conservando criterios/contexto/textos y respuestas por question_key; avisar nuevas respuestas necesarias. Edición persistida conserva conjunto histórico. GETquestions tiene estado loading/error y reintento sin descartar trabajo.
- [x] Preparación reversible: cancelar extensión crítica todavía no persistida conserva todos los campos ordinarios y nota previa; crítica existente no permite degradar tipo. Nota mostrada/enviada en crítica coincide con media orientativa aunque nota ordinaria previa esté vacía; DB conserva autoridad. Catálogo sin plataformas comunica bloqueo; plataforma histórica sin cambio permanece válida al editar aunque catálogo cambie, cambios nuevos requieren catálogo actual.
- [x] Guía explícita: criterios/contexto/preguntas son públicos sin spoilers; dirigir revelaciones a sección protegida. E2E verifica explicaciones, justificación, respuestas/versiones y copia facilitada true/false con save/reload/edit, además de recuperación de banco/borradores y regresiones.

## Implementation Notes

Aprobación humana explícita2026-11-01. Directorio /home/jhonatan-crow/Documentos/ChatGPT/Universidad/GameHive, rama feat/g3-critical-analysis. Implementar y verificar localmente; sin commits ni operaciones remotas del implementador. Deno=/tmp/gamehive-deno/deno y DENO_DIR=/tmp/gamehive-deno-cache. Stack local gamehive activo; runtime Edge58585 lo coordina el agente principal: pedir aplicación de nueva migración/reinicio cuando esté lista. Demo estable ocupa5173 con copia del build previo fuera de dist; suites de prueba usan4173 y deben ejecutarse secuencialmente. La migración crítica de iteración0 ya está aplicada en el stack local: no reaplicarla ni resetear datos; pedir al coordinador sincronizar funciones si cambia SQL. No hay suites activas ni cambios remotos autorizados. Implementador sin commits, remoto o builds paralelos; coordinar4173. No imprimir supabase status ni credenciales; helpers privados existentes capturan claves solo en memoria.

## Spec Change Log

### Iteración1 — revisión independiente, 2026-11-02

Desencadenantes BL02/03/05/07 y EC02: especificación no concretaba recuperación de preguntas cambiantes/fallidas y cancelación reversible antes de persistir. Se amplían únicamente Tasks & Acceptance; intención congelada idéntica a aprobación. Estado conocido malo evitado: borrador bloqueado con IDs obsoletos/prompts perdidos o preparación irreversible; no se publica ese estado.

KEEP: media numeric y centésimas2.005→2.01; identidad/unicidad/estado al convertir; permisos históricos; sesión/rol vigentes y auditoría atómica; RLS padre e invoker; banco editorial inmutable; Unicode256KB y defaultmanual20KB; pruebas de roles/carreras/SQL/HTTP/CIaislado, spoilers/axe y limpieza; panel crítico honesto. Referencia positiva de implementación y logs en `/tmp/gamehive-gh022-iteration0/`; rederivar frente a tareas ampliadas corrigiendo todos los hallazgos. No restaurar ciegamente estados fallidos.

## Review Triage Log

| ID | Veredicto | Ruta | Evidencia |
|---|---|---|---|
| BL01 | medium | patch absorbido por loopback | readDraft admite critical={} y CriticalEditor lee value.criteria[k]; estructura incompleta almacenada produce excepción. Validar borrador y restaurar números vacíos sin perder texto. |
| BL02 | medium | bad_spec | Banco nuevo entre preparación y publicación cambia qids; SQL22023 y no existe reconciliación conservadora. Falta concretar recuperación de borrador en tareas no congeladas. |
| BL03 | medium | bad_spec | Draft guarda solo IDs/respuestas y GETquestions devuelve versiones actuales; tras refresh desaparecen prompts anteriores. Misma transición de banco que BL02. |
| BL04 | medium | patch absorbido por loopback | Validación de plataforma actual también se ejecuta en crítica existente: si catálogo cambia, plataforma histórica idéntica bloquea edición básica como critic. Admitir valor histórico sin cambio, validar cambios reales. |
| BL05 | medium | bad_spec | Preparación oculta su botón y no ofrece cancelar extensión sin descartar campos ordinarios. Falta concretar cancelación reversible antes de conversión persistida. |
| BL06 | medium | patch absorbido por loopback | Input Nota deshabilitado conserva draft.rating aunque media cambia; muestra puntuaciones contradictorias. Usar media orientativa coherente. |
| BL07 | medium | bad_spec | GETquestions fallido con borrador crítico deja opciones vacías; reload no solicita preguntas. Faltan estado y recuperación explícitos sin pérdida de borrador. |
| BL08 | low | patch absorbido por loopback | Catálogo RAWG admite plataformas ausentes; select requerido vacío bloquea correctamente una plataforma inventada, pero falta explicar dato no disponible. Mensaje y preparación bloqueada son corrección directa. |
| BL09 | low | patch absorbido por loopback | 1.00000000001 pasa tolerancia Edge y DB lo rechaza400; no hay persistencia inválida. Alinear precisión con representación decimal serializada, conservando notas válidas9.99. |
| BL10 | medium | patch absorbido por loopback | Explicaciones y respuestas se renderizan públicamente sin aviso local de ausencia de spoilers. Añadir guía visible al editor hacia sección protegida existente. |
| EC01 | medium | patch absorbido por loopback | Vaciar nota ordinaria produce NaN; checking sustituye media pero payload conserva NaN→null. Edge rechaza400 pese a criterios válidos; enviar media como copia no autoritativa. |
| EC02 | medium | bad_spec | Mismo bloqueo de banco durante borrador que BL02; IDs obsoletos y prompts perdidos, recuperación actual descarta todo. |
| VG01 | medium | patch absorbido por loopback | Brecha pre-verificada: E2E público solo prueba nota/plataforma/insignia, no criterios/justificación/respuestas ni ambos valores de copia facilitada. Añadir asserts de lectura real tras guardar/editar/recargar. |


### Iteración1 — segunda revisión, 2026-11-02

| ID | Veredicto | Ruta | Evidencia |
|---|---|---|---|
| V1-BL01 | medium | patch | Democión durante preparación de conversión conserva critical y form elige convert; backend403 correcto pero UI deja acción inválida. Bloquear publicación hasta cancelar extensión; crítica histórica sigue editable. |
| V1-BL02 | medium | patch | Democión de borrador nuevo elige create y payload elimina critical, publicando tipo ordinario sin cancelación explícita. Mismo guard de BL01 impide cambio silencioso de formato. |
| V1-BL03 | false | rechazado | La afirmación de crash no ocurre: campos de editor usan pros?.join/cons?.join y validateReview usa ??[]. Null ya era admitido en parser previo; backend400 sanea null si se envía, sin iteración nula en consumidores citados. |
| V1-BL04 | medium | patch | Reconciliación actual reconstruye answers desde current y borra texto de preguntas retiradas. Corrección mínima: no reconciliar automáticamente si quitaría respuestas no vacías; conservar íntegro borrador y pedir copia/vaciado explícito mediante mensaje y campos existentes. |
| V1-BL05 | false | rechazado | Transferir por question_key fue expresamente concretado en tareas de iteración1. Acción es explícita, prompt nuevo se muestra en editor y publicación posterior es otra acción del autor; no existe publicación automática ni cambio de análisis persistido. Exigir nuevo consentimiento por versión sería política adicional no establecida. |
| V1-BL06 | medium | patch | NOT EXISTS de versión más nueva no filtra género aplicable; puede suprimir versión anterior válida sin seleccionar nueva. Añadir aplicabilidad a candidatos de exclusión, sin cambiar contrato. |
| V1-BL07 | medium | patch | Editor añade value.platform a opciones aun en borrador nuevo/conversión; si dato desaparece, UI conserva elección que DB rechaza. Validar nativamente selección actual en borrador no persistido y mostrar instrucción existente; histórica persistida sigue admitida. |
| V1-BL08 | low | patch | Advertencia detecta IDs distintos pero submit aún envía conjunto obsoleto y recibe400. Guard directo de submit/botón conserva borrador y dirige a reconciliar, sin endpoint nuevo. |
| V1-BL09 | low | rechazado | Serialización corta de questions es real, coherente con protocolo de sesión/autoridad ya revisado para own. No se ejecuta proveedor ni trabajo prolongado dentro del lock ni hay demora cotidiana demostrada. Dividir protocolo introduce ramas de concurrencia para optimización no medida; no se acredita alta carga. |
| V1-BL10 | medium | patch | Faltan transiciones retiradas/género/plataforma de borrador en tests actuales, pese a ramas nuevas; añadir cobertura dirigida de resultados descritos en BL04/06/07. |
| V1-BL11 | medium | patch | Caso de democión solo prueba cancelar; faltan submits nuevo y conversión demovidos. Añadir assertions de cero mutación/envío inválido para guard BL01/02. |
| V1-EC01 | low | patch | Identificador manual case-insensitive se acepta en Edge/operación, pero selector compara texto lowercase exacto; con UUID mayúsculo devuelve solo generales. Normalizar comparación del mismo identificador, sin ampliar formatos. |
| V1-VG01 | medium | patch | Brecha pre-verificada: subqueries de parent reviews bajo RLS hacen vacuas comprobaciones hijas. Capturar IDs antes de cambiar rol y consultar hijos directamente, con visibilidad positiva y negativa para autenticado/anon. |

## Verification

Check, SQL/RLS y Deno frozen/DB; HTTP/E2E real crítico→guardar→otra sesión→editar→convertir ordinaria→retirar/republicar, nota media correcta y spoilers cerrados. Teclado/axe, concurrencia/roles y regresiones. No acreditar proveedor por fixtures ni remoto por pruebas locales.


### Evidencia del implementador (2026-11-01)

Migración `20261101232944_critical_reviews.sql` aplicada por coordinador local, sin definer nuevo. SQL303PASS;69Vitest dirigidosPASS;lint/typecheck/buildPASS;Deno check frozen de reviews y test:reviews:dbPASS. HTTP/E2E real y vía aislada de CI:2HTTP+2E2EPASS cada una, con limpieza, Unicode>160KB y lectura pública/edición/conversión/roles/banco/spoilers/axe. Media límite2.005→2.01 coincide entre helper orientativo y numericDB. [QA crítica](../../qa-reports/G3-CRITICAL.md) y [planG3](../../docs/plans/G3.md). Tres revisiones BMAD y regresiones globales finales corresponden al coordinador; conservar in-progress hasta cierre verificable.

### Cierre del coordinador — 2026-11-02

Intención congelada comparada idéntica con snapshot aprobado. Dos rondas de tres revisiones y todos los hallazgos clasificados; rederivación de tareas y parches finales verificados, sin trabajo diferido. Check227/4omitidas, SQL316, Deno5entrypoints/DB, real2HTTP+2E2E, aislado2HTTP+2E2E repetido dos veces, regresionesAuth/manual/RAWG/offline, db lint y limpiezaPASS. WorkerAlreadyRetired real corregido mediante configuración local oneshot; evidencia y fuentes en G3-CRITICAL. Sin despliegue remotoG3/Vercel; no cierra productoP0.
