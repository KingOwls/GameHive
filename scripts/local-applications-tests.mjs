// Local fixture credentials remain in test memory. Never print CLI status.
import { execFileSync, spawnSync } from "node:child_process";
let status;
try {
  status = JSON.parse(execFileSync("node_modules/.bin/supabase", ["status", "-o", "json"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }));
  if (status.API_URL !== "http://127.0.0.1:54321" || !status.PUBLISHABLE_KEY?.startsWith("sb_publishable_"))throw Error();
} catch { throw Error("Could not read the own local GameHive stack safely."); }
const env = {
  ...process.env,
  GH_RUN_APPLICATIONS: "1",
  GH_RUN_LOCAL: "1",
  GH_LOCAL_API_KEY: status.PUBLISHABLE_KEY,
  VITE_SUPABASE_URL: status.API_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  VITE_CATALOG_MODE: "rawg",
};
console.log(process.env.GH_REVIEWS_ISOLATED === "1"
  ? "Applications: private real local Auth/Edge/DB, no catalog dependency."
  : "Applications: private real local Auth/Edge/DB, no remote operations.");
let ready = false;
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(status.API_URL + "/functions/v1/critic-applications", {
      method: "OPTIONS",
      headers: { apikey: status.PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(1000),
    });
    if (r.status === 200) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!ready)
  throw Error(
    "Local applications runtime not ready; start supabase functions serve",
  );
const run = (command, args) => {
  const r = spawnSync(command, args, { env, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
if (!process.argv.includes("--browser-only")) run("node_modules/.bin/vitest", [
  "run",
  "tests/integration/applications-live.test.ts",
]);
if (process.argv.includes("--e2e") || process.argv.includes("--browser-only")) {
  run("npm", ["run", "build"]);
  run("node_modules/.bin/playwright", [
    "test",
    "tests/e2e/applications.spec.ts",
    "--reporter=list",
    "--workers=1",
  ]);
}
