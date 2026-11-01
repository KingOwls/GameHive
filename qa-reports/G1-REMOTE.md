# G1 — comprobaciones del proyecto remoto nuevo

Actualizado: 2026-11-01 (America/Bogota). Destino único: GameHive Next, ref `krfodhagjzovsebghekm`, organización elegida KingOwls's Org. Coste consultado con get_cost: 0 USD/mes. Creación autorizada por el humano. Los proyectos anteriores no se modificaron.

## Hechos verificados

- Proyecto ACTIVE_HEALTHY, PostgreSQL 17.11.0.011; public inicialmente sin tablas.
- Migración identity aplicada mediante conector después de lectura/revisión SQL y pruebas locales. Las cuatro tablas tienen RLS: public.profiles, public.private_user_settings, private.authz y private.audit_logs.
- Historia remota: la herramienta generó versión 20261101001107. Se comparó el statement completo con el archivo CLI `20261031235359_identity.sql`: coincidencia exacta y una sola entrada. Se alineó únicamente la versión del registro remoto con 20261031235359 mediante transacción protegida por coincidencia de fuente, ausencia de colisión y nombre. Se volvió a consultar la historia: 20261031235359 / identity. No se reaplicó DDL ni modificaron datos de usuarios.
- Data API anon: GET profiles limitado devolvió 200 y lista vacía; GET private_user_settings devolvió 401 / 42501. No se crearon perfiles ni actividad comunitaria ficticia.
- Advisors security: sin WARN/ERROR; dos INFO por tablas privadas con RLS sin políticas. Es denegación por defecto intencional más grants revocados, no exposición pública. [Explicación del aviso de Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Auth y funciones verificadas

El humano completó login CLI el 2026-11-01. Se revisó un config diff mínimo y se aplicaron exactamente cuatro propiedades a krfodhagjzovsebghekm: enable_confirmations=false, minimum_password_length=12, site_url127.0.0.1:5173 y redirects locales4173/localhost. CLI confirmó cuatro cambios y siete propiedades no declaradas intactas. No se usó ni solicitó token por chat.

Funciones identity y admin-identity desplegadas, ACTIVE v1, después de autorización humana explícita. Ambas usan autenticación interna online y sesión vigente en DB (verify_jwt=false en pasarela). Cuatro pruebas remotas: ausencia de sesión y token inválido en cada función devolvieron 401 con error saneado. La conexión SQL con sesiones válidas se comprobó mediante las pruebas siguientes. El humano autorizó cinco cuentas temporales y su limpieza. El script preparado conserva contraseñas/tokens solo en memoria; los IDs de limpieza son datos sintéticos, no credenciales. Las pruebas de Auth/cuatro roles locales no certifican el destino remoto. No hay despliegue Vercel.

La clave publicable del destino está en `.env.remote` ignorado, separada del entorno local de pruebas. No contiene service_role, secret ni contraseña de DB. No copiar salida completa de status/API keys a logs o al repositorio.

## Permisos de publicación

La revisión automática rechazó inicialmente ambos despliegues por falta de autorización explícita según AGENTS.md. No se evitó la restricción. El humano autorizó después esas dos funciones únicamente en GameHive Next; solo entonces se repitieron y verificaron los despliegues. Vercel y proyectos anteriores no se modificaron.

## Permiso para fixtures remotas

La revisión automática rechazó crear cinco cuentas y conservar sus credenciales temporalmente por falta de aprobación explícita para ese efecto remoto. No se ejecutó el comando rechazado. Se preparó una alternativa sin persistir contraseñas/tokens; el humano autorizó expresamente crear cinco cuentas y eliminarlas. Solo entonces se ejecutaron las pruebas y la limpieza.

## Flujo autenticado remoto — PASS

Se crearon cinco cuentas sintéticas bajo un prefijo único @example.invalid. Contraseñas y JWT solo en memoria del proceso; no se enviaron correos. Todas recibieron user/criticVerified=false aunque el alta intentó metadata admin/verificado. El operador de pruebas asignó critic/moderator/admin únicamente a tres IDs de estas fixtures, con guardia de prefijo; los otros dos siguieron user.

Pasaron: identidad de los cuatro roles; preferencias privadas inaccesibles para anon, tercero, critic, moderator y admin; escritura por dueño; segunda sesión y refresh real; preferencias persistentes; reputación no editable por ninguno de los cuatro roles desde Data API; administración denegada para user/critic/moderator y para autoasignación admin; cambio autorizado a critic reflejado sin depender de metadata antigua; revocación de una sesión sin afectar la otra; JWT revocado sin acceso/escritura; suspensión con JWT aún emitido sin acceso/escritura; contraseña incorrecta sin sesión; logout de todas las sesiones. La DB confirmó dos identity.update auditadas (cambio de rol y suspensión).

Limpieza: borradas exactamente las cinco auth.users autorizadas, restringiendo IDs y correo sintético. Consulta posterior: users_left=0, profiles_left=0, authority_left=0, settings_left=0. El proceso terminó y el archivo temporal con IDs de limpieza se eliminó. Auditoría mínima conservada por diseño con referencias anonimizadas. Un primer intento de limpieza caducó en el conector sin ejecutarse; se repitió y se verificó.

Preparación de fixture: una consulta inicial rechazó texto→enum account_role; se corrigió el cast explícito y la transacción válida confirmó los cinco roles esperados. No fue un defecto del endpoint de aplicación. G1 verificado localmente y en este destino; no certifica módulos comunitarios ni hosting Vercel.
