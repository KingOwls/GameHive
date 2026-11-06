// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  reviewFixtures,
  reviewApi,
  reviewDb,
  reviewPayload,
} from "../helpers/reviews-local";
describe.skipIf(process.env.GH_RUN_VOTES !== "1")(
  "GH-024 real local Auth/Edge/DB",
  () => {
    it("roles, irreversible race, privacy, own recovery, quota, audit rollback and cascading counts", async () => {
      const f = await reviewFixtures();
      const [author, voter, critic, moderator, admin] = f.accounts;
      let fixtureAuditIds: number[] = [];
      const vote = (
        reviewId: string,
        value: unknown = 1,
        token = voter.token,
        extra = {},
      ) =>
        reviewApi("/functions/v1/review-votes", token, "POST", {
          reviewId,
          value,
          ...extra,
        });
      const own = (ids: string[], token = voter.token) =>
        reviewApi(
          "/functions/v1/review-votes?" +
            new URLSearchParams({ reviewIds: ids.join(",") }),
          token,
        );
      const publicCount = async (id: string) =>
        (
          await reviewApi(
            `/rest/v1/reviews?id=eq.${id}&select=helpful_count,unhelpful_count`,
          )
        ).data[0];
      const create = async (game: string) => {
        const result = await reviewApi(
          "/functions/v1/reviews",
          author.token,
          "POST",
          { action: "create", gameId: game, input: reviewPayload },
        );
        expect(result.status).toBe(201);
        expect(result.data.id).toMatch(/^[0-9a-f-]{36}$/);
        return result.data.id as string;
      };
      try {
        const id = await create(f.manualId),
          rawg = await create(f.rawgId);
        expect(
          (
            await reviewApi("/functions/v1/review-votes", undefined, "POST", {
              reviewId: id,
              value: 1,
            })
          ).status,
        ).toBe(401);
        for (const value of [0, 2, "1", null])
          expect((await vote(id, value)).status).toBe(400);
        for (const extra of [
          { role: "admin" },
          { voterId: author.id },
          { created_at: "2000-01-01" },
        ])
          expect((await vote(id, 1, voter.token, extra)).status).toBe(400);
        expect((await own(Array(11).fill(id))).status).toBe(400);
        expect((await vote(id, 1, author.token)).status).toBe(403);
        const race = await Promise.all([vote(id, 1), vote(id, -1)]);
        expect(race.map((r) => r.status).sort()).toEqual([201, 409]);
        const winner = race.find((r) => r.status === 201)!.data.value;
        expect((await own([id])).data.votes[0].value).toBe(winner);
        expect((await vote(id, winner)).status).toBe(409);
        expect((await vote(id, -winner)).status).toBe(409);
        for (const a of [critic, moderator, admin])
          expect((await vote(id, a === critic ? -1 : 1, a.token)).status).toBe(
            201,
          );
        const counts = await publicCount(id);
        expect(counts.helpful_count + counts.unhelpful_count).toBe(4);
        expect(counts.helpful_count).toBe(winner === 1 ? 3 : 2);
        for (const a of f.accounts) {
          const rows = await reviewApi(
            `/rest/v1/review_votes?review_id=eq.${id}`,
            a.token,
          );
          expect(rows.status).toBe(200);
          expect(rows.data).toHaveLength(a === author ? 0 : 1);
          if (rows.data.length) expect(rows.data[0].voter_id).toBe(a.id);
          for (const method of ["PATCH", "DELETE"])
            expect(
              (
                await reviewApi(
                  `/rest/v1/review_votes?review_id=eq.${id}`,
                  a.token,
                  method,
                  method === "PATCH" ? { value: -1 } : undefined,
                )
              ).status,
            ).toBe(403);
          expect(
            (
              await reviewApi("/rest/v1/review_votes", a.token, "POST", {
                review_id: rawg,
                voter_id: a.id,
                value: 1,
              })
            ).status,
          ).toBe(403);
        }
        expect((await reviewApi("/rest/v1/review_votes")).status).toBe(401);
        reviewDb(
          `update private.authz set role='admin',status='suspended' where user_id='${voter.id}';`,
        );
        expect((await vote(rawg)).status).toBe(403);
        reviewDb(
          `update private.authz set status='active' where user_id='${voter.id}';`,
        );
        expect((await own([id])).data.votes[0].value).toBe(winner);
        reviewDb(
          `update private.authz set status='suspended' where user_id='${author.id}';`,
        );
        expect((await vote(rawg)).status).toBe(403);
        const hiddenOwn = (await own([id])).data.votes[0];
        expect(hiddenOwn.value).toBe(winner);
        expect(hiddenOwn.helpfulCount).toBeNull();
        reviewDb(
          `update private.authz set status='active' where user_id='${author.id}';`,
        );
        for (const status of ["hidden", "withdrawn"]) {
          reviewDb(
            `update public.reviews set status='${status}' where id='${rawg}';`,
          );
          expect((await vote(rawg)).status).toBe(403);
        }
        reviewDb(
          `update public.reviews set status='published' where id='${rawg}';`,
        );
        reviewDb(
          `create function private.${f.hook}() returns trigger language plpgsql as $$begin raise exception 'Isolated audit fault'; end;$$;create trigger ${f.hook} before insert on private.audit_logs for each row when(new.actor_id='${voter.id}'::uuid) execute function private.${f.hook}();`,
        );
        const failed = await vote(rawg);
        expect(failed.status).toBe(503);
        expect(JSON.stringify(failed.data)).not.toMatch(
          /Isolated|postgres|password|token/i,
        );
        expect((await own([rawg])).data.votes[0].value).toBeNull();
        expect((await publicCount(rawg)).helpful_count).toBe(0);
        reviewDb(
          `drop trigger ${f.hook} on private.audit_logs;drop function private.${f.hook}();`,
        );
        // Real transaction with dropped response: recovering own observes the committed vote.
        expect((await vote(rawg, -1)).status).toBe(201);
        expect((await own([id, rawg])).data.votes[1].value).toBe(-1);
        reviewDb(`delete from auth.sessions where user_id='${critic.id}';`);
        expect([401, 403]).toContain(
          (await vote(rawg, 1, critic.token)).status,
        );
        // Additional isolated targets let HTTP test the actual quota edge and race.
        reviewDb(`insert into public.manual_games(id,title,synopsis,platforms,genres,source_url,source_label) select gen_random_uuid(),'Quota target ${f.marker} '||n,'Explicit local isolated vote quota fixture.',array['PC'],array['Test'],'https://example.com/${f.marker}/'||n,'Isolated quota fixture' from generate_series(1,105)n;
    insert into public.reviews(author_id,manual_game_id,rating,title,body_public,author_active) select '${author.id}',id,7,'Quota target','Explicit local isolated vote quota fixture.',true from public.manual_games where source_url like 'https://example.com/${f.marker}/%';`);
        const targets = JSON.parse(
          reviewDb(
            `select json_agg(id) from public.reviews where author_id='${author.id}' and title='Quota target';`,
          ),
        ) as string[];
        const batch = await own(targets.slice(0, 10));
        expect(batch.status).toBe(200);
        expect(batch.data.votes).toHaveLength(10);
        expect(
          batch.data.votes.map((row: { reviewId: string }) => row.reviewId),
        ).toEqual(targets.slice(0, 10));
        // One existing vote plus 18 new votes leaves exactly one minute slot.
        for (const target of targets.slice(0, 18))
          expect((await vote(target, 1, moderator.token)).status).toBe(201);
        // Concurrent targets compete for that last slot.
        const minuteRace = await Promise.all(
          targets
            .slice(18, 20)
            .map((target) => vote(target, 1, moderator.token)),
        );
        expect(minuteRace.map((r) => r.status).sort()).toEqual([201, 429]);
        reviewDb(
          `alter table public.review_votes disable trigger review_vote_immutable;update public.review_votes set created_at=clock_timestamp()-interval '61 seconds' where voter_id='${moderator.id}';alter table public.review_votes enable trigger review_vote_immutable;`,
        );
        expect((await vote(targets[20], 1, moderator.token)).status).toBe(201);
        reviewDb(
          `alter table public.review_votes disable trigger review_vote_immutable;insert into public.review_votes(review_id,voter_id,value,created_at) select id,'${moderator.id}',1,(date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC') from public.reviews where author_id='${author.id}' and title='Quota target' and id not in(select review_id from public.review_votes where voter_id='${moderator.id}') limit 79;alter table public.review_votes enable trigger review_vote_immutable;`,
        );
        const free = reviewDb(
          `select id from public.reviews where author_id='${author.id}' and title='Quota target' and id not in(select review_id from public.review_votes where voter_id='${moderator.id}') limit 1;`,
        );
        expect((await vote(free, 1, moderator.token)).status).toBe(429);
        const before = (await publicCount(id)).helpful_count;
        fixtureAuditIds = JSON.parse(
          reviewDb(
            `select coalesce(json_agg(id),'[]'::json) from private.audit_logs where actor_id in (${f.accounts.map((account) => "'" + account.id + "'").join(",")});`,
          ),
        );
        expect(fixtureAuditIds.length).toBeGreaterThan(0);
        expect(fixtureAuditIds.every(Number.isSafeInteger)).toBe(true);
        reviewDb(
          `delete from private.audit_logs where actor_id='${moderator.id}';delete from auth.users where id='${moderator.id}';`,
        );
        expect((await publicCount(id)).helpful_count).toBe(before - 1);
        reviewDb(`delete from public.reviews where id='${rawg}';`);
        expect(
          reviewDb(
            `select count(*) from public.review_votes where review_id='${rawg}';`,
          ),
        ).toBe("0");
      } finally {
        try {
          f.cleanup();
        } finally {
          reviewDb(
            `delete from public.reviews where author_id in (${f.accounts.map((a) => "'" + a.id + "'").join(",")});delete from public.manual_games where id='${f.manualId.slice(7)}' and source_url='https://www.celestegame.com/?gamehive_fixture=${f.marker}';`,
          );
        }
        reviewDb(
          `delete from public.manual_games where source_url like 'https://example.com/${f.marker}/%';`,
        );
        if (fixtureAuditIds.length)
          expect(
            reviewDb(
              `select count(*) from private.audit_logs where id in (${fixtureAuditIds.join(",")});`,
            ),
          ).toBe("0");
      }
    }, 120000);
  },
);
