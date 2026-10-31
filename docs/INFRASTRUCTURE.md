# Infraestructura y límites externos

## Supabase nuevo

No reutilizar los dos proyectos detectados. La selección de organización está pendiente de respuesta humana. Antes de crear, comprobar cuota gratuita y coste con herramientas oficiales; no aceptar ningún coste distinto de cero. Preparar nuevo proyecto académico, región cercana al equipo, sin copiar datos del original.

Secuencia G1: CLI `--help` → configuración local/migración → SQL/RLS local → proyecto nuevo autorizado → migración revisada → Auth email/contraseña y configuración de confirmación → obtener URL/clave publicable → pruebas Data API con cuatro cuentas. El índice único del alias normalizado y la inicialización de roles deben ocurrir transaccionalmente en servidor. Contraseñas y claves privadas no entran al código ni a evidencias.

Docker devolvió permiso denegado al consultar su socket; no se ejecutó `supabase start`, reset ni migración. Resolver acceso a Docker o usar el proyecto nuevo. No cambiar grupos del sistema silenciosamente.

## Vercel

Se detectó `gamehive-beta`, cuya relación con el trabajo previo no se ha confirmado; no se modificó. Para el nuevo frontend, tras autorizar despliegue y elegir proyecto: enlazarlo, verificar entorno y solo después ejecutar operaciones dependientes de recursos. `vercel.json` prepara build, salida SPA y headers; no acredita comportamiento remoto. La publicación G6 depende de G1–G5 y autorización.

## RAWG

La documentación consultada exige clave por petición y atribución/backlinks; el plan gratuito se limita a proyectos no comerciales y hasta 20000 peticiones/mes al consultar el 2026-10-31. No se comprobaron ocho respuestas API: falta clave. No depender de vídeos, enlaces de tienda, similares ni precios como parte gratuita garantizada. Crear adaptador seguro, timeout/cache/rate limit y prueba de campos antes de habilitar integración.

Fuentes: https://rawg.io/apidocs, https://supabase.com/docs/guides/database/postgres/row-level-security, https://supabase.com/docs/guides/getting-started/api-keys, https://vercel.com/docs/frameworks/frontend/vite.
