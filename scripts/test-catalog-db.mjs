// Capture local CLI status in memory only. Never print status or connection credentials.
import { execFileSync, spawnSync } from "node:child_process";
let local;
try {
  local = JSON.parse(
    execFileSync("node_modules/.bin/supabase", ["status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
} catch {
  throw new Error("No se pudo leer el estado local de GameHive.");
}
const dbUrl = new URL(local.DB_URL);
if (
  local.API_URL !== "http://127.0.0.1:54321" ||
  !["127.0.0.1", "localhost"].includes(dbUrl.hostname)
)
  throw new Error("Solo se admite la base local GameHive.");
const result = spawnSync(
  process.env.GH_DENO_BIN ?? "deno",
  [
    "test",
    "--frozen",
    "--allow-env",
    "--allow-net",
    "supabase/tests/catalog-adapter.test.ts",
  ],
  {
    env: {
      ...process.env,
      SUPABASE_DB_URL: local.DB_URL,
      RAWG_API_KEY: "isolated-test-key",
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  },
);
// Deno/DB failures may include connection details, so expose only the verdict.
console.log(
  result.status === 0
    ? "PASS: adaptador real + DB local (TTL, Unicode, jsonb multibyte); upstream controlado, cero RAWG."
    : "FAIL: adaptador real + DB local; revisar asserts locales sin imprimir configuración.",
);
if (result.status !== 0) {
  const permission = (result.stdout + result.stderr).match(
    /Requires (?:env|net) access to "[A-Z_]+"/,
  );
  const assertion = (result.stdout + result.stderr).match(
    /(?:error: Error: )((?:expired cache|fresh cache|Unicode|oversized valid|normalized JSON|mandatory fields|accepted Unicode|fixed upstream)[^\n]*)/,
  );
  if (permission) console.log(permission[0]);
  else if (assertion) console.log(assertion[1]);
}
process.exitCode = result.status ?? 1;
