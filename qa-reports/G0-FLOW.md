# Verificación del flujo G0

Historia: visitante busca un juego → CatalogProvider curado → datos editoriales con fuente → lista/ficha renderizadas. No hay petición a API externa en este modo; se declara sin conexión.

| Frontera | Resultado | Evidencia |
|---|---|---|
| Dev server | pasó | Vite 8.3.5 ready en 151ms, localhost:5173 |
| Navegación → consulta | pasó | navegador /explore?q=Hades mostró 1 juego |
| Contrato → datos | pasó | adaptador y filtros unitarios, paginación/cancelación/regresión lenta |
| Datos → ficha | pasó | clic abre /games/hades, año 2020 y enlace Supergiant |
| Error/empty → UI | pasó | integración con fallo/reintento y búsqueda vacía |
| Consola | pasó | consulta de warn/error devolvió [] en navegación dev |
| Build → navegador | pasó | 4 E2E sobre preview compilada |
| API remota/DB | pendiente | fuera de G0; Supabase/RAWG no conectados |

No hay .env.local; solo plantilla pública. Añadir configuración no habilita Auth automáticamente. La base G0 no depende de recursos remotos: se verificó dev/preview sin enlazar ni modificar Vercel, y se mantiene la precondición de enlazar/verificar entorno para futuras operaciones dependientes de servicios.
