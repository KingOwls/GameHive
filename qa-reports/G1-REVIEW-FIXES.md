# G1 — correcciones de revisión

2026-10-31. Cambios locales sin modificar la migración inicial ni operar remoto.

- Logout conserva reintento ante fallo de red; limpia ante 401/403/404 o `AuthSessionMissingError`, incluyendo el 400 real que Auth devuelve al repetir logout de una sesión revocada. Prueba de navegador pierde ACK después de revocar en servidor y luego reintenta.
- Onboarding consulta identidad antes de datos activos y muestra cuenta suspendida sin settings ficticios. Componente y formulario se remontan por UUID actual, ocultando datos previos inmediatamente durante carga/fallo del siguiente usuario. Se ignoran resultados de componentes desmontados.
- Perfil y avatar reflejan su escritura confirmada aunque falle settings. Solo se anuncia éxito total después de ambas escrituras.
- Tema remoto se aplica en carga/guardado mediante `gamehive-theme`, validación existente y eventos storage; sin provider/API nuevos. Segundo contexto con preferencia de sistema oscura recupera el tema claro guardado en servidor.
- Handler administrativo devuelve 400 ante JSON inválido, null, arrays y objetos incompletos. No cambia autorización ni SQL.
- HTTP real añade refreshSession, RLS sobre token de sesión revocada con otra sesión activa conservada, autoedición admin denegada, admin suspendido denegado y actualizaciones concurrentes con cadena before/after de auditoría consistente. Lectura de perfiles permanece pública por especificación; revocación impide lectura de settings y escritura profile/settings.
- CI separa frontend sin configuración del backend real. Job backend usa SQL y `test:backend -- --e2e`, arranque temporal con salida privada, teardown always y sin artifacts Auth. Helper E2E backend ejecuta solo auth.spec; regresiones generales siguen en job frontend.
- Deno 2.9.8 oficial, checksum verificado y fijado; `deno check --frozen` sobre ambos entrypoints, con deno.lock versionado. Documentado en DEPENDENCIES.

## Pruebas dirigidas ejecutadas

- `vitest run tests/unit/auth.test.ts tests/integration/onboarding-ui.test.tsx`: **8 pasaron**.
- HTTP G1 (`npm run test:backend` dentro de ejecución dirigida): **pasó** la suite real ampliada.
- Playwright `tests/e2e/auth.spec.ts` con backend local: **1 pasó**, caso sin-config omitido por entorno configurado. Incluye cuenta suspendida real, tema segundo navegador, red fallida y ACK perdido.
- `deno check --frozen supabase/functions/identity/index.ts supabase/functions/admin-identity/index.ts`: **ambos pasaron**.
- ESLint solo archivos TS/TSX editados: **pasó**. YAML CI parseado; ambos jobs identificados. CI remota nueva aún no ejecutada.
- Se generó build para ejecutar el E2E dirigido. No se ejecutó suite completa; verificación completa a cargo del orquestador.
