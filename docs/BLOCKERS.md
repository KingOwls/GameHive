# Bloqueos observados

Actualizado: 2026-11-01, America/Bogota.

| ID | Hecho observado | Efecto | Paso para resolver |
|---|---|---|---|
| B-01 | Resuelto: gh funciona fuera del sandbox, con sesión KingOwls/keyring válida. El error inicial no acreditaba un token inválido real. | Repositorio creado/push y primera CI exitosa. | No hace falta renovar credenciales. Ver GH-QA-2026-005. |
| B-02 | Resuelto: login CLI, configuración Auth y pruebas autenticadas remotas verificadas. | G1 pasa en GameHive Next. | Cinco cuentas temporales autorizadas y eliminadas; ver G1-REMOTE. Proyectos anteriores intactos. |
| B-03 | Resuelto: Docker 29.4.0 responde fuera del sandbox; el error inicial era del contexto restringido. | Backend local G1 ejecutado con SQL/Auth/Edge/RLS reales. | Ejecutar comandos Docker/Supabase con permisos adecuados, sin cambiar grupos del sistema. |
| B-04 | Resuelto: clave RAWG privada configurada por el humano; ocho fichas y recorrido real local verificados. | Descubrimiento implementado y probado localmente. | RAWG y alta manual autorizados, publicados y verificados en GameHive Next; ver G2-REMOTE. |
| B-05 | Vercel anterior detectado, sin proyecto nuevo vinculado ni despliegue autorizado. | No URL de entrega ni verificación hosting. | En G6 elegir destino y autorizar despliegue después de pasar gates. |

Red npm y localhost inicialmente restringidos: resueltos mediante ejecución con permisos revisados. No son fallos del producto. Alertas de dependencias de desarrollo: ver QA-003.

Advertencia Auth remota: protección contra contraseñas filtradas desactivada; evaluar disponibilidad en Free sin generar cargos. No bloquea las pruebas verificadas, queda pendiente para G6.
