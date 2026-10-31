# ADR-001 — Base independiente y servicios por contratos

Fecha: 2026-10-31. Estado: adoptada para G0.

React/Vite/TypeScript + Router y CSS propio. Contratos `CatalogProvider`, `Game`, `Resource` y `ServiceError` separan pantalla/proveedor. Supabase SDK fijado con lockfile, todavía no conectado. RAWG se integrará por un adaptador servidor con secretos fuera del cliente. Catálogo curado permitido por §8 de la especificación; sin portadas de terceros, ratings ni comunidad ficticia. Las fuentes están junto a cada juego. Los textos son resúmenes originales.

No se usó el repositorio de referencia. Los documentos del ZIP son requisitos, no código reutilizado. No se establece licencia para documentación aportada ni para todo el producto sin decisión del titular. Dependencias y sus licencias se registran aparte.

El proyecto Supabase existente y el proyecto Vercel `gamehive-beta` quedan intactos. Decisión humana: preparar Supabase nuevo. Ninguna credencial de esos servicios se copió al workspace.

La validación TypeScript de edad/nota sirve a UX; no concede privilegios ni sustituye SQL/RLS. No publicar acciones comunitarias hasta verificar el backend.
