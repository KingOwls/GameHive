# G1 — comprobaciones del proyecto remoto nuevo

Fecha: 2026-10-31 (America/Bogota). Destino único: GameHive Next, ref `krfodhagjzovsebghekm`, organización elegida KingOwls's Org. Coste consultado con get_cost: 0 USD/mes. Creación autorizada por el humano. Los proyectos anteriores no se modificaron.

## Hechos verificados

- Proyecto ACTIVE_HEALTHY, PostgreSQL 17.11.0.011; public inicialmente sin tablas.
- Migración identity aplicada mediante conector después de lectura/revisión SQL y pruebas locales. Las cuatro tablas tienen RLS: public.profiles, public.private_user_settings, private.authz y private.audit_logs.
- Historia remota: la herramienta generó versión 20261101001107. Se comparó el statement completo con el archivo CLI `20261031235359_identity.sql`: coincidencia exacta y una sola entrada. Se alineó únicamente la versión del registro remoto con 20261031235359 mediante transacción protegida por coincidencia de fuente, ausencia de colisión y nombre. Se volvió a consultar la historia: 20261031235359 / identity. No se reaplicó DDL ni modificaron datos de usuarios.
- Data API anon: GET profiles limitado devolvió 200 y lista vacía; GET private_user_settings devolvió 401 / 42501. No se crearon perfiles ni actividad comunitaria ficticia.
- Advisors security: sin WARN/ERROR; dos INFO por tablas privadas con RLS sin políticas. Es denegación por defecto intencional más grants revocados, no exposición pública. [Explicación del aviso de Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Pendiente, sin atribuir éxito

GET Auth settings devolvió signup y email habilitados, mailer_autoconfirm=false. Falta configurar la demo sin confirmación, contraseña mínima y redirects. CLI devolvió AccessTokenRequiredError; se dieron pasos de login seguro al humano. No se usó ni solicitó el token por chat.

Funciones identity y admin-identity desplegadas, ACTIVE v1, después de autorización humana explícita. Ambas usan autenticación interna online y sesión vigente en DB (verify_jwt=false en pasarela). Cuatro pruebas remotas: ausencia de sesión y token inválido en cada función devolvieron 401 con error saneado. No certifica todavía la conexión SQL mediante una sesión válida. Pruebas autenticadas remotas pendientes de configuración Auth. Las pruebas de Auth/cuatro roles locales no certifican el destino remoto. No hay despliegue Vercel.

La clave publicable del destino está en `.env.remote` ignorado, separada del entorno local de pruebas. No contiene service_role, secret ni contraseña de DB. No copiar salida completa de status/API keys a logs o al repositorio.

## Permisos de publicación

La revisión automática rechazó inicialmente ambos despliegues por falta de autorización explícita según AGENTS.md. No se evitó la restricción. El humano autorizó después esas dos funciones únicamente en GameHive Next; solo entonces se repitieron y verificaron los despliegues. Vercel y proyectos anteriores no se modificaron.
