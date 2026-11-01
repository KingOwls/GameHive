// Runs only on the named GameHive local container, with isolated disposable schema.
// No provider calls, credentials, changes to actual catalog data, or retained fixtures.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const exec = promisify(execFile);
const schema = `catalog_test_${randomBytes(6).toString("hex")}`;
async function query(statement) {
  try {
    const { stdout } = await exec(
      "docker",
      [
        "exec",
        "supabase_db_gamehive",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-X",
        "-q",
        "-A",
        "-t",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        statement,
      ],
      { maxBuffer: 1024 * 1024 },
    );
    return stdout.trim();
  } catch {
    throw new Error(
      "Falló la consulta local aislada de catálogo; diagnósticos omitidos.",
    );
  }
}
const filename = (await readdir("supabase/migrations")).find((name) =>
  name.endsWith("_catalog_rawg.sql"),
);
if (!filename) throw new Error("Migración de catálogo ausente.");
const migration = (await readFile(`supabase/migrations/${filename}`, "utf8"))
  .replaceAll("public.games", `${schema}.games`)
  .replaceAll("private.catalog_", `${schema}.catalog_`);
try {
  await query(`create schema ${schema}; ${migration}`);
  const reservations = await Promise.all(
    Array.from({ length: 40 }, () =>
      query(`select ${schema}.catalog_reserve()`),
    ),
  );
  const accepted = reservations.filter((value) => value === "t").length;
  if (accepted !== 20)
    throw new Error(`Cuota concurrente incorrecta: ${accepted}/20`);
  const attempts = Number(
    await query(`select count(*) from ${schema}.catalog_attempts`),
  );
  if (attempts !== 20)
    throw new Error("Reserva denegada incrementó presupuesto.");
  console.log(
    "PASS: 40 reservas concurrentes, exactamente 20 admitidas y 20 persistidas.",
  );
  await query(
    `delete from ${schema}.catalog_attempts; insert into ${schema}.catalog_attempts select greatest(date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC',clock_timestamp()-interval '2 minutes') from generate_series(1,999);`,
  );
  const fixtureMonth = await query(
    `select date_trunc('month',min(attempted_at) at time zone 'UTC')::text from ${schema}.catalog_attempts`,
  );
  const firstMinutes = await query(
    "select extract(epoch from (clock_timestamp() - (date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC'))) < 120",
  );
  const last = await Promise.all(
    Array.from({ length: 10 }, () =>
      query(`select ${schema}.catalog_reserve()`),
    ),
  );
  const admitted = last.filter((value) => value === "t").length;
  const finalMonth = await query(
    "select date_trunc('month',clock_timestamp() at time zone 'UTC')::text",
  );
  // During month/rolling-window rollover, either cap may release while requests wait.
  const allowed =
    fixtureMonth !== finalMonth
      ? admitted <= 10
      : firstMinutes === "t"
        ? admitted <= 1
        : admitted === 1;
  if (!allowed) throw new Error("Cuota mensual concurrente incorrecta.");
  const monthly = Number(
    await query(
      `select count(*) from ${schema}.catalog_attempts where attempted_at >= (date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC')`,
    ),
  );
  if (monthly > 1000) throw new Error("Se excedió el presupuesto mensual.");
  console.log(
    `PASS: límite mensual y ventana móvil respetados (${admitted} reserva final admitida).`,
  );
  for (let batch = 0; batch < 6; batch++) {
    await Promise.all(
      Array.from({ length: 10 }, (_, worker) =>
        query(
          `select ${schema}.catalog_store('concurrent-${batch}-${worker}-'||n,'{}','[]',false) from generate_series(1,10) n`,
        ),
      ),
    );
  }
  const count = Number(
    await query(`select count(*) from ${schema}.catalog_cache`),
  );
  if (count !== 500)
    throw new Error(`Cache concurrente incorrecta: ${count}/500`);
  console.log(
    "PASS: 600 escrituras concurrentes conservan exactamente 500 entradas.",
  );
} finally {
  await query(`drop schema if exists ${schema} cascade`);
}
