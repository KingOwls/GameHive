// @vitest-environment node
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const enabled = process.env.GH_RUN_MANUAL === "1";
const origin = "http://127.0.0.1:54321";
const key = process.env.GH_LOCAL_API_KEY ?? "";
const db = (query: string) =>
  execFileSync(
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
async function api(
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
) {
  const response = await fetch(origin + path, {
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
describe.skipIf(!enabled)("GH-018 real local Auth/Edge/Data API", () => {
  it("four roles, concurrent duplicate, public read, revoked/suspended admin and RAWG preservation", async () => {
    const accounts: { id: string; token: string }[] = [],
      created: string[] = [];
    const marker = "m" + randomUUID().replaceAll("-", "").slice(0, 10);
    const payload = {
      title: "Celeste",
      synopsis:
        "Juego de plataformas sobre el ascenso de Madeline a una montaña y sus desafíos personales.",
      platforms: ["PC"],
      genres: ["Plataformas"],
      releasedAt: null,
      sourceUrl: `https://www.celestegame.com/?gamehive_fixture=${marker}`,
      sourceLabel: "Sitio oficial de Celeste",
      reason: "Prueba local de alta con fuente oficial y auditoría",
    };
    const fingerprint = () =>
      db(
        "select md5(coalesce(string_agg(id||document::text,'' order by id),'')) from public.games;",
      );
    const before = fingerprint();
    const hook = `isolated_manual_${marker}`;
    try {
      for (const role of ["user", "critic", "moderator", "admin"]) {
        const client = createClient(origin, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const reg = await client.auth.signUp({
          email: `${marker}-${role}@example.invalid`,
          password: `Gh2!${randomUUID()}`,
          options: { data: { username: `${marker}_${role}` } },
        });
        expect(
          reg.error === null && !!reg.data.session,
          "local fixture signup",
        ).toBe(true);
        const a = {
          id: reg.data.user!.id,
          token: reg.data.session!.access_token,
        };
        accounts.push(a);
        db(`update private.authz set role='${role}' where user_id='${a.id}';`);
      }
      expect(
        (await api("/functions/v1/admin-games", undefined, "POST", payload))
          .status,
      ).toBe(401);
      for (const a of accounts.slice(0, 3))
        expect(
          (await api("/functions/v1/admin-games", a.token, "POST", payload))
            .status,
        ).toBe(403);
      const admin = accounts[3];
      for (const sourceUrl of [
        "http://www.celestegame.com/",
        "javascript:alert(1)",
        "https://localhost/",
        "https://127.0.0.1/",
      ])
        expect(
          (
            await api("/functions/v1/admin-games", admin.token, "POST", {
              ...payload,
              sourceUrl,
            })
          ).status,
        ).toBe(400);
      // A failed audit must roll back the game and become a sanitized HTTP503.
      db(
        `create function private.${hook}() returns trigger language plpgsql as $$begin raise exception 'Isolated audit fault'; end;$$; create trigger ${hook} before insert on private.audit_logs for each row when (new.actor_id='${admin.id}'::uuid) execute function private.${hook}();`,
      );
      const fault = await api(
        "/functions/v1/admin-games",
        admin.token,
        "POST",
        payload,
      );
      expect(fault.status).toBe(503);
      expect(JSON.stringify(fault.data)).not.toMatch(
        /Isolated|postgres|select |password|token/i,
      );
      expect(
        db(
          `select count(*) from public.manual_games where source_url='${payload.sourceUrl}';`,
        ),
      ).toBe("0");
      db(
        `drop trigger ${hook} on private.audit_logs; drop function private.${hook}();`,
      );
      const pair = await Promise.all([
        api("/functions/v1/admin-games", admin.token, "POST", payload),
        api("/functions/v1/admin-games", admin.token, "POST", {
          ...payload,
          sourceUrl: `https://WWW.CELESTEGAME.COM:443/?gamehive_fixture=${marker}#same-source`,
        }),
      ]);
      for (const r of pair) if (r.status === 201) created.push(r.data.id);
      expect(pair.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(created).toHaveLength(1);
      const id = created[0];
      expect(
        db(
          `select count(*) from private.audit_logs where actor_id='${admin.id}' and action='manual_game.create' and after_data->>'gameId'='manual:${id}';`,
        ),
      ).toBe("1");
      const publicGame = await api(
        `/rest/v1/manual_games?id=eq.${id}&select=*`,
      );
      expect(publicGame.status).toBe(200);
      expect(publicGame.data[0]).toMatchObject({
        title: "Celeste",
        source_url: payload.sourceUrl,
      });
      expect(publicGame.data[0]).not.toHaveProperty("reason");
      expect(publicGame.data[0]).not.toHaveProperty("actor_id");
      for (const token of [undefined, ...accounts.map((a) => a.token)]) {
        expect(
          (
            await api(`/rest/v1/manual_games?id=eq.${id}`, token, "PATCH", {
              title: "Tampered",
            })
          ).status,
        ).toBe(token ? 403 : 401);
        expect(
          (await api(`/rest/v1/manual_games?id=eq.${id}`, token, "DELETE"))
            .status,
        ).toBe(token ? 403 : 401);
        expect(
          (
            await api("/rest/v1/manual_games", token, "POST", {
              ...publicGame.data[0],
              id: randomUUID(),
            })
          ).status,
        ).toBe(token ? 403 : 401);
      }
      db(
        `update private.authz set status='suspended' where user_id='${admin.id}';`,
      );
      expect(
        (await api("/functions/v1/admin-games", admin.token, "POST", payload))
          .status,
      ).toBe(403);
      db(
        `update private.authz set status='active' where user_id='${admin.id}';`,
      );
      expect(
        (await api("/auth/v1/logout?scope=local", admin.token, "POST")).status,
      ).toBe(204);
      expect(
        (await api("/functions/v1/admin-games", admin.token, "POST", payload))
          .status,
      ).toBe(401);
      expect(fingerprint()).toBe(before);
      // Exercise audit-based cleanup with no remembered successful response ID.
      created.length = 0;
    } finally {
      db(
        `drop trigger if exists ${hook} on private.audit_logs; drop function if exists private.${hook}();`,
      );
      if (accounts.length) {
        const ids = accounts.map((a) => `'${a.id}'`).join(",");
        // Recover committed game IDs from this fixture's private audits even if
        // the HTTP acknowledgement was lost and `created` remained empty.
        db(`begin;
          select pg_advisory_xact_lock(718007013);
          delete from public.manual_games g where exists (
            select 1 from private.audit_logs a where a.actor_id in (${ids})
            and a.action='manual_game.create' and a.after_data->>'gameId'='manual:'||g.id::text
          );
          delete from private.audit_logs where actor_id in (${ids});
          delete from auth.users where id in (${ids});
          commit;`);
        expect(
          db(
            `select count(*) from public.manual_games where source_url='${payload.sourceUrl}';`,
          ),
          "fixture cleanup after uncertain ACK",
        ).toBe("0");
        expect(
          db(
            `select count(*) from private.audit_logs where actor_id in (${ids});`,
          ),
        ).toBe("0");
        expect(
          db(`select count(*) from auth.users where id in (${ids});`),
        ).toBe("0");
      }
    }
  }, 60000);
});
