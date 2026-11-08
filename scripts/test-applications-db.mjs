// Local status stays in memory and Deno failures are reduced to sanitized verdicts.
import { execFileSync, spawnSync } from "node:child_process";
let local;
try {
  local = JSON.parse(
    execFileSync("node_modules/.bin/supabase", ["status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  if (
    local.API_URL !== "http://127.0.0.1:54321" ||
    !["127.0.0.1", "localhost"].includes(new URL(local.DB_URL).hostname)
  )
    throw Error();
} catch {
  throw Error("Could not read the own local GameHive stack safely.");
}
const result = spawnSync(
  process.env.GH_DENO_BIN ?? "deno",
  [
    "test",
    "--frozen",
    "--allow-env",
    "--allow-net",
    "supabase/tests/critic-applications-runtime.test.ts",
  ],
  {
    env: { ...process.env, SUPABASE_DB_URL: local.DB_URL },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  },
);
if (result.status === 0)
  console.log(
    "PASS: applications body ceiling, two-session race and authority/session concurrency (real local DB, zero RAWG).",
  );
else {
  console.log(
    "FAIL: applications runtime/local DB tests; private connection output withheld.",
  );
  const safe = (result.stdout + result.stderr).split("\n").filter(line => /^(error:|TS[0-9]|Check |FAILED|\s*error\[)/.test(line) && !/postgres:\/\/|password|SUPABASE_DB_URL/.test(line));
  for (const line of safe) console.log(line.slice(0,250));
  const known = (result.stdout + result.stderr).match(
    /Error: ((?:body chunks|timeout must|oversized body|queued query|pool wait|canceled queued|active query|active cancellation|demotion:|suspension:|session deletion:)[^\n]*)/,
  );
  if (known) console.log(known[1]);
}
process.exitCode = result.status ?? 1;
