# AGENTS.md — Instrucciones permanentes de Codex para GameHive

## Lectura inicial obligatoria

Antes de planificar o editar código, leer `GAMEHIVE_MASTER_SPEC.md`, `BACKLOG.md`, `docs/PROGRESS.md` (si existe) y las instrucciones pertinentes de BMAD. Si hay conflicto, prevalecen instrucciones humanas directas, seguridad y decisiones explícitas de la especificación. No reabrir acuerdos decididos sin identificar una incompatibilidad verificable.

## Zona estricta de trabajo

- Trabajar **solo en el repositorio NUEVO GameHive** y su directorio actual. El repositorio `KingOwls/ProjectWebVideoGame` es fuente de lectura y NO puede ser editado de ninguna forma: ni commits, ramas, issues, PRs, workflows, releases o despliegues.
- No copiar código/recursos del original sin comprobar permiso y licencia; programar una implementación independiente.
- No sobrescribir directorios ni borrar archivos sin comprobar contenido y propósito.
- No ejecutar acciones destructivas ni crear proyectos en servicios externos sin autorización explícita. No desplegar, publicar ni generar cargos sin permiso.

## Stack, arquitectura y alcance

- React + Vite; priorizar TypeScript, componentes accesibles y CSS propio; frontend desktop-first con tema Sistema/Claro/Oscuro (fallback oscuro) y movimiento reducido.
- Supabase Auth + PostgreSQL + RLS; Edge Functions para lógica sensible; Vercel para alojamiento final; RAWG catálogo inicial sujeto a condiciones de uso. **No Firebase.**
- Cuatro roles: `user`, `critic`, `moderator`, `admin`. `critic_verified` es estado separado, no privilegio automático.
- Cinco flujos P0: buscar juegos reales, reseñar, roles, biblioteca personal y reportes/moderación; noticias fuera de P0.
- Presupuesto cero: no contratar servicios pagados ni usar API con licencia incompatible. No suponer que un proveedor ofrece vídeos/precios.
- Diseño original inspirado solo conceptualmente en Persona 3 Reload/Persona 5: sin plagio de assets, tipografías protegidas o interfaces exactas.

## Seguridad y privacidad

- **RLS obligatoria** en toda tabla expuesta; probar políticas de lectura/escritura/actualización/borrado para dueño, tercero, moderador, admin y anon.
- No exponer secretos, Supabase secret/service-role keys, tokens privados ni credenciales en cliente Vite, git, logs, reportes o archivos de ejemplo. `VITE_` solo para valores diseñados para ser públicos.
- No usar `user_metadata` como fuente de autoridad. Validar rol/estado en backend. No confiar únicamente en ocultar botones.
- Cambios de roles, sanciones, reputación, moderación y agregados: operaciones controladas y auditadas. Evitar SECURITY DEFINER salvo necesidad revisada y permisos explícitos.
- Respetar unicidad de una reseña por usuario+juego, un voto irreversible por votante+reseña y privacidad de biblioteca.
- Datos reales de catálogo y datos comunitarios realmente creados en pruebas. Mocks solo para pruebas aisladas o como modo degradado claramente etiquetado.

## Flujo de ejecución

1. Elegir el ticket P0 de mayor prioridad con dependencias satisfechas desde `BACKLOG.md`.
2. Escribir mini-plan, rutas/archivos afectados, riesgos y criterios de aceptación antes de cambios no triviales.
3. Implementar cambios pequeños y coherentes. Documentar dependencias nuevas y verificar su vigencia/licencia.
4. Escribir pruebas junto con código; RLS, SQL y permisos si se toca persistencia.
5. Ejecutar los comandos reales disponibles (`npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, pruebas E2E/SQL cuando corresponda). Si aún no existen, crearlos en el setup; nunca afirmar ejecución ficticia.
6. Registrar defectos en `qa-reports/` con hechos reproducibles, clasificación y solución; revalidar.
7. Actualizar `docs/PROGRESS.md`, matriz de requisitos y `BACKLOG.md`. Marcar `verified` solo con evidencia.
8. Describir en la respuesta final: cambios, archivos, pruebas reales y resultado, bloqueos y próximo ticket.

## Reglas de código

- Código en inglés (nombres y APIs) y textos UI en español; explicaciones/documentos para equipo en español.
- Tipos explícitos de dominio; interfaces de servicios; funciones pequeñas; componentes reutilizables.
- Usar constraints/índices/transacciones SQL para integridad; preferir acceso mínimo y consultas paginadas.
- Estados visibles normal/loading/empty/error. Controles deben tener funcionalidad real. Evitar imports circulares y datos duplicados.
- Accesibilidad: labels, foco visible, semántica, navegación teclado, contraste, `prefers-reduced-motion`.
- Tests: límites, condiciones de carrera, permisos adversariales, XSS, duplicados, fallos de proveedor.

## BMAD y especialidades

Si BMAD se instala, primero consultar comandos reales y versionado y operar sus flujos compatibles; no inventar IDs. Los especialistas sugeridos son Orchestrator, UX Motion, React, Catálogo API, Supabase/Postgres Seguridad, Comunidad, QA y Release/Docs. Son roles lógicos: no declarar agentes o Skills instalados sin verificarlos.

## Bloqueos

Si faltan cuentas, clave RAWG, Supabase, accesos Vercel o configuración GitHub: preparar infraestructura por código, `.env.example`, documentación y pruebas locales; registrar `BLOCKED` con paso concreto que debe realizar el humano. NO inventar URL, credenciales, disponibilidad ni éxito de despliegue. Si una función no es viable gratis, simplificar preservando el flujo P0 y explicarlo.

## Cierre de fase

Una fase P0 solo queda completa cuando: requisitos enlazados + código funcional + pruebas ejecutadas + seguridad verificada + documento de avance actualizado. En caso contrario conservar `in_progress` o `blocked` y explicar la brecha.
