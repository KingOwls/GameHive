# Identidad G1 — instalación y verificación

La migración crea solo identidad: no habilita reseñas, biblioteca o moderación. La configuración CLI se generó con `supabase init`, y la migración con `supabase migration new identity`.

## Local

Requiere Docker y CLI instalada en npm. No usar conexiones ni claves de otros proyectos. `project_id = "gamehive"`; contenedores con sufijo `_gamehive`.

```bash
npx supabase start --exclude studio,storage-api,imgproxy,realtime,logflare,vector,supavisor
npx supabase db reset --local
npm run test:sql
npx supabase db lint --local
npx supabase db advisors --local --type security --level warn
npm run test:backend -- --e2e
npx supabase stop
```

`db reset --local` elimina exclusivamente los datos del stack local; no ejecutarlo con `--linked`. El helper backend captura status en memoria, exige URL loopback y clave publicable, nunca imprime credenciales. Provisiona cuatro roles solo dentro de pruebas usando operador DB local y limpia las cuentas aisladas. La configuración Vite se pasa solo al proceso build de E2E. Para desarrollo manual, copiar únicamente URL pública y publishable a `.env.local` ignorado; no pegar salida completa de status en chats o reportes.

La CLI puede imprimir claves en start/status y publica puertos en todas las interfaces en esta versión, incluso con host_binding de la red Docker. No redirigir esos logs a archivos versionados, no compartirlos y detener el stack al terminar. El arranque temporal no acredita una configuración segura para exponer a red.

## Modelo y confianza

`profiles`: público, sin email. `private_user_settings`: solo dueño activo con sesión existente, incluso si el tercero es admin/moderator. `private.authz`: rol, estado y verificación; aislado de Data API. `private.audit_logs`: autoridad y registro de cambios solo mediante operación transaccional controlada.

El trigger de registro toma únicamente username de user_metadata e ignora cualquier autoridad; falla toda la transacción si alias/constraints no pasan. El frontend sanea errores de registro sin revelar correos existentes.

Edge valida JWT mediante `getUser`, extrae el session_id firmado y lo comprueba en DB. La operación administrativa verifica admin activo/sesión vigente, bloquea autoedición y serializa cambios; actualización y auditoría se ejecutan en una transacción. No hay grants de ejecución API sobre estas funciones privadas. `SUPABASE_DB_URL` permanece exclusivamente en runtime Edge; nunca VITE. Driver Deno postgresjs fijado v3.4.5 (proyecto porsager/postgres, licencia Unlicense) por fallo de DNS reproducido con driver npm en el runtime local. La URL versionada evita depender de latest.

Primer admin: operador confiable identifica UUID de una cuenta Auth real y actualiza `private.authz` mediante canal DB seguro, dejando evidencia administrativa sin datos sensibles. Nunca desde metadata, signup ni UI. No se incluye contraseña/cuenta admin predefinida en seed.

## Remoto

Aplicación por orquestador tras revisión, al proyecto nuevo autorizado exclusivamente. Restringir Data API a public y verificar email provider/signup habilitados, confirmación de email según decisión académica (desactivada), longitud mínima contraseña 12, URL/redirects del frontend, funciones identity/admin-identity y secretos por defecto disponibles. `verify_jwt=false` permite el handler moderno de verificación online; no implica endpoint anónimo autorizado.

Repetir negativos Data API/cuatro roles y advisors en el destino. Las pruebas locales no certifican por sí solas configuración ni disponibilidad remotas. Revisar el coste antes de cualquier recurso adicional; esta implementación no requiere plan de pago.
