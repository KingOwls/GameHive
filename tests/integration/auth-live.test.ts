// @vitest-environment node
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const local = process.env.GH_RUN_LOCAL === "1";
const url = "http://127.0.0.1:54321";
const key = process.env.GH_LOCAL_API_KEY ?? "";
interface Account {
  id: string;
  token: string;
  email: string;
  password: string;
}
function db(sql: string) {
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
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}
function client() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function api(
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
  raw = false,
) {
  const response = await fetch(url + path, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token ?? key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body:
      body === undefined
        ? undefined
        : raw
          ? String(body)
          : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
async function signup(username: string): Promise<Account> {
  const email = `g1-${randomUUID()}@example.invalid`,
    password = `Gh1!${randomUUID()}`;
  const { data, error } = await client().auth.signUp({
    email,
    password,
    options: { data: { username, role: "admin", critic_verified: true } },
  });
  expect(error, "real signup succeeds").toBeNull();
  expect(data.session, "real session exists").not.toBeNull();
  return {
    id: data.user!.id,
    token: data.session!.access_token,
    email,
    password,
  };
}
describe.skipIf(!local)("G1 backend local real (no mocks)", () => {
  it("atomic aliases, four stored roles, Data API privacy, stale authority, audited administration and logout", async () => {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 10),
      accounts: Account[] = [];
    try {
      const owner = await signup(`Owner_${suffix}`);
      accounts.push(owner);
      const third = await signup(`Third_${suffix}`);
      accounts.push(third);
      const critic = await signup(`Critic_${suffix}`);
      accounts.push(critic);
      const moderator = await signup(`Mod_${suffix}`);
      accounts.push(moderator);
      const admin = await signup(`Admin_${suffix}`);
      accounts.push(admin);
      expect(
        (await api("/functions/v1/identity", owner.token, "POST", {})).body,
      ).toMatchObject({ role: "user", criticVerified: false });
      db(
        `update private.authz set role='critic' where user_id='${critic.id}'; update private.authz set role='moderator' where user_id='${moderator.id}'; update private.authz set role='admin' where user_id='${admin.id}';`,
      );
      for (const [account, role] of [
        [owner, "user"],
        [critic, "critic"],
        [moderator, "moderator"],
        [admin, "admin"],
      ] as const) {
        expect(
          (await api("/functions/v1/identity", account.token, "POST", {})).body
            .role,
        ).toBe(role);
        expect(
          (
            await api(
              `/rest/v1/private_user_settings?user_id=eq.${owner.id}`,
              account.token,
            )
          ).body,
        ).toHaveLength(account.id === owner.id ? 1 : 0);
        expect(
          (
            await api("/rest/v1/profiles", account.token, "POST", {
              id: randomUUID(),
              username: `Fake_${suffix}`,
            })
          ).status,
        ).toBe(403);
        expect(
          (
            await api(
              `/rest/v1/profiles?id=eq.${account.id}`,
              account.token,
              "PATCH",
              { reputation_score: 100 },
            )
          ).status,
        ).toBe(403);
        expect(
          (
            await api(
              `/rest/v1/private_user_settings?user_id=eq.${account.id}`,
              account.token,
              "PATCH",
              { user_id: owner.id },
            )
          ).status,
        ).toBe(403);
        expect(
          (
            await api(
              `/rest/v1/profiles?id=eq.${account.id}`,
              account.token,
              "DELETE",
            )
          ).status,
        ).toBe(403);
      }
      expect(
        (await api(`/rest/v1/private_user_settings?user_id=eq.${owner.id}`))
          .status,
      ).toBe(401);
      expect(
        (await api("/rest/v1/authz", owner.token)).status,
      ).toBeGreaterThanOrEqual(400);
      expect(
        (
          await api(
            "/rest/v1/rpc/admin_update_identity",
            owner.token,
            "POST",
            {},
          )
        ).status,
      ).toBeGreaterThanOrEqual(400);
      expect(
        (
          await api(
            `/rest/v1/profiles?id=eq.${owner.id}`,
            third.token,
            "PATCH",
            { bio: "hijack" },
          )
        ).body,
      ).toEqual([]);
      expect(
        (
          await api(
            `/rest/v1/profiles?id=eq.${owner.id}`,
            owner.token,
            "PATCH",
            { bio: "owner bio" },
          )
        ).body[0].bio,
      ).toBe("owner bio");
      expect(
        (
          await api(
            `/rest/v1/private_user_settings?user_id=eq.${owner.id}`,
            owner.token,
            "PATCH",
            {
              interests: "Narrativa privada",
              platforms: ["PC"],
              onboarding_complete: true,
            },
          )
        ).body[0].interests,
      ).toBe("Narrativa privada");
      const authClient = client();
      expect(
        (
          await authClient.auth.signInWithPassword({
            email: owner.email,
            password: "wrong-password",
          })
        ).error,
      ).not.toBeNull();
      expect((await authClient.auth.getSession()).data.session).toBeNull();
      const login = await authClient.auth.signInWithPassword({
        email: owner.email,
        password: owner.password,
      });
      expect(login.error).toBeNull();
      const refreshed = await authClient.auth.refreshSession();
      expect(refreshed.error).toBeNull();
      const secondToken = refreshed.data.session!.access_token;
      expect(
        (
          await api(
            `/rest/v1/private_user_settings?user_id=eq.${owner.id}`,
            secondToken,
          )
        ).body[0].interests,
      ).toBe("Narrativa privada");
      // Revoke only the first of two active sessions; RLS must reject the old
      // JWT for writes/private reads while preserving the refreshed session.
      const originalToken = owner.token;
      expect(
        (await api("/auth/v1/logout?scope=local", originalToken, "POST"))
          .status,
      ).toBe(204);
      expect(
        (
          await api(
            `/rest/v1/private_user_settings?user_id=eq.${owner.id}`,
            originalToken,
          )
        ).body,
      ).toEqual([]);
      expect(
        (
          await api(
            `/rest/v1/private_user_settings?user_id=eq.${owner.id}`,
            originalToken,
            "PATCH",
            { interests: "revoked bypass" },
          )
        ).body,
      ).toEqual([]);
      expect(
        (
          await api(
            `/rest/v1/profiles?id=eq.${owner.id}`,
            originalToken,
            "PATCH",
            { bio: "revoked bypass" },
          )
        ).body,
      ).toEqual([]);
      // Public profile SELECT remains public by design; it contains no private data.
      expect(
        (
          await api(
            `/rest/v1/private_user_settings?user_id=eq.${owner.id}`,
            secondToken,
          )
        ).body[0].interests,
      ).toBe("Narrativa privada");
      expect(
        (
          await api(
            `/rest/v1/profiles?id=eq.${owner.id}`,
            secondToken,
            "PATCH",
            { bio: "owner bio" },
          )
        ).body,
      ).toHaveLength(1);
      expect(
        (
          await api(
            `/rest/v1/private_user_settings?user_id=eq.${owner.id}`,
            secondToken,
            "PATCH",
            { interests: "Narrativa privada" },
          )
        ).body,
      ).toHaveLength(1);
      owner.token = secondToken;
      const promotion = {
        target: owner.id,
        role: "critic",
        status: "active",
        criticVerified: false,
        reason: "Validación académica G1",
      };
      for (const body of [null, [], {}, "bad-json"]) {
        expect(
          (
            await api(
              "/functions/v1/admin-identity",
              admin.token,
              "POST",
              body,
              body === "bad-json",
            )
          ).status,
        ).toBe(400);
      }
      expect(
        (
          await api("/functions/v1/admin-identity", admin.token, "POST", {
            ...promotion,
            target: admin.id,
          })
        ).status,
      ).toBe(403);
      db(
        `update private.authz set status='suspended' where user_id='${admin.id}';`,
      );
      expect(
        (
          await api(
            "/functions/v1/admin-identity",
            admin.token,
            "POST",
            promotion,
          )
        ).status,
      ).toBe(403);
      db(
        `update private.authz set status='active' where user_id='${admin.id}';`,
      );
      const concurrent = await Promise.all([
        api("/functions/v1/admin-identity", admin.token, "POST", {
          ...promotion,
          target: third.id,
          role: "critic",
          reason: "Concurrent update first",
        }),
        api("/functions/v1/admin-identity", admin.token, "POST", {
          ...promotion,
          target: third.id,
          role: "moderator",
          reason: "Concurrent update second",
        }),
      ]);
      expect(concurrent.map((result) => result.status)).toEqual([200, 200]);
      const auditChain = JSON.parse(
        db(
          `select jsonb_agg(jsonb_build_object('before', before_data, 'after', after_data) order by id) from private.audit_logs where target_id='${third.id}' and actor_id='${admin.id}';`,
        ),
      );
      expect(auditChain).toHaveLength(2);
      expect(auditChain[0].before.role).toBe("user");
      expect(auditChain[1].before).toEqual(auditChain[0].after);
      expect(
        db(`select role::text from private.authz where user_id='${third.id}';`),
      ).toBe(auditChain[1].after.role);
      expect(
        (
          await api(
            "/functions/v1/admin-identity",
            moderator.token,
            "POST",
            promotion,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await api(
            "/functions/v1/admin-identity",
            admin.token,
            "POST",
            promotion,
          )
        ).status,
      ).toBe(200);
      expect(
        (await api("/functions/v1/identity", owner.token, "POST", {})).body
          .role,
      ).toBe("critic");
      expect(
        db(
          `select count(*) from private.audit_logs where actor_id='${admin.id}' and target_id='${owner.id}';`,
        ),
      ).toBe("1");
      expect(
        (
          await api("/functions/v1/admin-identity", admin.token, "POST", {
            ...promotion,
            status: "suspended",
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await api(
            `/rest/v1/private_user_settings?user_id=eq.${owner.id}`,
            secondToken,
          )
        ).body,
      ).toEqual([]);
      expect(
        (
          await api(
            `/rest/v1/profiles?id=eq.${owner.id}`,
            secondToken,
            "PATCH",
            { bio: "suspended hijack" },
          )
        ).body,
      ).toEqual([]);
      expect(
        (await api("/rest/v1/profiles?id=eq." + owner.id, third.token)).body[0]
          .bio,
      ).toBe("owner bio");
      // Existing admin token loses administrative authority immediately after trusted revocation.
      db(`update private.authz set role='user' where user_id='${admin.id}';`);
      expect(
        (
          await api(
            "/functions/v1/admin-identity",
            admin.token,
            "POST",
            promotion,
          )
        ).status,
      ).toBe(403);
      expect(
        (await api("/functions/v1/identity", undefined, "POST", {})).status,
      ).toBe(401);
      expect(
        (await authClient.auth.signOut({ scope: "local" })).error,
      ).toBeNull();
      expect((await authClient.auth.getSession()).data.session).toBeNull();
      expect(
        (await api("/functions/v1/identity", secondToken, "POST", {})).status,
      ).toBeGreaterThanOrEqual(400);
      // Concurrent real HTTP signups race on the DB unique index, not a client precheck.
      const raceAlias = `Race_${suffix}`;
      const candidates = [0, 1].map(() => ({
        email: `g1-${randomUUID()}@example.invalid`,
        password: `Gh1!${randomUUID()}`,
      }));
      const results = await Promise.all(
        candidates.map((item, index) =>
          client().auth.signUp({
            ...item,
            options: {
              data: { username: index ? raceAlias.toLowerCase() : raceAlias },
            },
          }),
        ),
      );
      const winners = results.filter((result) => result.data.session);
      expect(winners).toHaveLength(1);
      for (let i = 0; i < results.length; i++)
        if (results[i].data.user)
          accounts.push({
            id: results[i].data.user!.id,
            token: "",
            ...candidates[i],
          });
      expect(
        db(
          `select count(*) from public.profiles where username_normalized=lower('${raceAlias}');`,
        ),
      ).toBe("1");
      expect(
        db(
          `select count(*) from auth.users where email in ('${candidates[0].email}','${candidates[1].email}');`,
        ),
      ).toBe("1");
    } finally {
      for (const account of accounts)
        db(
          `delete from private.audit_logs where actor_id='${account.id}' or target_id='${account.id}'; delete from auth.users where id='${account.id}';`,
        );
    }
  }, 120000);
});
