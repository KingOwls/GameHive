// Only reads local CLI status. Never prints status, credentials or session payloads.
import { execFileSync, spawnSync } from "node:child_process";
const status = JSON.parse(
  execFileSync("node_modules/.bin/supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
if (
  status.API_URL !== "http://127.0.0.1:54321" ||
  !status.PUBLISHABLE_KEY?.startsWith("sb_publishable_")
)
  throw new Error("Expected a local Supabase stack with publishable keys.");
const env = {
  ...process.env,
  GH_RUN_LOCAL: "1",
  GH_LOCAL_API_KEY: status.PUBLISHABLE_KEY,
  VITE_SUPABASE_URL: status.API_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
};
function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run("node_modules/.bin/vitest", ["run", "tests/integration/auth-live.test.ts"]);
if (process.argv.includes("--e2e")) {
  run("npm", ["run", "build"]);
  run("node_modules/.bin/playwright", [
    "test",
    "tests/e2e/auth.spec.ts",
    "--reporter=list",
  ]);
}
