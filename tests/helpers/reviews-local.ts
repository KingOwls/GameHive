// Test-only local fixture management. IDs and credentials stay in process memory.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
export const reviewsOrigin = "http://127.0.0.1:54321";
export function reviewDb(query: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_gamehive",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}
export async function reviewApi(
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
) {
  const key = process.env.GH_LOCAL_API_KEY;
  if (!key?.startsWith("sb_publishable_"))
    throw Error("Expected local public test configuration.");
  const response = await fetch(reviewsOrigin + path, {
    method,
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}
export async function reviewFixtures(
  roles = ["user", "user", "critic", "moderator", "admin"],
) {
  const marker = "r" + randomUUID().replaceAll("-", "").slice(0, 10);
  const accounts: {
    id: string;
    token: string;
    email: string;
    password: string;
    username: string;
    role: string;
    session: string;
  }[] = [];
  let manualId = "";
  let isolatedRawgId = "";
  const hook = `isolated_review_${marker}`;
  const cleanup = () => {
    reviewDb(
      `drop trigger if exists ${hook} on private.audit_logs; drop function if exists private.${hook}();`,
    );
    const cleanupIsolatedGame = () => {
      if (isolatedRawgId) {
        reviewDb(
          `delete from public.games where id='${isolatedRawgId}' and document->>'title'='Isolated review contract fixture ${marker}';`,
        );
        if (
          reviewDb(
            `select count(*) from public.games where id='${isolatedRawgId}';`,
          ) !== "0"
        )
          throw Error("Isolated catalog cleanup incomplete.");
      }
    };
    if (!accounts.length) {
      cleanupIsolatedGame();
      return;
    }
    if (
      accounts.some(
        (a) =>
          !/^r[a-z0-9]{10}_[a-z]+_[0-9]+$/.test(a.username) ||
          !a.email.endsWith("@example.invalid") ||
          !/^[-0-9a-f]{36}$/.test(a.id),
      )
    )
      throw Error("Fixture cleanup guard failed.");
    const ids = accounts.map((a) => `'${a.id}'`).join(",");
    reviewDb(`begin;select pg_advisory_xact_lock(718007013);
 delete from public.reviews where author_id in (${ids});
 delete from public.manual_games g where exists(select 1 from private.audit_logs a where a.actor_id in (${ids}) and a.action='manual_game.create' and a.after_data->>'gameId'='manual:'||g.id::text);
 delete from private.audit_logs where actor_id in (${ids});
 delete from auth.users where id in (${ids});commit;`);
    if (
      reviewDb(`select count(*) from auth.users where id in (${ids});`) !==
        "0" ||
      reviewDb(
        `select count(*) from private.audit_logs where actor_id in (${ids});`,
      ) !== "0" ||
      reviewDb(
        `select count(*) from public.reviews where author_id in (${ids});`,
      ) !== "0"
    )
      throw Error("Fixture cleanup incomplete.");
    if (
      reviewDb(
        `select count(*) from public.manual_games where source_url='https://www.celestegame.com/?gamehive_fixture=${marker}';`,
      ) !== "0"
    )
      throw Error("Manual fixture cleanup incomplete.");
    cleanupIsolatedGame();
  };
  try {
    let rawgId = reviewDb(
      "select id from public.games where detail_complete order by id limit 1;",
    );
    let isolatedDocument = null;
    if (process.env.GH_REVIEWS_ISOLATED === "1") {
      // Explicit contract fixture: never described as a successful RAWG request.
      do {
        isolatedRawgId = `rawg:${1000000000 + Math.floor(Math.random() * 8000000000)}`;
      } while (
        reviewDb(
          `select count(*) from public.games where id='${isolatedRawgId}';`,
        ) !== "0"
      );
      rawgId = isolatedRawgId;
      isolatedDocument = {
        id: rawgId,
        title: `Isolated review contract fixture ${marker}`,
        summary: "Isolated contract fixture, not live provider evidence.",
        genres: ["Test"],
        platforms: ["PC"],
        releasedYear: null,
        sourceUrl: "https://example.com/isolated-review-contract",
        sourceLabel: "Isolated fixture",
        externalRating: null,
      };
      reviewDb(
        `insert into public.games(id,provider,external_id,document,detail_complete) values('${rawgId}','rawg',${rawgId.slice(5)},'${JSON.stringify(isolatedDocument)}'::jsonb,true);`,
      );
    }
    if (!/^rawg:[0-9]+$/.test(rawgId))
      throw Error(
        "Run the real local RAWG catalog verification before review acceptance tests.",
      );
    for (const [i, role] of roles.entries()) {
      if (!["user", "critic", "moderator", "admin"].includes(role))
        throw Error("Invalid fixture role");
      const username = `${marker}_${role}_${i}`,
        email = `${username}@example.invalid`,
        password = `Gh3!${randomUUID()}`;
      const client = createClient(
        reviewsOrigin,
        process.env.GH_LOCAL_API_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const reg = await client.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (reg.error || !reg.data.session || !reg.data.user)
        throw Error("Local review fixture signup failed.");
      const claims = JSON.parse(
        Buffer.from(
          reg.data.session.access_token.split(".")[1],
          "base64url",
        ).toString(),
      );
      const account = {
        id: reg.data.user.id,
        token: reg.data.session.access_token,
        email,
        password,
        username,
        role,
        session: String(claims.session_id),
      };
      accounts.push(account);
      reviewDb(
        `update private.authz set role='${role}' where user_id='${account.id}';`,
      );
    }
    const admin = accounts.find((a) => a.role === "admin");
    if (!admin) throw Error("Admin fixture required.");
    const result = await reviewApi(
      "/functions/v1/admin-games",
      admin.token,
      "POST",
      {
        title: "Celeste",
        synopsis:
          "Juego de plataformas sobre el ascenso de Madeline a una montaña y sus desafíos personales.",
        platforms: ["PC"],
        genres: ["Plataformas"],
        releasedAt: null,
        sourceUrl: `https://www.celestegame.com/?gamehive_fixture=${marker}`,
        sourceLabel: "Sitio oficial Celeste",
        reason:
          "Prueba aislada local de reseñas en juego real con fuente oficial",
      },
    );
    if (result.status !== 201 || !/^[0-9a-f-]{36}$/.test(result.data.id))
      throw Error("Local real manual fixture creation failed.");
    manualId = `manual:${result.data.id}`;
    return {
      marker,
      accounts,
      rawgId,
      manualId,
      hook,
      cleanup,
      isolatedDocument,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
export const reviewPayload = {
  rating: 7,
  title: "Mi aventura en la montaña",
  bodyPublic: "Una aventura con controles precisos y desafíos interesantes.",
  bodySpoiler: "El desenlace se descubre al superar la montaña.",
  pros: ["Controles precisos"],
  cons: ["Desafío exigente"],
};
