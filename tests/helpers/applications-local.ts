import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { reviewApi, reviewDb, reviewsOrigin } from "./reviews-local";
export const applicationInput = {
  organization: "Independiente",
  experience:
    "Experiencia escribiendo análisis de juegos desde hace varios años.",
  sample:
    "Una muestra textual propia que explica las decisiones de diseño del juego.",
  links: ["https://example.com/evidence"],
};
export async function applicationFixtures(withManual = false) {
  const manualId = withManual ? randomUUID() : null;
  const marker = `a${randomUUID().replaceAll("-", "").slice(0, 10)}`;
  const accounts: {
    id: string;
    token: string;
    email: string;
    password: string;
    username: string;
    role: string;
    session: string;
  }[] = [];
  const cleanup = () => {
    if (!accounts.length) return;
    const ids = accounts.map((a) => `'${a.id}'`).join(",");
    reviewDb(
      `begin;select pg_advisory_xact_lock(718007013);delete from private.audit_logs where actor_id in (${ids});delete from auth.users where id in (${ids});commit;`,
    );
    if (manualId)
      reviewDb(`delete from public.manual_games where id='${manualId}'`);
    if (
      reviewDb(`select count(*) from auth.users where id in (${ids})`) !== "0"
    )
      throw Error("Application fixtures cleanup incomplete");
  };
  try {
    for (const [i, role] of [
      "user",
      "user",
      "critic",
      "moderator",
      "admin",
    ].entries()) {
      const username = `${marker}_${i}`,
        email = `${username}@example.invalid`,
        password = `Gh23!${randomUUID()}`;
      const client = createClient(
        reviewsOrigin,
        process.env.GH_LOCAL_API_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const r = await client.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (r.error || !r.data.user || !r.data.session)
        throw Error("Local application fixture signup failed");
      const token = r.data.session.access_token,
        session = JSON.parse(
          Buffer.from(token.split(".")[1], "base64url").toString(),
        ).session_id as string;
      accounts.push({
        id: r.data.user.id,
        token,
        email,
        password,
        username,
        role,
        session,
      });
      reviewDb(
        `update private.authz set role='${role}' where user_id='${r.data.user.id}'`,
      );
    }
    if (manualId)
      reviewDb(
        `insert into public.manual_games(id,title,synopsis,platforms,genres,source_url,source_label) values('${manualId}','Celeste','Celeste es un juego de plataformas desarrollado por Maddy Makes Games.',array['PC'],array['Platformer'],'https://www.celestegame.com/','Fuente oficial de Celeste; registro temporal de prueba GH023')`,
      );
    return {
      manualId,
      accounts,
      cleanup,
      op: (operation: string, input: unknown, token = accounts[0].token) =>
        reviewApi("/functions/v1/critic-applications", token, "POST", {
          operation,
          input,
        }),
    };
  } catch (e) {
    cleanup();
    throw e;
  }
}
