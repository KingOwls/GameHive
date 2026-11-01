# Dependencias verificadas

Versiones instaladas exactas en package.json y package-lock.json; metadatos leídos de los paquetes el 2026-10-31. Licencia del proyecto/documentos aún no decidida. Ver QA-003 para alertas de tooling.

| Paquete | Versión | Licencia declarada |
|---|---|---|
| @supabase/supabase-js | 2.118.0 | MIT |
| react | 19.3.1 | MIT |
| react-dom | 19.3.1 | MIT |
| react-router-dom | 7.18.5 | MIT |
| @axe-core/playwright | 4.14.0 | MPL-2.0 |
| @eslint/js | 9.39.5 | MIT |
| @playwright/test | 1.64.1 | Apache-2.0 |
| @testing-library/jest-dom | 7.0.1 | MIT |
| @testing-library/react | 16.3.3 | MIT |
| @testing-library/user-event | 14.6.8 | MIT |
| @types/node | 26.6.6 | MIT |
| @types/react | 19.3.0 | MIT |
| @types/react-dom | 19.3.0 | MIT |
| @vitejs/plugin-react | 6.1.2 | MIT |
| bmad-method | 6.12.4 | MIT |
| eslint | 9.39.5 | MIT |
| eslint-plugin-jsx-a11y | 6.10.2 | MIT |
| eslint-plugin-react-hooks | 7.1.1 | MIT |
| globals | 17.13.0 | MIT |
| jsdom | 30.1.3 | MIT |
| prettier | 3.9.10 | MIT |
| supabase | 2.122.0 | MIT |
| typescript | 6.0.3 | Apache-2.0 |
| typescript-eslint | 8.72.1 | MIT |
| vite | 8.3.5 | MIT |
| vitest | 5.0.5 | MIT |

## Driver directo de Edge Functions (G1)

`https://deno.land/x/postgresjs@v3.4.5/mod.js` — Postgres.js 3.4.5, licencia **Unlicense**, [repositorio oficial](https://github.com/porsager/postgres). Dependencia fijada en URL, fuera de package.json porque se ejecuta en Deno Edge. Usada para conexión privada parametrizada y transacción de autoridad/auditoría. Licencia/version comprobadas con package.json oficial del tag v3.4.5. El adaptador nativo Deno evitó ENOTFOUND reproducible del driver npm en Edge local. Referencia de conexión oficial: https://supabase.com/docs/guides/functions/connect-to-postgres. No cambia la licencia del proyecto.

## Comprobación estática de Edge

Deno **2.9.8**, release oficial https://github.com/denoland/deno/releases/tag/v2.9.8; binario Linux x64 verificado con SHA-256 publicado `e890975bc2549807bbcc0b584ffafda72cc7c93349dd99c80483dd784f6c4609`. CI comprueba ambos entrypoints con `deno check` sin secretos. Deno 2.9.8 satisface el mínimo `>=2.7.10` declarado por el SDK Supabase instalado. No se instala globalmente ni se depende de latest en CI.
