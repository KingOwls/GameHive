# Bloqueos observados

Fecha: 2026-10-31, America/Bogota.

| ID | Hecho observado | Efecto | Paso para resolver |
|---|---|---|---|
| B-01 | Resuelto: gh funciona fuera del sandbox, con sesión KingOwls/keyring válida. El error inicial no acreditaba un token inválido real. | Repositorio creado/push y primera CI exitosa. | No hace falta renovar credenciales. Ver GH-QA-2026-005. |
| B-02 | Resuelto en cuanto a selección: humano aprobó KingOwls's Org y coste cero; orquestador creó GameHive Next. | Migración aplicada y funciones ACTIVE; configuración Auth y flujo autenticado remoto pendientes del login CLI. | En GameHive ejecutar npx supabase login, completar navegador y responder «Supabase listo» sin compartir token. Destino único krfodhagjzovsebghekm; no reutilizar proyectos anteriores. |
| B-03 | Resuelto: Docker 29.4.0 responde fuera del sandbox; el error inicial era del contexto restringido. | Backend local G1 ejecutado con SQL/Auth/Edge/RLS reales. | Ejecutar comandos Docker/Supabase con permisos adecuados, sin cambiar grupos del sistema. |
| B-04 | No hay clave RAWG configurada en el proyecto nuevo. | Integración y viabilidad API no verificadas. | Configurar clave solo en servidor; ejecutar prueba de 8 juegos y atribución. Catálogo local es curado y explícito. |
| B-05 | Vercel anterior detectado, sin proyecto nuevo vinculado ni despliegue autorizado. | No URL de entrega ni verificación hosting. | En G6 elegir destino y autorizar despliegue después de pasar gates. |

Red npm y localhost inicialmente restringidos: resueltos mediante ejecución con permisos revisados. No son fallos del producto. Alertas de dependencias de desarrollo: ver QA-003.
