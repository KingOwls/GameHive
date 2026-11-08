// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  applicationFixtures,
  applicationInput,
} from "../helpers/applications-local";
import { reviewApi, reviewDb, reviewsOrigin } from "../helpers/reviews-local";
describe.skipIf(process.env.GH_RUN_APPLICATIONS !== "1")(
  "GH023 real local Auth/Edge/DB",
  () => {
    it("private evidence, four roles, resolution, cooldown, cancellation and own suspended notices", async () => {
      const f = await applicationFixtures();
      const [owner, other, critic, mod, admin] = f.accounts;
      try {
        expect(
          (
            await reviewApi(
              "/functions/v1/critic-applications",
              undefined,
              "POST",
              { operation: "own-history", input: { page: 1 } },
            )
          ).status,
        ).toBe(401);
        for (const [operation, input] of [
          ["admin-history", { page: 1 }],
          ["admin-get", { id: owner.id }],
        ] as const) {
          expect(
            (
              await reviewApi(
                "/functions/v1/critic-applications",
                undefined,
                "POST",
                { operation, input },
              )
            ).status,
          ).toBe(401);
        }
        const baseBody = JSON.stringify({
          operation: "own-history",
          input: { page: 1 },
        });
        for (const size of [65536, 65537]) {
          const response = await fetch(
            `${reviewsOrigin}/functions/v1/critic-applications`,
            {
              method: "POST",
              headers: {
                apikey: process.env.GH_LOCAL_API_KEY!,
                Authorization: `Bearer ${owner.token}`,
                "Content-Type": "application/json",
              },
              body:
                baseBody +
                " ".repeat(
                  size - new TextEncoder().encode(baseBody).byteLength,
                ),
              signal: AbortSignal.timeout(15000),
            },
          );
          expect(response.status).toBe(size === 65536 ? 200 : 400);
        }
        for (const who of [mod, admin])
          expect(
            (await f.op("submit", applicationInput, who.token)).status,
          ).toBe(403);
        expect(
          (await f.op("submit", { ...applicationInput, user_id: other.id }))
            .status,
        ).toBe(400);
        expect(
          (
            await f.op("submit", {
              ...applicationInput,
              links: ["http://example.com"],
            })
          ).status,
        ).toBe(400);
        for (const whitespace of ["\n", "\t", "\u00a0", "\u2028", "\ufeff"]) {
          expect(
            (
              await f.op("submit", {
                ...applicationInput,
                experience: whitespace.repeat(40),
              })
            ).status,
          ).toBe(400);
          expect(
            (
              await f.op("submit", {
                ...applicationInput,
                organization: whitespace.repeat(3),
              })
            ).status,
          ).toBe(400);
        }
        const results = await Promise.all([
          f.op("submit", {
            ...applicationInput,
            organization: "\n\u00a0" + applicationInput.organization + "\ufeff",
            links: ["HTTPS://example.com/evidence"],
          }),
          f.op("submit", applicationInput),
        ]);
        expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
        const a = results.find((r) => r.status === 201)!.data;
        expect(a.organization).toBe(applicationInput.organization);
        const adminQueue = await f.op("admin-queue", { page: 1 }, admin.token);
        expect(
          adminQueue.data.items.find((i: { id: string }) => i.id === a.id)
            .current_authority,
        ).toEqual({ role: "user", status: "active", critic_verified: false });
        expect(
          (await f.op("own-history", { page: 1 }, other.token)).data.items,
        ).toEqual([]);
        for (const who of [owner, other, critic, mod]) {
          expect(
            (await f.op("admin-history", { page: 1 }, who.token)).status,
          ).toBe(403);
          expect(
            (await f.op("admin-get", { id: a.id }, who.token)).status,
          ).toBe(403);
          expect(
            (await f.op("admin-queue", { page: 1 }, who.token)).status,
          ).toBe(403);
          expect(
            (
              await f.op(
                "resolve",
                {
                  id: a.id,
                  version: 1,
                  decision: "approved",
                  reason: "Admisión humana motivada",
                },
                who.token,
              )
            ).status,
          ).toBe(403);
        }
        const decision = {
          id: a.id,
          version: 1,
          decision: "approved",
          reason: "Admisión humana motivada",
        };
        expect(
          (await f.op("resolve", { ...decision, version: 2 }, admin.token))
            .status,
        ).toBe(409);
        const resolved = await Promise.all([
          f.op("resolve", decision, admin.token),
          f.op("resolve", decision, admin.token),
        ]);
        expect(resolved.map((r) => r.status).sort()).toEqual([200, 409]);
        expect(
          reviewDb(
            `select role||':'||critic_verified from private.authz where user_id='${owner.id}'`,
          ),
        ).toBe("critic:true");
        const exact = await f.op("admin-get", { id: a.id }, admin.token);
        expect(exact.status).toBe(200);
        expect(exact.data).toMatchObject({
          status: "approved",
          resolved_by: admin.id,
          reason: decision.reason,
          current_authority: {
            role: "critic",
            status: "active",
            critic_verified: true,
          },
        });
        expect(
          (
            await f.op("admin-history", { page: 1 }, admin.token)
          ).data.items.some((i: { id: string }) => i.id === a.id),
        ).toBe(true);
        const history = await f.op("own-history", { page: 1 });
        expect(history.data.items[0].status).toBe("approved");
        expect(JSON.stringify(history.data)).not.toContain(owner.email);
        let notices = await f.op("own-notices", { page: 1 });
        expect(notices.data.items).toHaveLength(1);
        const id = notices.data.items[0].id;
        expect((await f.op("markRead", { id }, other.token)).status).toBe(403);
        reviewDb(
          `update private.authz set status='suspended' where user_id='${owner.id}'`,
        );
        expect((await f.op("own-history", { page: 1 })).status).toBe(403);
        expect((await f.op("own-notices", { page: 1 })).status).toBe(200);
        expect((await f.op("markRead", { id })).status).toBe(200);
        reviewDb(`delete from auth.sessions where id='${owner.session}'`);
        expect((await f.op("own-notices", { page: 1 })).status).toBe(401);
        const c = (await f.op("submit", applicationInput, critic.token)).data;
        reviewDb(
          `update private.authz set critic_verified=true where user_id='${critic.id}'`,
        );
        const ci = {
          id: c.id,
          version: 1,
          reason: "Cambio de sello verificado",
        };
        expect(
          (await f.op("resolve", { ...ci, decision: "approved" }, admin.token))
            .status,
        ).toBe(409);
        expect(
          (await f.op("admin-get", { id: c.id }, admin.token)).data
            .current_authority.critic_verified,
        ).toBe(true);
        expect(
          (
            await f.op(
              "cancel",
              { ...ci, reason: "\n".repeat(10) },
              admin.token,
            )
          ).status,
        ).toBe(400);
        expect((await f.op("cancel", ci, admin.token)).status).toBe(200);
        expect(
          (await f.op("admin-get", { id: c.id }, admin.token)).data.status,
        ).toBe("cancelled");
        reviewDb(
          `update private.authz set critic_verified=false where user_id='${critic.id}'`,
        );
        const c2 = (await f.op("submit", applicationInput, critic.token)).data;
        expect(c2.id).not.toBe(c.id);
        expect(
          (
            await f.op(
              "resolve",
              {
                id: c2.id,
                version: 1,
                decision: "rejected",
                reason: "Muestra insuficiente para admitir",
              },
              admin.token,
            )
          ).status,
        ).toBe(200);
        expect(
          (await f.op("submit", applicationInput, critic.token)).status,
        ).toBe(409);
        reviewDb(
          `update private.critic_applications set created_at=clock_timestamp()-interval '8 days',resolved_at=clock_timestamp()-interval '168 hours' where id='${c2.id}'`,
        );
        expect(
          (await f.op("submit", applicationInput, critic.token)).status,
        ).toBe(201);
        notices = await f.op("own-notices", { page: 1 }, critic.token);
        expect(notices.data.items).toHaveLength(2);
        const client = createClient(
          reviewsOrigin,
          process.env.GH_LOCAL_API_KEY!,
          { auth: { persistSession: false } },
        );
        const signed = await client.auth.signInWithPassword({
          email: other.email,
          password: other.password,
        });
        expect(signed.error).toBeNull();
        expect(
          (
            await f.op(
              "own-history",
              { page: 1 },
              signed.data.session!.access_token,
            )
          ).data.total,
        ).toBe(0);
        // Stable private pagination, including equal timestamps and a second page.
        reviewDb(`with applications as (
          insert into private.critic_applications(user_id,organization,experience,sample,links,expected_role,expected_status,expected_verified,status,version,created_at,resolved_at,resolved_by,reason)
          select '${other.id}','Independiente',repeat('x',40),repeat('s',40),'[]','user','active',false,'cancelled',2,clock_timestamp()-interval '1 day',clock_timestamp(),'${admin.id}','Anulación motivada de fixture' from generate_series(1,21) returning *
        ) insert into private.application_notices(user_id,application_id,outcome,reason,created_at) select user_id,id,status,reason,'2026-11-01'::timestamptz from applications`);
        const adminFirst = await f.op(
          "admin-history",
          { page: 1 },
          admin.token,
        );
        const adminSecond = await f.op(
          "admin-history",
          { page: 2 },
          admin.token,
        );
        expect(adminFirst.data.items).toHaveLength(20);
        expect(adminSecond.data.items.length).toBeGreaterThan(0);
        expect(adminFirst.data.total).toBe(adminSecond.data.total);
        expect(
          new Set(
            [...adminFirst.data.items, ...adminSecond.data.items].map(
              (i: { id: string }) => i.id,
            ),
          ).size,
        ).toBe(adminFirst.data.items.length + adminSecond.data.items.length);
        const first = await f.op("own-notices", { page: 1 }, other.token),
          secondPage = await f.op("own-notices", { page: 2 }, other.token);
        expect(first.data.items).toHaveLength(20);
        expect(secondPage.data.items).toHaveLength(1);
        expect(first.data.total).toBe(21);
        expect(
          new Set(
            [...first.data.items, ...secondPage.data.items].map(
              (n: { id: string }) => n.id,
            ),
          ).size,
        ).toBe(21);
        expect(
          (await f.op("own-history", { page: 1 }, other.token)).data.items,
        ).toHaveLength(20);
        reviewDb(
          `update private.authz set critic_verified=true where user_id='${other.id}'`,
        );
        expect(
          (await f.op("own-history", { page: 1 }, other.token)).data.eligible,
        ).toBe(true);
        const priorSeal = await f.op("submit", applicationInput, other.token);
        expect(priorSeal.status).toBe(201);
        expect(priorSeal.data.expected_verified).toBe(true);
        expect(
          reviewDb(
            `select role||':'||critic_verified from private.authz where user_id='${other.id}'`,
          ),
        ).toBe("user:true");
        reviewDb(
          `update private.authz set critic_verified=false where user_id='${other.id}'`,
        );
        const priorDecision = {
          id: priorSeal.data.id,
          version: 1,
          reason: "El sello anterior cambió antes de resolver",
        };
        expect(
          (
            await f.op(
              "resolve",
              { ...priorDecision, decision: "approved" },
              admin.token,
            )
          ).status,
        ).toBe(409);
        expect((await f.op("cancel", priorDecision, admin.token)).status).toBe(
          200,
        );
        reviewDb(
          `update private.authz set critic_verified=true where user_id='${other.id}'`,
        );
        const unchanged = await f.op("submit", applicationInput, other.token);
        expect(unchanged.status).toBe(201);
        expect(unchanged.data.expected_verified).toBe(true);
        expect(
          (
            await f.op(
              "resolve",
              {
                id: unchanged.data.id,
                version: 1,
                decision: "approved",
                reason: "Admisión de usuario con sello previo",
              },
              admin.token,
            )
          ).status,
        ).toBe(200);
        expect(
          reviewDb(
            `select role||':'||critic_verified from private.authz where user_id='${other.id}'`,
          ),
        ).toBe("critic:true");
        reviewDb(
          `update private.authz set status='suspended' where user_id='${admin.id}'`,
        );
        expect(
          (await f.op("admin-get", { id: a.id }, admin.token)).status,
        ).toBe(403);
        expect(
          (await f.op("admin-history", { page: 1 }, admin.token)).status,
        ).toBe(403);
        reviewDb(
          `update private.authz set status='active' where user_id='${admin.id}'`,
        );
        for (const table of ["critic_applications", "application_notices"])
          expect(
            (await reviewApi(`/rest/v1/${table}?select=*`, admin.token)).status,
          ).toBe(404);
        reviewDb(`delete from auth.sessions where id='${admin.session}'`);
        expect(
          (await f.op("admin-get", { id: a.id }, admin.token)).status,
        ).toBe(401);
        expect(
          (await f.op("admin-history", { page: 1 }, admin.token)).status,
        ).toBe(401);
      } finally {
        f.cleanup();
      }
    }, 120000);
  },
);
