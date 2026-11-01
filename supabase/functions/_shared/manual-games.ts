import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import {
  manualDeadline,
  manualQuery,
  readManualBody,
} from "./manual-game-deadline.ts";
import { validateManualGame } from "./manual-game-validation.ts";
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false,
  max: 3,
  connection: { statement_timeout: 8000 },
});
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
export async function manualGamesHandler(request: Request): Promise<Response> {
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") {
    return reply(405, { error: "Método no permitido." });
  }
  const timeout = AbortSignal.timeout(10000);
  const deadline = manualDeadline(timeout);
  try {
    const bearer = request.headers.get("Authorization") ?? "";
    if (!bearer.startsWith("Bearer ")) {
      return reply(401, { error: "Inicia sesión de nuevo." });
    }
    const token = bearer.slice(7);
    const auth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (input, init) => fetch(input, { ...init, signal: timeout }),
        },
      },
    );
    const { data, error } = await deadline.wait(auth.auth.getUser(token));
    if (error || !data.user) {
      return reply(401, { error: "Inicia sesión de nuevo." });
    }
    const claims = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (
      typeof claims.session_id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(claims.session_id)
    ) return reply(401, { error: "Inicia sesión de nuevo." });
    let input;
    try {
      input = validateManualGame(await readManualBody(request, deadline));
    } catch (error) {
      if (timeout.aborted) throw error;
      return reply(400, {
        error: "Revisa los campos y la fuente HTTPS pública.",
      });
    }
    const query =
      sql`select private.create_manual_game(${data.user.id}::uuid,${claims.session_id}::uuid,${
        sql.json(input)
      }) as game`;
    const [row] = await manualQuery<Awaited<typeof query>>(query, deadline);
    return reply(201, row.game);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
    if (code === "42501") {
      return reply(403, {
        error: "No tienes permiso o tu sesión ya no está vigente.",
      });
    }
    if (code === "23505") {
      return reply(409, {
        error: "Esa fuente ya está registrada. Consulta el catálogo manual.",
      });
    }
    if (["22023", "22007", "22008", "22P02", "23514", "23502"].includes(code)) {
      return reply(400, {
        error: "Revisa los campos y la fuente HTTPS pública.",
      });
    }
    return reply(503, {
      error:
        "No pudimos confirmar el alta. Consulta el catálogo manual y comprueba la fuente antes de reintentar.",
    });
  } finally {
    deadline.dispose();
  }
}
