// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  reviewFixtures,
  reviewApi,
  reviewDb,
  reviewPayload,
} from "../helpers/reviews-local";
describe.skipIf(process.env.GH_RUN_REVIEWS !== "1")(
  "GH-020/021 real local Auth/Edge/DB",
  () => {
    it(`${process.env.GH_REVIEWS_ISOLATED === "1" ? "isolated catalog contract" : "real persisted RAWG/manual"}: concurrency, current session/role, version, withdrawal, audit rollback and clean Data API`, async () => {
      const f = await reviewFixtures();
      const [owner, other, critic, moderator, admin] = f.accounts;
      const write = (
        action: string,
        gameId = f.manualId,
        version?: number,
        input: unknown = reviewPayload,
        token = owner.token,
      ) =>
        reviewApi("/functions/v1/reviews", token, "POST", {
          action,
          gameId,
          version,
          input,
        });
      const own = (token = owner.token, game = f.manualId) =>
        reviewApi(
          `/functions/v1/reviews?${new URLSearchParams({ gameId: game })}`,
          token,
        );
      const publicRows = (game = f.manualId) =>
        reviewApi(
          `/rest/v1/reviews?${new URLSearchParams({ select: "*,profiles!author_id(username,avatar_key)", [game.startsWith("manual:") ? "manual_game_id" : "game_id"]: `eq.${game.startsWith("manual:") ? game.slice(7) : game}` })}`,
        );
      const fingerprint = () =>
        reviewDb(
          "select md5(coalesce(string_agg(id||document::text,'' order by id),'')) from public.games;",
        );
      const before = fingerprint();
      try {
        expect(
          (
            await reviewApi("/functions/v1/reviews", undefined, "POST", {
              action: "create",
              gameId: f.manualId,
              input: reviewPayload,
            })
          ).status,
        ).toBe(401);
        expect((await own()).data).toBeNull();
        for (const account of [critic, moderator, admin])
          expect(
            (
              await write(
                "create",
                f.manualId,
                undefined,
                reviewPayload,
                account.token,
              )
            ).status,
          ).toBe(403);
        for (const game of [
          "offline",
          "rawg:999999999",
          "manual:00000000-0000-0000-0000-000000000001",
        ])
          expect((await write("create", game)).status).toBe(400);
        for (const patch of [
          { rating: 11 },
          { rating: "NaN" },
          { title: "aa" },
          { bodyPublic: "short" },
          { bodySpoiler: "x".repeat(20001) },
          { pros: ["x".repeat(201)] },
        ])
          expect(
            (
              await write("create", f.manualId, undefined, {
                ...reviewPayload,
                ...patch,
              })
            ).status,
          ).toBe(400);
        // Private audit failure aborts both row and success audit.
        reviewDb(
          `create function private.${f.hook}() returns trigger language plpgsql as $$begin raise exception 'Isolated audit fault'; end;$$;create trigger ${f.hook} before insert on private.audit_logs for each row when (new.actor_id='${owner.id}'::uuid) execute function private.${f.hook}();`,
        );
        const failed = await write("create");
        expect(failed.status).toBe(503);
        expect(JSON.stringify(failed.data)).not.toMatch(
          /Isolated|postgres|select |password|token/i,
        );
        expect((await own()).data).toBeNull();
        reviewDb(
          `drop trigger ${f.hook} on private.audit_logs;drop function private.${f.hook}();`,
        );
        const race = await Promise.all([write("create"), write("create")]);
        expect(race.map((r) => r.status).sort()).toEqual([201, 409]);
        const first = race.find((r) => r.status === 201)!.data;
        expect((await own()).data.id).toBe(first.id);
        const rows = await publicRows();
        expect(rows.status).toBe(200);
        expect(rows.data).toHaveLength(1);
        expect(rows.data[0].profiles).toEqual({
          username: owner.username,
          avatar_key: "hive",
        });
        expect(JSON.stringify(rows.data)).not.toContain(owner.email);
        // Supplying another author or review ID cannot redirect the actor derived from JWT.
        expect(
          (
            await write(
              "update",
              f.manualId,
              1,
              { ...reviewPayload, author_id: owner.id, id: first.id },
              other.token,
            )
          ).status,
        ).toBe(404);
        expect((await own(other.token)).data).toBeNull();
        expect((await write("update", f.manualId, 9)).status).toBe(409);
        for (const patch of [
          { rating: 8 },
          { rating: 8, title: "Otro título", bodySpoiler: "Otro spoiler" },
          {
            rating: 8,
            bodyPublic: reviewPayload.bodyPublic.replaceAll(" ", " \u00a0\n "),
          },
        ])
          expect(
            (
              await write("update", f.manualId, 1, {
                ...reviewPayload,
                ...patch,
              })
            ).status,
          ).toBe(400);
        const edits = await Promise.all([
          write("update", f.manualId, 1, {
            ...reviewPayload,
            rating: 8,
            bodyPublic:
              "Una segunda lectura descubre una experiencia más completa.",
          }),
          write("update", f.manualId, 1, {
            ...reviewPayload,
            rating: 9,
            bodyPublic:
              "Otra sesión presenta una nueva opinión sobre la experiencia.",
          }),
        ]);
        expect(edits.map((r) => r.status).sort()).toEqual([200, 409]);
        expect((await own()).data.version).toBe(2);
        expect((await write("withdraw", f.manualId, 2)).data).toMatchObject({
          id: first.id,
          status: "withdrawn",
          version: 3,
        });
        expect((await publicRows()).data).toHaveLength(0);
        expect((await own()).data.status).toBe("withdrawn");
        expect((await write("create")).status).toBe(409);
        expect((await write("republish", f.manualId, 3)).data).toMatchObject({
          id: first.id,
          status: "published",
          version: 4,
        });
        expect((await publicRows()).data).toHaveLength(1);
        // Same real user independently creates a review for a persisted RAWG title.
        const unicodeCreate = {
          ...reviewPayload,
          bodyPublic: "😀".repeat(6000),
          bodySpoiler: "🎮".repeat(12000),
        };
        expect(
          Buffer.byteLength(JSON.stringify(unicodeCreate)),
        ).toBeGreaterThan(20000);
        const rawg = await write("create", f.rawgId, undefined, unicodeCreate);
        expect(rawg.status).toBe(201);
        expect(rawg.data.game_id).toBe(f.rawgId);
        expect(
          (await publicRows(f.rawgId)).data.some(
            (r: { id: string }) => r.id === rawg.data.id,
          ),
        ).toBe(true);
        const assertUnicodeReadback = async (input: typeof unicodeCreate) => {
          const ownResult = await own(owner.token, f.rawgId);
          expect(ownResult.status).toBe(200);
          expect(
            ownResult.data.body_public === input.bodyPublic,
            "exact own Unicode public body",
          ).toBe(true);
          expect(
            ownResult.data.body_spoiler === input.bodySpoiler,
            "exact own Unicode spoiler body",
          ).toBe(true);
          const publicResult = await publicRows(f.rawgId);
          expect(publicResult.status).toBe(200);
          const persisted = publicResult.data.find(
            (item: { id: string }) => item.id === rawg.data.id,
          );
          expect(
            persisted?.body_public === input.bodyPublic,
            "exact public Unicode public body",
          ).toBe(true);
          expect(
            persisted?.body_spoiler === input.bodySpoiler,
            "exact public Unicode spoiler body",
          ).toBe(true);
        };
        await assertUnicodeReadback(unicodeCreate);
        const unicodeUpdate = {
          ...unicodeCreate,
          rating: 8,
          bodyPublic: "🚀".repeat(6500),
          bodySpoiler: "🌟".repeat(12500),
        };
        expect(
          Buffer.byteLength(JSON.stringify(unicodeUpdate)),
        ).toBeGreaterThan(20000);
        const updatedUnicode = await write(
          "update",
          f.rawgId,
          1,
          unicodeUpdate,
        );
        expect(updatedUnicode.status).toBe(200);
        expect(updatedUnicode.data.version).toBe(2);
        await assertUnicodeReadback(unicodeUpdate);
        for (const token of [undefined, ...f.accounts.map((a) => a.token)])
          for (const method of ["POST", "PATCH", "DELETE"]) {
            const result = await reviewApi(
              `/rest/v1/reviews${method === "POST" ? "" : `?id=eq.${first.id}`}`,
              token,
              method,
              method === "DELETE"
                ? undefined
                : { rating: 10, author_id: other.id, game_id: f.rawgId },
            );
            expect(result.status).toBe(token ? 403 : 401);
          }
        reviewDb(
          `update private.authz set status='suspended' where user_id='${owner.id}';`,
        );
        expect((await publicRows()).data).toHaveLength(0);
        expect((await own()).status).toBe(403);
        expect((await write("update", f.manualId, 4)).status).toBe(403);
        reviewDb(
          `update private.authz set status='active' where user_id='${owner.id}';update public.reviews set status='hidden' where id='${first.id}';`,
        );
        expect((await publicRows()).data).toHaveLength(0);
        expect((await own()).data.status).toBe("hidden");
        for (const action of ["update", "withdraw", "republish"])
          expect((await write(action, f.manualId, 4)).status).toBe(403);
        expect(
          reviewDb(
            `select count(*) from private.audit_logs where actor_id='${owner.id}' and action like 'review.%';`,
          ),
        ).toBe("6");
        expect(
          reviewDb(
            `select count(*) from private.audit_logs where actor_id='${other.id}' and action like 'review.%';`,
          ),
        ).toBe("0");
        // Session deletion while retaining a signed JWT must not authorize a write.
        reviewDb(`delete from auth.sessions where id='${owner.session}';`);
        expect([401, 403]).toContain((await own()).status);
        expect([401, 403]).toContain(
          (await write("update", f.rawgId, 1)).status,
        );
        expect(fingerprint()).toBe(before);
      } finally {
        f.cleanup();
      }
    }, 90000);
  },
);
