# Matriz de trazabilidad

Estado por ticket, 2026-10-31. `verified` tiene alcance local explícito. Todos los módulos de G1–G6 requieren evidencia de backend/servicios antes de cerrar.

| Ticket | Requisito | Estado | Evidencia / brecha |
|---|---|---|---|
| GH-001 | Crear workspace y repositorio GameHive NUEVO, sin tocar original | verified | Git, origin KingOwls/GameHive y push main comprobados. |
| GH-002 | Crear React + Vite + TypeScript, React Router, scripts y README Ubuntu | verified | Build, lint, tipos, preview y dev pasaron; ver G0-FLOW.md. |
| GH-003 | Configurar Vitest/RTL/Playwright y CI básica | verified | 32 tests Vitest y 4 E2E locales; CI real pasó: actions/runs/41253679920. |
| GH-004 | Configurar BMAD estable y AGENTS.md, contexto y registros de decisiones | verified | BMAD status 6.12.4, 29 skills, renderer/config resolver ejecutados; docs/BMAD.md. |
| GH-005 | Definir diseño original, tokens, componentes principales, 2 temas y movimiento reducido | verified | src/styles.css y /design-system; axe ambos temas, teclado, reduce-motion E2E. |
| GH-006 | Configurar service interfaces, tipos de dominio, errores y mocks SOLO de tests | verified | src/domain, src/services; contrato catálogo y errores probados en tests. |
| GH-007 | Configurar Supabase CLI/proyecto Free y migraciones PostgreSQL | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-008 | Diseñar tablas, FKs, índices, checks, constraints y seeds de test | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-009 | Configurar Supabase Auth email+password sin verificación obligatoria en demo | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-010 | Perfil, alias único case-insensitive, avatar default y onboarding | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-011 | Cuatro roles y estado verificado independiente; protección RLS | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-012 | Edge Functions para operaciones administrativas necesarias | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-013 | Matriz de pruebas RLS y políticas de privacidad/columnas | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-014 | Probar RAWG: 8 juegos reales, límites, licencia, campos | blocked | Términos consultados; sin clave ni prueba de 8 respuestas API (B-04). |
| GH-015 | Integrar RAWG vía adaptador seguro y normalización | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-016 | Vista Home, Explorar, resultados y filtros combinables | in_progress | Búsqueda y filtros de catálogo curado; faltan RAWG/tag/score y G1. |
| GH-017 | Ficha breve/detallada de juego, imágenes/medios si permitidos, scores separados | in_progress | Ficha curada con fuente; faltan metadatos/medios de proveedor. |
| GH-018 | Incorporar juegos manuales reales del administrador con fuente | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-019 | Enriquecer Steam/itch.io solo si endpoints oficiales viables | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-020 | Reseña única autor+juego, publicar/editar/ocultar, rating y texto coordinados | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-021 | Vista reseñas con pros/contras, spoiler-free y detalle oculto | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-022 | Formulario crítico 8 criterios, ampliación por género y transparencia | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-023 | Solicitud, evaluación administrativa y estado verificado separado | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-024 | Votos +1/-1 irrevocables, únicos, no propios | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-025 | Comentarios/replies con 10h de antigüedad para usuario, 0h crítico | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-026 | Agregados separados User/Critic/External con muestras reales | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-027 | Biblioteca persistente estados/favorito/"Me interesa" | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-028 | Biblioteca pública/privada, RLS de lectura y perfil | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-029 | Recomendaciones basadas en reglas + preferencias onboarding | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-030 | Perfil de crítico y seguidores únicamente a críticos | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-031 | Ajustes de tema, privacidad, descarga/eliminación de cuenta | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-032 | Reportes de contenido con motivos y severidad, ID estable | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-033 | Consola Moderador/Administrador; resolver/ocultar/sancionar | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-034 | Suspensión oculta reseñas y mantiene pendientes revisables | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-035 | Auditoría append-only y notificaciones internas | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-036 | Reputación transparente con antispam/penalizaciones | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-037 | Dashboard Admin: juegos, usuarios/críticos, reportes y métricas verdaderas | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-038 | Sistema visual completo Persona-inspired ORIGINAL y mascota/loading | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-039 | Pruebas de integración SQL/RLS y flujos E2E finales | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-040 | Calidad: teclado, contraste, rendimiento desktop y seguridad | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-041 | Publicar en Vercel si propietario lo autoriza | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
| GH-042 | README, manual demo, matriz requisitos, pasos Ubuntu, evidencia y PROGRESS | todo | Pendiente; criterio de aceptación en BACKLOG.md, dependencias sin verificar. |
