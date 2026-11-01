# BACKLOG IMPLEMENTABLE — GAMEHIVE FINAL

**Convenciones:** P0 = requisito indispensable para sustentación; P1 = importante pero posterior a flujos P0; P2 = fuera de alcance. Estado inicial de TODOS los tickets: `todo`. No decir «done» sin evidencia. Responsable humano: dos desarrolladores, reparto propuesto frontend/UX y backend/DB, con revisión cruzada.

## Gate G0 — Preparación y estructura [P0]

| ID | Tarea | Depende | Comprobación mínima | Estado actual |
|---|---|---|---|---|
| GH-001 | Crear workspace y repositorio GameHive NUEVO, sin tocar original | — | `git remote -v` apunta al repo nuevo; no se escribió al original | verified |
| GH-002 | Crear React + Vite + TypeScript, React Router, scripts y README Ubuntu | GH-001 | dev/build/typecheck/lint funcionan | verified |
| GH-003 | Configurar Vitest/RTL/Playwright y CI básica | GH-002 | tests de ejemplo ejecutados y reporte de CI | verified |
| GH-004 | Configurar BMAD estable y AGENTS.md, contexto y registros de decisiones | GH-001 | versión verificada, carpetas correctas y guía de uso | verified |
| GH-005 | Definir diseño original, tokens, componentes principales, 2 temas y movimiento reducido | GH-002 | componentes Storybook o vitrina equivalente, accesibilidad básica | verified |
| GH-006 | Configurar service interfaces, tipos de dominio, errores y mocks SOLO de tests | GH-002 | tests de contratos y manejo de estados | verified |

## Gate G1 — Supabase, identidad y roles [P0]

| ID | Tarea | Depende | Comprobación mínima | Estado actual |
|---|---|---|---|---|
| GH-007 | Configurar Supabase CLI/proyecto Free y migraciones PostgreSQL | GH-002 | migración reproducible; sin secrets en repo | verified |
| GH-008 | Diseñar tablas, FKs, índices, checks, constraints y seeds de test | GH-007 | SQL tests FK/UNIQUE/limitaciones | verified |
| GH-009 | Configurar Supabase Auth email+password sin verificación obligatoria en demo | GH-007 | registro/login/logout reales; errores saneados | verified |
| GH-010 | Perfil, alias único case-insensitive, avatar default y onboarding | GH-008,GH-009 | dos cuentas no registran mismo alias; preferencias persisten | verified |
| GH-011 | Cuatro roles y estado verificado independiente; protección RLS | GH-008,GH-009 | escalada de rol denegada en Data API, rutas y servidor | verified |
| GH-012 | Edge Functions para operaciones administrativas necesarias | GH-011 | JWT, estado, rol y auditoría validados | verified |
| GH-013 | Matriz de pruebas RLS y políticas de privacidad/columnas | GH-011 | anon/owner/third/mod/admin combinados | verified |

## Gate G2 — Juegos reales y descubrimiento [P0]

| ID | Tarea | Depende | Comprobación mínima | Estado actual |
|---|---|---|---|---|
| GH-014 | Probar RAWG: 8 juegos reales, límites, licencia, campos | GH-006 | informe de viabilidad y atribución | verified |
| GH-015 | Integrar RAWG vía adaptador seguro y normalización | GH-014 | errores 429/5xx controlados y no claves privadas en bundle | verified |
| GH-016 | Vista Home, Explorar, resultados y filtros combinables | GH-005,GH-015 | búsqueda y filtros reales + empty/loading/error | verified |
| GH-017 | Ficha breve/detallada de juego, imágenes/medios si permitidos, scores separados | GH-015 | ficha con proveedor y sin inventar ratings | verified |
| GH-018 | Incorporar juegos manuales reales del administrador con fuente | GH-011,GH-015 | alta válida y no sobreescribe proveedor | todo |
| GH-019 | Enriquecer Steam/itch.io solo si endpoints oficiales viables | GH-017 | campo de origen y contratos, no scraping | blocked |

## Gate G3 — Reseñas, críticos, votos y comentarios [P0]

| ID | Tarea | Depende | Comprobación mínima | Estado actual |
|---|---|---|---|---|
| GH-020 | Reseña única autor+juego, publicar/editar/ocultar, rating y texto coordinados | GH-011,GH-017 | DB UNIQUE, edición válida, RLS adversarial | todo |
| GH-021 | Vista reseñas con pros/contras, spoiler-free y detalle oculto | GH-020 | lector no ve spoiler sin acción explícita | todo |
| GH-022 | Formulario crítico 8 criterios, ampliación por género y transparencia | GH-020 | cálculo y justificaciones coherentes | todo |
| GH-023 | Solicitud, evaluación administrativa y estado verificado separado | GH-012 | usuario no puede autoverificarse | todo |
| GH-024 | Votos +1/-1 irrevocables, únicos, no propios | GH-020 | duplicado, UPDATE, DELETE y auto-voto rechazados | todo |
| GH-025 | Comentarios/replies con 10h de antigüedad para usuario, 0h crítico | GH-020 | pruebas de 9h59m, 10h y privilegio crítico | todo |
| GH-026 | Agregados separados User/Critic/External con muestras reales | GH-020,GH-022 | sin reseñas = sin score GameHive | todo |

## Gate G4 — Biblioteca, críticos y personalización [P0]

| ID | Tarea | Depende | Comprobación mínima | Estado actual |
|---|---|---|---|---|
| GH-027 | Biblioteca persistente estados/favorito/"Me interesa" | GH-010,GH-017 | cambios desde 2 sesiones | todo |
| GH-028 | Biblioteca pública/privada, RLS de lectura y perfil | GH-027 | no acceso a privada por URL/Data API | todo |
| GH-029 | Recomendaciones basadas en reglas + preferencias onboarding | GH-027 | explicación género/plataforma y sin datos inventados | todo |
| GH-030 | Perfil de crítico y seguidores únicamente a críticos | GH-023 | no se puede seguir cuenta no elegible | todo |
| GH-031 | Ajustes de tema, privacidad, descarga/eliminación de cuenta | GH-010,GH-028 | export personal, borrado/anónimo según reglas | todo |

## Gate G5 — Moderación, reputación y administración [P0]

| ID | Tarea | Depende | Comprobación mínima | Estado actual |
|---|---|---|---|---|
| GH-032 | Reportes de contenido con motivos y severidad, ID estable | GH-020,GH-011 | reportar una reseña válida y rastreable | todo |
| GH-033 | Consola Moderador/Administrador; resolver/ocultar/sancionar | GH-012,GH-032 | permisos diferentes, estado correcto | todo |
| GH-034 | Suspensión oculta reseñas y mantiene pendientes revisables | GH-033 | consulta pública no muestra ocultos | todo |
| GH-035 | Auditoría append-only y notificaciones internas | GH-033 | no UPDATE/DELETE cliente, aviso al afectado | todo |
| GH-036 | Reputación transparente con antispam/penalizaciones | GH-024,GH-033 | test de no auto-incremento/no spam | todo |
| GH-037 | Dashboard Admin: juegos, usuarios/críticos, reportes y métricas verdaderas | GH-018,GH-033 | acciones útiles y datos calculados | todo |

## Gate G6 — Calidad, presentación y despliegue [P0]

| ID | Tarea | Depende | Comprobación mínima | Estado actual |
|---|---|---|---|---|
| GH-038 | Sistema visual completo Persona-inspired ORIGINAL y mascota/loading | GH-005,G3,G4,G5 | UI única, sin assets copiados, reduce-motion | todo |
| GH-039 | Pruebas de integración SQL/RLS y flujos E2E finales | G1–G5 | cuatro cuentas y pruebas negativas | todo |
| GH-040 | Calidad: teclado, contraste, rendimiento desktop y seguridad | GH-038,GH-039 | defectos críticos corregidos o bloqueados explícitamente | todo |
| GH-041 | Publicar en Vercel si propietario lo autoriza | GH-039,GH-040 | URL real, build/redirect y variables seguras | todo |
| GH-042 | README, manual demo, matriz requisitos, pasos Ubuntu, evidencia y PROGRESS | G0–G6 | tercero puede ejecutar demo con permisos | todo |

## P1 — Mejoras condicionadas

- GH-043: ranking mejores del año con criterios comparables.
- GH-044: tráilers, enlaces de tiendas y requisitos técnicos más ricos cuando la API/licencia los permita.
- GH-045: biblioteca avanzada y mejores filtros de precio únicamente con proveedor autorizado.
- GH-046: edición de avatares opcional solo si no rompe presupuesto y seguridad.
- GH-047: animaciones adicionales, sin sacrificar rendimiento ni accesibilidad.

## P2 — Fuera del proyecto final obligatorio

- GH-048: noticias de videojuegos con fuentes permitidas.
- GH-049: integración de más proveedores con mapeo de equivalencias avanzado.
- GH-050: recomendador ML, aplicaciones móviles, listas colaborativas, marketplace y compras — **fuera de alcance** salvo decisión futura.

## Plantilla para ejecutar cada ticket

**Ticket:** GH-XXX  
**Objetivo:** [definición]  
**Dependencias:** [IDs]  
**Código/migraciones:** [rutas previstas]  
**Plan de pruebas:** [unitarias, integración, RLS, e2e]  
**Comandos realmente ejecutados:** [comando + resultado]  
**Incidencias:** [link a qa-reports]  
**Estado:** todo/in_progress/blocked/verified  
**Responsable humano que revisó:** [indicar]

## Política de ritmo

No hacer implementaciones monolíticas que no se puedan probar. Terminar un flujo vertical (pantalla, servicio, SQL, permisos, tests), validar, registrar evidencia y pasar al siguiente. Si faltan claves o permisos, preparar el código y documentar el bloqueo; nunca fingir integración exitosa. Las tareas de integración externa pueden ejecutarse después de preparar G1 y el frontend base, pero las dependencias de seguridad no se saltan.

## Actualización 2026-10-31

Estados con alcance y evidencia en `docs/PROGRESS.md` y `docs/REQUIREMENTS.md`. `verified` en GH-004–006 corresponde a base local G0, no al producto completo. GH-001–006 tienen evidencia local/remota; dev y CI remota pasaron. Catálogo curado es avance local y no cierra G2. Revisión humana de integración todavía pendiente.


## Actualización G2 — 2026-11-01

GH-014 `verified` corresponde únicamente a viabilidad real medida de ocho juegos, campos y condiciones, con atribución enlazada: [G2-RAWG](qa-reports/G2-RAWG.md). No certifica todo G2. GH-015–017 implementados localmente; 89 Vitest + 134 SQL/RLS + concurrencia global/caché pasaron, 5 E2E offline y Auth HTTP G1 conservados. HTTP real Edge→RAWG→DB, cache hit cero gasto e inválidos400 pasaron; E2E real catalog-live pasó búsqueda→Hollow Knight→requisitos/capturas→recarga+axe. Script ocho200 pasó. Correcciones revalidadas: GH-015–017 verified en alcance local; remoto pendiente. Score GameHive depende de G3. Sin publicación de catálogo remoto. [Contrato y operación local](docs/CATALOG.md), [evidencia aislada](qa-reports/G2-IMPLEMENTATION.md).

Cierre de revisión GH-014–017:101Vitest,134SQL y recorrido RAWG real revalidados. Verified se limita a implementación local/proveedor real; no hay catálogo remoto publicado. G1 remoto y limpieza verificados. GH-018 pendiente. GH-019 condicionado documentado en qa-reports/G2-ENRICHMENT.md.
