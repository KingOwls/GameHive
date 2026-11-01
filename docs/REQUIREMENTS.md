# Matriz de trazabilidad

Estado por ticket, actualizado G2 el 2026-11-01. `verified` tiene alcance local explícito. Todos los módulos de G1–G6 requieren evidencia de backend/servicios antes de cerrar.

| Ticket | Requisito | Estado | Evidencia / brecha |
|---|---|---|---|
| GH-001 | Crear workspace y repositorio GameHive NUEVO, sin tocar original | verified | Git, origin KingOwls/GameHive y push main comprobados. |
| GH-002 | Crear React + Vite + TypeScript, React Router, scripts y README Ubuntu | verified | Build, lint, tipos, preview y dev pasaron; ver G0-FLOW.md. |
| GH-003 | Configurar Vitest/RTL/Playwright y CI básica | verified | 32 tests Vitest y 4 E2E locales; CI real pasó: actions/runs/41253679920. |
| GH-004 | Configurar BMAD estable y AGENTS.md, contexto y registros de decisiones | verified | BMAD status 6.12.4, 29 skills, renderer/config resolver ejecutados; docs/BMAD.md. |
| GH-005 | Definir diseño original, tokens, componentes principales, 2 temas y movimiento reducido | verified | src/styles.css y /design-system; axe ambos temas, teclado, reduce-motion E2E. |
| GH-006 | Configurar service interfaces, tipos de dominio, errores y mocks SOLO de tests | verified | src/domain, src/services; contrato catálogo y errores probados en tests. |
| GH-007 | Configurar Supabase CLI/proyecto Free y migraciones PostgreSQL | verified | SQL/RLS, HTTP/E2E local y CI pasaron; Auth remoto de cuatro roles/sesiones/auditoría y limpieza de cinco cuentas verificados (G1-REMOTE). |
| GH-008 | Diseñar tablas, FKs, índices, checks, constraints y seeds de test | verified | SQL/RLS, HTTP/E2E local y CI pasaron; Auth remoto de cuatro roles/sesiones/auditoría y limpieza de cinco cuentas verificados (G1-REMOTE). |
| GH-009 | Configurar Supabase Auth email+password sin verificación obligatoria en demo | verified | SQL/RLS, HTTP/E2E local y CI pasaron; Auth remoto de cuatro roles/sesiones/auditoría y limpieza de cinco cuentas verificados (G1-REMOTE). |
| GH-010 | Perfil, alias único case-insensitive, avatar default y onboarding | verified | SQL/RLS, HTTP/E2E local y CI pasaron; Auth remoto de cuatro roles/sesiones/auditoría y limpieza de cinco cuentas verificados (G1-REMOTE). |
| GH-011 | Cuatro roles y estado verificado independiente; protección RLS | verified | SQL/RLS, HTTP/E2E local y CI pasaron; Auth remoto de cuatro roles/sesiones/auditoría y limpieza de cinco cuentas verificados (G1-REMOTE). |
| GH-012 | Edge Functions para operaciones administrativas necesarias | verified | SQL/RLS, HTTP/E2E local y CI pasaron; Auth remoto de cuatro roles/sesiones/auditoría y limpieza de cinco cuentas verificados (G1-REMOTE). |
| GH-013 | Matriz de pruebas RLS y políticas de privacidad/columnas | verified | SQL/RLS, HTTP/E2E local y CI pasaron; Auth remoto de cuatro roles/sesiones/auditoría y limpieza de cinco cuentas verificados (G1-REMOTE). |
| GH-014 | Probar RAWG: 8 juegos reales, límites, licencia, campos | verified | Viabilidad real de ocho juegos y términos/atribución: G2-RAWG.md. Alcance proveedor, no flujo G2 completo. |
| GH-015 | Integrar RAWG vía adaptador seguro y normalización | verified | Verificado localmente con RAWG real, revisión BMAD y revalidación final101Vitest/134SQL/E2E real; G2-RAWG. Publicación RAWG remota verificada (G2-REMOTE). Score propio depende deG3. |
| GH-016 | Vista Home, Explorar, resultados y filtros combinables | verified | Verificado localmente con RAWG real, revisión BMAD y revalidación final101Vitest/134SQL/E2E real; G2-RAWG. Publicación RAWG remota verificada (G2-REMOTE). Score propio depende deG3. |
| GH-017 | Ficha breve/detallada de juego, imágenes/medios si permitidos, scores separados | verified | Verificado localmente con RAWG real, revisión BMAD y revalidación final101Vitest/134SQL/E2E real; G2-RAWG. Publicación RAWG remota verificada (G2-REMOTE). Score propio depende deG3. |
| GH-018 | Incorporar juegos manuales reales del administrador con fuente | verified | Alta/lectura local verificada; revisión BMAD y parches,141 Vitest/178 SQL,3 Deno/DB y HTTP/E2E real pasaron (G2-MANUAL). Publicación manual remota y limpieza verificadas (G2-REMOTE). |
| GH-019 | Enriquecer Steam/itch.io solo si endpoints oficiales viables | blocked | Condicionado por endpoints/acceso: investigación oficial G2-ENRICHMENT; ninguna integración ni scraping. |
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

Cierre de revisión GH-014–017:101Vitest,134SQL y recorrido RAWG real revalidados. Verified se limita a implementación local/proveedor real; no hay catálogo remoto publicado. G1 remoto y limpieza verificados. GH-018 pendiente. GH-019 condicionado documentado en qa-reports/G2-ENRICHMENT.md.

Actualización GH-018: implementación local y pruebas detalladas en [G2-MANUAL](../qa-reports/G2-MANUAL.md). Publicación RAWG remota autorizada y verificada por coordinador en [G2-REMOTE](../qa-reports/G2-REMOTE.md), posterior a las notas históricas de publicación pendiente. El alta manual requiere autorización remota separada.

GH-018 HTTP/E2E locales reales confirmados por coordinador:1HTTP+1navegador PASS, concurrencia/auditoría única, permisos/sesión, documento RAWG idéntico, ficha visitante+recarga+axe y limpieza exacta. Revisión BMAD independiente pendiente.

Cierre GH-018 local: revisión BMAD y revalidación final completas, ver G2-MANUAL. Verified describe código y backend local real, no despliegue manual remoto. RAWG sí está publicado y probado en GameHive Next (G2-REMOTE). G2 permanece in_progress hasta publicar/verificar el alta manual; G3–G6 pendientes.


Actualización remota GH-018: migración/admin-games publicados con permiso explícito, HTTP real de roles/concurrencia/privilegios/sesiones y ficha pública en navegador con recarga/axe pasaron; limpieza comprobada. G2-REMOTE sustituye pendientes históricos de publicación. Scores/filtro propio siguen dependiendo de G3.
