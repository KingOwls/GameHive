# Infraestructura y límites externos

## Supabase nuevo

No reutilizar los dos proyectos detectados. El humano eligió KingOwls's Org; se consultó coste cero y se creó GameHive Next (krfodhagjzovsebghekm, us-east-1). Migración identity aplicada y funciones identity/admin-identity ACTIVE tras autorización explícita. Configuración Auth y pruebas autenticadas remotas de cuatro roles/sesiones verificadas; cinco cuentas temporales eliminadas; ver qa-reports/G1-REMOTE.md.

Secuencia G1: CLI `--help` → configuración local/migración → SQL/RLS local → proyecto nuevo autorizado → migración revisada → Auth email/contraseña y configuración de confirmación → obtener URL/clave publicable → pruebas Data API con cuatro cuentas. El índice único del alias normalizado y la inicialización de roles deben ocurrir transaccionalmente en servidor. Contraseñas y claves privadas no entran al código ni a evidencias.

Docker 29.4.0 responde fuera del sandbox. G1 se verificó con start/reset/migración, 43 pgTAP y Auth/HTTP/E2E reales, también en CI. No cambiar grupos del sistema. La CLI publica puertos en todas las interfaces en este entorno; apagar solo el stack gamehive al terminar.

## Vercel

Se detectó `gamehive-beta`, cuya relación con el trabajo previo no se ha confirmado; no se modificó. Para el nuevo frontend, tras autorizar despliegue y elegir proyecto: enlazarlo, verificar entorno y solo después ejecutar operaciones dependientes de recursos. `vercel.json` prepara build, salida SPA y headers; no acredita comportamiento remoto. La publicación G6 depende de G1–G5 y autorización.

## RAWG

La documentación consultada exige clave por petición y atribución/backlinks; el plan gratuito se limita a proyectos no comerciales y hasta 20000 peticiones/mes al consultar el 2026-10-31. Clave configurada el 2026-11-01 en .env.server.local ignorado; ocho fichas reales y flujo React→Edge→RAWG→DB comprobados localmente; catálogo RAWG remoto publicado y probado tras autorización; alta manual remota pendiente de autorización separada. No depender de vídeos, enlaces de tienda, similares ni precios como parte gratuita garantizada. Crear adaptador seguro, timeout/cache/rate limit y prueba de campos antes de habilitar integración.

Fuentes: https://rawg.io/apidocs, https://supabase.com/docs/guides/database/postgres/row-level-security, https://supabase.com/docs/guides/getting-started/api-keys, https://vercel.com/docs/frameworks/frontend/vite.
