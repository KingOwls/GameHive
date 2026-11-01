import { it, expect } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
it.each(["missing", "blank", "wrong-id", "valid"])(
  "manual verifier validates actual identity (%s) without provider requests",
  (kind) => {
    const file = resolve(`.env.verify-${randomUUID()}.local`);
    writeFileSync(file, "RAWG_API_KEY=isolated-verifier-key\n", {
      mode: 0o600,
    });
    try {
      const stub = `globalThis.fetch=async url=>new Response(JSON.stringify({id:${kind === "wrong-id" ? "1" : "Number(new URL(url).pathname.split('/').pop())"},${kind === "missing" ? "" : `name:${JSON.stringify(kind === "blank" ? "   " : "Fixture title")},`}description_raw:'Fixture description'}));`;
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          `data:text/javascript,${encodeURIComponent(stub)}`,
          "scripts/verify-rawg.mjs",
          file,
        ],
        { encoding: "utf8" },
      );
      expect(result.error).toBeUndefined();
      expect(result.stderr).toBe("");
      expect(result.status).toBe(kind === "valid" ? 0 : 1);
      const report = JSON.parse(result.stdout);
      expect(report.rows).toHaveLength(8);
      expect(report.result).toContain(
        kind === "valid" ? "8 respuestas" : "BLOCKED",
      );
      expect(result.stdout).not.toContain("isolated-verifier-key");
    } finally {
      unlinkSync(file);
    }
  },
);
