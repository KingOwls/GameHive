import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false,
  max: 3,
});
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
export function identityHandler(admin: boolean) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS")
      return new Response(null, { headers: cors });
    const reply = (status: number, data: unknown) =>
      new Response(JSON.stringify(data), { status, headers: cors });
    if (request.method !== "POST")
      return reply(405, { error: "Método no permitido." });
    try {
      const bearer = request.headers.get("Authorization") ?? "";
      if (!bearer.startsWith("Bearer "))
        return reply(401, { error: "Inicia sesión de nuevo." });
      const token = bearer.slice(7);
      // Validate with Auth before reading the signed payload. Metadata never grants authority.
      const auth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const { data, error } = await auth.auth.getUser(token);
      if (error || !data.user)
        return reply(401, { error: "Inicia sesión de nuevo." });
      const claims = JSON.parse(
        atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      const session = claims.session_id;
      if (typeof session !== "string")
        return reply(401, { error: "Inicia sesión de nuevo." });
      if (!admin) {
        const [row] =
          await sql`select private.current_identity(${data.user.id}::uuid, ${session}::uuid) as identity`;
        return reply(200, row.identity);
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return reply(400, { error: "Revisa los datos de la operación." });
      }
      if (typeof body !== "object" || body === null || Array.isArray(body))
        return reply(400, { error: "Revisa los datos de la operación." });
      const input = body as Record<string, unknown>;
      if (
        typeof input.target !== "string" ||
        typeof input.role !== "string" ||
        !["user", "critic", "moderator", "admin"].includes(input.role) ||
        typeof input.status !== "string" ||
        !["active", "suspended"].includes(input.status) ||
        typeof input.criticVerified !== "boolean" ||
        typeof input.reason !== "string" ||
        input.reason.trim().length < 10 ||
        input.reason.length > 500
      )
        return reply(400, { error: "Revisa los datos de la operación." });
      // Current admin role/state, session and audit are checked in the same DB transaction.
      const [row] =
        await sql`select private.admin_update_identity(${data.user.id}::uuid, ${session}::uuid,
        ${input.target}::uuid, ${input.role}, ${input.status}, ${input.criticVerified}, ${input.reason}) as identity`;
      return reply(200, row.identity);
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : "";
      console.error("identity failure", {
        code: String(code)
          .replace(/[^A-Za-z0-9_]/g, "")
          .slice(0, 30),
        name: error instanceof Error ? error.name : "unknown",
      });
      if (code === "42501")
        return reply(403, { error: "No tienes permiso para esta operación." });
      if (["22023", "22P02"].includes(String(code)))
        return reply(400, { error: "Revisa los datos de la operación." });
      // Never log request tokens, credentials, SQL parameters or provider error details.
      return reply(503, {
        error: "No pudimos completar la operación. Inténtalo de nuevo.",
      });
    }
  };
}
