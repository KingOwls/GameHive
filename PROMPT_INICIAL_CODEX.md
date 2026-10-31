# PROMPT INICIAL PARA CODEX — GAMEHIVE

Copia el texto siguiente en Codex **después de abrir la carpeta de un proyecto NUEVO y colocar estos documentos dentro**. Alternativamente, adjunta los archivos a Codex si tu entorno lo permite.

---

Quiero que actúes como ingeniero principal y coordinador de implementación de **GameHive**, un proyecto web universitario para descubrimiento y reseñas de videojuegos. Tu encargo es construir una implementación completa y verificable **desde cero** siguiendo los archivos `GAMEHIVE_MASTER_SPEC.md`, `AGENTS.md` y `BACKLOG.md` de este workspace.

**Restricción irreversible:** `https://github.com/KingOwls/ProjectWebVideoGame` es únicamente referencia **DE LECTURA**. No hagas commits, ramas, issues, cambios, forks automáticos ni despliegues desde ese repositorio. No copies código ni imágenes originales. Trabaja en el directorio nuevo actual; si necesitas publicarlo, solicita acceso/autorización para crear un REPOSITORIO DIFERENTE bajo KingOwls.

**Stack:** React + Vite, TypeScript si es viable, Supabase Auth + PostgreSQL + RLS + Edge Functions, Vercel, RAWG (y otras APIs oficiales solo si tienen cobertura/uso permitido). **NO Firebase, NO servicios de pago, NO scraping.** Cuatro roles: Usuario, Crítico, Moderador y Administrador. Interfaz escritorio muy expresiva, con personalidad propia, inspirada conceptualmente en animaciones y tipografía de Persona 3 Reload/Persona 5, sin copiar diseño ni assets protegidos. Modo oscuro/claro/sistema y carga con mascotita original ligera.

**Resultado obligatorio:** cinco flujos completos y persistentes: (1) buscar juego REAL y ver ficha; (2) registro, publicar y editar UNA reseña por juego; (3) roles y solicitudes de críticos; (4) biblioteca pública/privada y preferencias; (5) reportar → moderar → sancionar/notificar/auditar. Las reseñas y puntuaciones de comunidad deben venir de interacciones verdaderas, no ser inventadas. Noticias es trabajo futuro.

**Tu modo de ejecución:**
1. Inspecciona el workspace, lee los tres archivos y anota contradicciones importantes. Usa la especificación final como fuente principal sobre el documento académico pasado.
2. Comprueba herramientas, versiones y documentación vigente. Prepara el plan por gates G0–G6 de `BACKLOG.md`, con dependencias y criterios de salida. Apóyate en BMAD Method **estable** y verifica comandos reales antes de instalarlos; si no puedes instalarlo, conserva el flujo de trabajo en docs.
3. Comienza IMPLEMENTANDO G0 en el directorio nuevo: estructura React/Vite, scripts, `AGENTS.md`, README, componentes básicos, diseño/tokens, CI y tests de arranque. Sigue implementando las siguientes fases dentro de las capacidades disponibles, sin detenerte tras entregar solamente el plan.
4. Implementa verticalmente y haz pruebas reales tras cada cambio. En Supabase, crea migraciones SQL, constraints, RLS y tests adversariales; usa acceso privilegiado solo en operaciones protegidas. Nunca expongas secrets/service_role. No afirmes que una conexión a Supabase o RAWG funciona si no se probó.
5. Con cada avance, actualiza `docs/PROGRESS.md` y el backlog. Si una prueba falla, guarda un informe reproducible `.md` en `qa-reports/` y revalida. No des por terminada una funcionalidad con botones inertes, datos ficticios ocultos o errores críticos de seguridad.
6. Si falta credencial, cuenta, Docker, acceso a proveedor o autorización externa, prepara todos los archivos necesarios, pruebas locales y `.env.example`; deja el bloqueo escrito con instrucciones exactas para el responsable de infraestructura. **No solicites que se peguen secretos en el chat.**
7. No despliegues ni publiques en servicios externos sin aprobación del responsable. Revisa límites gratuitos y términos de proveedor. Conserva el workspace listo para retomar entre sesiones.
8. Entrega en cada fase: resumen de archivos, qué requisitos satisface, comandos y resultados ejecutados, fallos/limitaciones, estado de gates y el siguiente trabajo concreto. Puedes trabajar en múltiples iteraciones de Codex; no sacrifiques verificabilidad para aparentar completar todo en una sola acción.

**Empieza ahora revisando el contenido de los archivos, creando `docs/PROGRESS.md` y ejecutando el primer gate G0. Si el directorio contiene un repositorio conectado al original, detente antes de escribir y explícame cómo aislar un directorio nuevo sin tocar ese repositorio.**

---

## Primeras acciones humanas antes de ejecutar

1. Crear una **carpeta vacía diferente** del repositorio de referencia (por ejemplo `~/Escritorio/GameHive-Final/`).
2. Colocar en ella `GAMEHIVE_MASTER_SPEC.md`, `AGENTS.md`, `BACKLOG.md` y `PROMPT_INICIAL_CODEX.md`.
3. Abrir Codex/tu editor con esa carpeta como workspace. Verificar visualmente la ruta y que no sea `ProjectWebVideoGame`.
4. Ejecutar el prompt completo anterior. No crear todavía keys ni desactivar protecciones.
5. El encargado de infraestructura creará/autorizará el proyecto nuevo Supabase y el despliegue Vercel cuando corresponda; guardará secretos en gestores de entorno, no en Git.

## Documentación adicional disponible

Documento académico de referencia entregado por el usuario: `GameHive_Proyecto_Web_DESCARGABLE.docx`. Si está disponible para Codex, consultarlo en modo lectura para detalles de las catorce pantallas y requisitos previos; no repetir M1/M2, que ya fueron entregados.
