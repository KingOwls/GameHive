// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  reviewFixtures,
  reviewApi,
  reviewDb,
  reviewPayload,
} from "../helpers/reviews-local";
import { criticalFixture } from "../helpers/critical";
import type { CriticalOptions } from "../../src/domain/models";
describe.skipIf(process.env.GH_RUN_REVIEWS !== "1")(
  "GH-022 real local Auth/Edge/DB",
  () => {
    it("critical score, historical roles/bank, explicit conversion, privacy, optimistic races and atomic audit", async () => {
      const f = await reviewFixtures();
      const [user, , critic, moderator, admin] = f.accounts;
      const write = (
        action: string,
        gameId: string,
        token = critic.token,
        version?: number,
        input: unknown = reviewPayload,
      ) =>
        reviewApi("/functions/v1/reviews", token, "POST", {
          action,
          gameId,
          version,
          input,
        });
      const own = (gameId = f.manualId, token = critic.token) =>
        reviewApi(
          `/functions/v1/reviews?${new URLSearchParams({ gameId })}`,
          token,
        );
      const options = async (gameId: string) => {
        const result = await reviewApi(
          `/functions/v1/reviews?${new URLSearchParams({ gameId, questions: "1" })}`,
          critic.token,
        );
        expect(result.status).toBe(200);
        return result.data as CriticalOptions;
      };
      const publicDetails = (table = "review_critic_details") =>
        reviewApi(`/rest/v1/${table}?select=*`);
      let bankId = "";
      try {
        for (const gameId of [f.manualId, f.rawgId]) {
          const q = await options(gameId);
          expect(q.questions.length).toBeGreaterThanOrEqual(2);
          expect(q.questions.length).toBeLessThanOrEqual(12);
          const input = {
            ...reviewPayload,
            rating: 10,
            critical: criticalFixture(q),
            role: "admin",
            critic_verified: true,
          };
          if (gameId === f.rawgId) {
            input.bodyPublic = "😀".repeat(10000);
            input.bodySpoiler = "🎮".repeat(20000);
            input.critical.scoreReason = "🚀".repeat(2000);
            for (const criterion of Object.values(input.critical.criteria))
              criterion.explanation = "🌟".repeat(1000);
            expect(
              new TextEncoder().encode(JSON.stringify(input)).length,
            ).toBeGreaterThan(160000);
          }
          for (const token of [user.token, moderator.token, admin.token])
            expect(
              (await write("create", gameId, token, undefined, input)).status,
            ).toBe(403);
          for (const critical of [
            { ...input.critical, platform: "Unknown platform" },
            { ...input.critical, answers: [] },
            {
              ...input.critical,
              criteria: {
                ...input.critical.criteria,
                gameplay: {
                  score: 10.001,
                  explanation: "Explanation outside allowed precision.",
                },
              },
            },
          ])
            expect(
              (
                await write("create", gameId, critic.token, undefined, {
                  ...input,
                  critical,
                })
              ).status,
            ).toBe(400);
          const created = await write(
            "create",
            gameId,
            critic.token,
            undefined,
            input,
          );
          expect(created.status).toBe(201);
          expect(Number(created.data.rating)).toBe(5.5);
          expect(created.data.kind).toBe("critic");
          expect(created.data.critic_verified).toBe(false);
          expect(created.data.body_public === input.bodyPublic).toBe(true);
          expect(created.data.body_spoiler === input.bodySpoiler).toBe(true);
          expect(
            created.data.critical.answers
              .map((a: { question_id: string }) => a.question_id)
              .sort(),
          ).toEqual(q.questions.map((q) => q.id).sort());
          expect((await own(gameId)).data.id).toBe(created.data.id);
          expect(
            (await write("create", gameId, critic.token, undefined, input))
              .status,
          ).toBe(409);
          const critical = {
            ...input.critical,
            criteria: {
              ...input.critical.criteria,
              gameplay: {
                score: 10,
                explanation:
                  "Una revisión distinta del criterio de jugabilidad.",
              },
            },
          };
          expect(
            (
              await write("update", gameId, critic.token, 1, {
                ...input,
                critical,
              })
            ).status,
          ).toBe(400);
          const edits = await Promise.all([
            write("update", gameId, critic.token, 1, {
              ...input,
              critical,
              bodyPublic:
                "Una segunda experiencia permite una opinión pública diferente y revisada.",
            }),
            write("update", gameId, critic.token, 1, {
              ...input,
              critical,
              bodyPublic:
                "Una tercera experiencia también propone una nueva opinión pública.",
            }),
          ]);
          expect(edits.map((r) => r.status).sort()).toEqual([200, 409]);
          expect(Number((await own(gameId)).data.rating)).toBe(6.5);
          if (gameId === f.manualId) {
            const q0 = q.questions[0];
            bankId = reviewDb(
              `insert into public.critic_questions(question_key,version,genre,prompt,position) values('${q0.question_key}',${q0.version + 100},'*','Pregunta editorial nueva publicada durante la prueba de versiones.',0) returning id;`,
            ).split("\n")[0];
            expect(/^[0-9a-f-]{36}$/.test(bankId)).toBe(true);
            expect(
              (await options(gameId)).questions.some((q) => q.id === bankId),
            ).toBe(true);
            const stored = (await own(gameId)).data;
            expect(
              (
                await write("update", gameId, critic.token, 2, {
                  ...input,
                  critical,
                  bodyPublic: stored.body_public,
                })
              ).status,
            ).toBe(200);
            expect(
              (await own(gameId)).data.critical.answers.some(
                (a: { question_id: string }) => a.question_id === q0.id,
              ),
            ).toBe(true);
          }
        }
        const stored = (await own()).data;
        expect(
          (await publicDetails()).data.some(
            (d: { review_id: string }) => d.review_id === stored.id,
          ),
        ).toBe(true);
        reviewDb(
          `update private.authz set role='user' where user_id='${critic.id}';`,
        );
        const historical = {
          ...reviewPayload,
          rating: 10,
          bodyPublic:
            "Texto básico nuevo del autor que ahora tiene rol de jugador.",
        };
        expect(
          (
            await write("update", f.manualId, critic.token, stored.version, {
              ...historical,
              critical: criticalFixture(await options(f.manualId)),
            })
          ).status,
        ).toBe(403);
        const basic = await write(
          "update",
          f.manualId,
          critic.token,
          stored.version,
          historical,
        );
        expect(basic.status).toBe(200);
        expect(basic.data.kind).toBe("critic");
        expect(Number(basic.data.rating)).toBe(6.5);
        expect(
          (
            await write(
              "withdraw",
              f.manualId,
              critic.token,
              basic.data.version,
            )
          ).status,
        ).toBe(200);
        expect(
          (await publicDetails()).data.some(
            (d: { review_id: string }) => d.review_id === stored.id,
          ),
        ).toBe(false);
        expect(
          (await publicDetails("review_critic_answers")).data.some(
            (d: { review_id: string }) => d.review_id === stored.id,
          ),
        ).toBe(false);
        expect(
          (
            await write(
              "republish",
              f.manualId,
              critic.token,
              basic.data.version + 1,
            )
          ).status,
        ).toBe(200);
        reviewDb(
          `update private.authz set status='suspended' where user_id='${critic.id}';`,
        );
        expect((await own()).status).toBe(403);
        expect(
          (await publicDetails()).data.some(
            (d: { review_id: string }) => d.review_id === stored.id,
          ),
        ).toBe(false);
        reviewDb(
          `update private.authz set status='active',role='critic',critic_verified=true where user_id='${critic.id}';`,
        );
        expect((await own()).data.critic_verified).toBe(true);
        // A critic may maintain an ordinary review and explicitly convert its withdrawn identity.
        const ordinary = await write("create", f.manualId, user.token);
        expect(ordinary.status).toBe(201);
        expect(ordinary.data.kind).toBe("user");
        expect((await write("convert", f.manualId, user.token, 1)).status).toBe(
          403,
        );
        reviewDb(
          `update private.authz set role='critic' where user_id='${user.id}';`,
        );
        expect(
          (await write("update", f.manualId, user.token, 1)).data.kind,
        ).toBe("user");
        expect(
          (await write("withdraw", f.manualId, user.token, 2)).status,
        ).toBe(200);
        const conversion = {
          ...reviewPayload,
          bodyPublic:
            "Esta nueva opinión pública acompaña la conversión explícita del análisis.",
          critical: criticalFixture(await options(f.manualId)),
        };
        reviewDb(
          `create function private.${f.hook}() returns trigger language plpgsql as $$begin raise exception 'Isolated critical audit fault'; end;$$; create trigger ${f.hook} before insert on private.audit_logs for each row when(new.actor_id='${user.id}'::uuid) execute function private.${f.hook}();`,
        );
        expect(
          (await write("convert", f.manualId, user.token, 3, conversion))
            .status,
        ).toBe(503);
        expect((await own(f.manualId, user.token)).data.kind).toBe("user");
        expect((await own(f.manualId, user.token)).data.version).toBe(3);
        reviewDb(
          `drop trigger ${f.hook} on private.audit_logs;drop function private.${f.hook}();`,
        );
        const converted = await write(
          "convert",
          f.manualId,
          user.token,
          3,
          conversion,
        );
        expect(converted.status).toBe(200);
        expect(converted.data.id).toBe(ordinary.data.id);
        expect(converted.data.status).toBe("withdrawn");
        expect(converted.data.kind).toBe("critic");
        expect(
          (await write("convert", f.manualId, user.token, 4, conversion))
            .status,
        ).toBe(409);
        for (const account of f.accounts)
          for (const table of [
            "review_critic_details",
            "review_critic_answers",
            "critic_questions",
          ]) {
            expect(
              (
                await reviewApi(
                  `/rest/v1/${table}?${table === "critic_questions" ? "id" : "review_id"}=eq.${table === "critic_questions" ? bankId : stored.id}`,
                  account.token,
                  "PATCH",
                  table === "critic_questions"
                    ? { enabled: false }
                    : { review_id: stored.id },
                )
              ).status,
            ).toBe(403);
          }
        reviewDb(
          `update public.reviews set status='hidden' where id='${stored.id}';`,
        );
        expect(
          (
            await write(
              "update",
              f.manualId,
              critic.token,
              (await own()).data.version,
              {
                ...reviewPayload,
                critical: criticalFixture(await options(f.manualId)),
              },
            )
          ).status,
        ).toBe(403);
        reviewDb(`delete from auth.sessions where id='${critic.session}';`);
        expect([401, 403]).toContain((await own()).status);
      } finally {
        f.cleanup();
        if (bankId)
          reviewDb(`delete from public.critic_questions where id='${bankId}';`);
      }
    }, 90000);
  },
);
