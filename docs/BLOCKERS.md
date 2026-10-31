# Bloqueos observados

Fecha: 2026-10-31, America/Bogota.

| ID | Hecho observado | Efecto | Paso para resolver |
|---|---|---|---|
| B-01 | `gh auth status`: token de KingOwls inválido. Navegador abre login, sin sesión. Conector GitHub reconoce cuenta pero no ofrece crear repositorio. | No creación/push remoto ni CI real. | Humano: `gh auth login -h github.com`, indicar listo; agente crea GameHive nuevo y sube código revisado. No compartir token por chat. |
| B-02 | Usuario eligió proyecto Supabase nuevo; existe una organización accesible `KingOwls's Org`, pendiente de selección explícita exigida por herramienta. | No crear proyecto ni aplicar migración remota. | Confirmar organización; comprobar cuota/coste cero. No reutilizar proyectos anteriores. |
| B-03 | Docker socket devolvió permiso denegado. | Sin entorno local Supabase para SQL/Auth/RLS. | Habilitar Docker para la sesión o usar el proyecto nuevo; verificar antes de migrar. |
| B-04 | No hay clave RAWG configurada en el proyecto nuevo. | Integración y viabilidad API no verificadas. | Configurar clave solo en servidor; ejecutar prueba de 8 juegos y atribución. Catálogo local es curado y explícito. |
| B-05 | Vercel anterior detectado, sin proyecto nuevo vinculado ni despliegue autorizado. | No URL de entrega ni verificación hosting. | En G6 elegir destino y autorizar despliegue después de pasar gates. |

Red npm y localhost inicialmente restringidos: resueltos mediante ejecución con permisos revisados. No son fallos del producto. Alertas de dependencias de desarrollo: ver QA-003.
