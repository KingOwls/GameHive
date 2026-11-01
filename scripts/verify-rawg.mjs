// Manual, measured provider acceptance. No VITE keys, raw payloads or upstream URLs.
import { readFile, writeFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const secretFile = resolve(process.argv[2] ?? ".env.server.local");
try {
  execFileSync("git", ["check-ignore", "--quiet", secretFile], {
    stdio: "ignore",
  });
} catch {
  throw new Error("El archivo de clave debe estar ignorado por Git.");
}
let contents;
try {
  contents = await readFile(secretFile, "utf8");
} catch {
  console.log(
    "BLOCKED: falta archivo local ignorado con RAWG_API_KEY. No se probó RAWG.",
  );
  process.exit(2);
}
const match = contents.match(/^RAWG_API_KEY\s*=\s*["']?([^\s"'#]+)["']?\s*$/m);
if (!match) {
  console.log("BLOCKED: RAWG_API_KEY ausente. No se probó RAWG.");
  process.exit(2);
}
const key = match[1];
if ((await stat(secretFile)).mode & 0o077)
  throw new Error("El archivo servidor requiere permisos 600 antes de probar.");
const ids = [9767, 274755, 22121, 654, 324997, 326243, 262382, 4200]; // IDs oficiales; el nombre se registra desde la respuesta.
const rows = [];
for (const id of ids) {
  const started = performance.now();
  const url = new URL(`https://api.rawg.io/api/games/${id}`);
  url.searchParams.set("key", key);
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!response.ok) {
      rows.push({
        id,
        status: response.status,
        ms: Math.round(performance.now() - started),
        error: "Proveedor rechazó consulta",
      });
      continue;
    }
    const body = await response.text();
    if (Buffer.byteLength(body) > 1048576) throw new Error("oversize");
    const data = JSON.parse(body);
    if (data.id !== id || typeof data.name !== "string" || !data.name.trim())
      throw new Error("invalid identity");
    rows.push({
      id,
      matchedId: true,
      status: response.status,
      ms: Math.round(performance.now() - started),
      bytes: Buffer.byteLength(body),
      name:
        typeof data.name === "string"
          ? data.name
              .replace(/[\r\n|<>]/g, " ")
              .trim()
              .slice(0, 120)
          : "",
      release: data.released ?? null,
      description:
        typeof data.description_raw === "string" &&
        data.description_raw.length > 0,
      cover:
        typeof data.background_image === "string" &&
        data.background_image.startsWith("https://media.rawg.io/"),
      platforms: Array.isArray(data.platforms) ? data.platforms.length : 0,
      genres: Array.isArray(data.genres) ? data.genres.length : 0,
      rating: data.rating ?? null,
      sample: data.ratings_count ?? null,
    });
  } catch {
    rows.push({
      id,
      status: "error",
      ms: Math.round(performance.now() - started),
      error:
        "Red, timeout o payload inválido; detalles omitidos para proteger clave",
    });
  }
}
const success = rows.every(
  (row) =>
    row.status === 200 &&
    row.matchedId === true &&
    typeof row.name === "string" &&
    row.name.trim().length > 0 &&
    row.description,
);
const report = {
  timestamp: new Date().toISOString(),
  source: "RAWG real; no fixtures",
  result: success
    ? "8 respuestas recibidas; revisar términos y flujo completo antes de cerrar G2"
    : "BLOCKED: cobertura real incompleta",
  attempts: ids.length,
  rows,
  limits:
    "1000/mes y 20/minuto son presupuesto aplicativo; esta prueba manual usó 8 intentos. No se provocaron 429 artificiales ni se certificó cuota del proveedor.",
  terms: "https://rawg.io/apidocs",
};
const serialized = JSON.stringify(report, null, 2);
if (serialized.includes(key))
  throw new Error("Salida rechazada por contener secreto.");
const outputIndex = process.argv.indexOf("--output");
if (outputIndex >= 0) {
  const target = resolve(process.argv[outputIndex + 1] ?? "");
  await writeFile(target, serialized + "\n", { flag: "wx", mode: 0o600 });
  console.log("Informe saneado guardado.");
} else console.log(serialized);
if (!success) process.exitCode = 1;
