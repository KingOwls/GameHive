// @vitest-environment node
import { describe, it, expect } from "vitest";
import { libraryPaginationFixtures } from "../helpers/library-pagination";
import { createClient } from "@supabase/supabase-js";
import {
  reviewApi,
  reviewDb,
  reviewFixtures,
  reviewsOrigin,
} from "../helpers/reviews-local";
describe.skipIf(process.env.GH_RUN_LIBRARY !== "1")(
  "GH027–028 real local Auth/Edge/DB",
  () => {
    it("four roles, exact marks, two sessions, CAS/ABA, privacy and adversarial requests", async () => {
      const f = await reviewFixtures();
      const [owner, other, critic, mod, admin] = f.accounts;
      const op = (operation: string, input: unknown, token = owner.token) =>
        reviewApi("/functions/v1/library", token, "POST", { operation, input });
      const marks = {
        state: null,
        favorite: false,
        interested: false,
        progress: null,
      };
      const gameId = f.manualId;
      const rows = (token?: string) =>
        reviewApi(
          `/rest/v1/user_library?user_id=eq.${owner.id}&select=*,games(document),manual_games(*)`,
          token,
        );
      try {
        expect(
          (
            await reviewApi("/functions/v1/library", undefined, "POST", {
              operation: "settings",
              input: {},
            })
          ).status,
        ).toBe(401);
        expect(
          (await op("create", { gameId, ...marks, user_id: other.id })).status,
        ).toBe(400);
        expect(
          (await op("create", { gameId: "curated:test", ...marks })).status,
        ).toBe(400);
        expect(
          (await op("create", { gameId: "rawg:99999999999999", ...marks }))
            .status,
        ).toBe(400);
        const result = await op("create", { gameId, ...marks });
        expect(result.status).toBe(200);
        const initial = result.data.entry;
        expect(result.data.visibility).toBe("private");
        expect(initial).toMatchObject(marks);
        const client = createClient(
          reviewsOrigin,
          process.env.GH_LOCAL_API_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const second = await client.auth.signInWithPassword({
          email: owner.email,
          password: owner.password,
        });
        expect(second.error).toBeNull();
        const token = second.data.session!.access_token;
        expect((await op("own", { gameId }, token)).data.entry.id).toBe(
          initial.id,
        );
        for (const who of [
          undefined,
          other.token,
          critic.token,
          mod.token,
          admin.token,
        ])
          expect((await rows(who)).data).toEqual([]);
        for (const who of [critic, mod, admin])
          expect(
            (await op("create", { gameId, ...marks }, who.token)).status,
          ).toBe(200);
        for (const field of ["id", "version"])
          for (const action of ["update", "remove"]) {
            const input = {
              gameId,
              ...(action === "update" ? marks : {}),
              id: initial.id,
              version: initial.version,
              [field]: null,
            };
            expect((await op(action, input)).status).toBe(400);
          }
        const padded =
          JSON.stringify({
            operation: "update",
            input: {
              gameId,
              id: initial.id,
              version: initial.version,
              ...marks,
              progress: 99,
            },
          }) + " ".repeat(4097);
        expect(new TextEncoder().encode(padded).byteLength).toBeGreaterThan(
          4096,
        );
        const oversized = await fetch(`${reviewsOrigin}/functions/v1/library`, {
          method: "POST",
          headers: {
            apikey: process.env.GH_LOCAL_API_KEY!,
            Authorization: `Bearer ${owner.token}`,
            "Content-Type": "application/json",
          },
          body: padded,
          signal: AbortSignal.timeout(15000),
        });
        expect(oversized.status).toBe(400);
        expect((await op("own", { gameId })).data.entry).toEqual(initial);
        for (const patch of [
          { progress: 101 },
          { progress: 1.5 },
          { favorite: "true" },
          { state: "unknown" },
        ])
          expect(
            (
              await op("update", {
                gameId,
                id: initial.id,
                version: 1,
                ...marks,
                ...patch,
              })
            ).status,
          ).toBe(400);
        const race = await Promise.all(
          [owner.token, token].map((t, i) =>
            op(
              "update",
              {
                gameId,
                id: initial.id,
                version: 1,
                ...marks,
                favorite: i === 0,
                interested: i === 1,
                progress: 37,
                state: "playing",
              },
              t,
            ),
          ),
        );
        expect(race.map((r) => r.status).sort()).toEqual([200, 409]);
        let current = (await op("own", { gameId }, token)).data.entry;
        expect(current.version).toBe(2);
        expect(current.progress).toBe(37);
        const stableMarks = {
          state: current.state,
          favorite: current.favorite,
          progress: current.progress,
        };
        for (const interested of [true, false]) {
          const changed = await op("update", {
            gameId,
            id: current.id,
            version: current.version,
            ...stableMarks,
            interested,
          });
          expect(changed.status).toBe(200);
          current = (await op("own", { gameId }, token)).data.entry;
          expect(current).toMatchObject({ ...stableMarks, interested });
        }
        expect(
          (
            await op("remove", {
              gameId,
              id: current.id,
              version: current.version,
            })
          ).status,
        ).toBe(200);
        const recreated = (await op("create", { gameId, ...marks })).data.entry;
        expect(recreated.id).not.toBe(initial.id);
        expect(
          (await op("update", { gameId, id: initial.id, version: 1, ...marks }))
            .status,
        ).toBe(409);
        expect(
          (await op("create", { gameId: f.rawgId, ...marks, favorite: true }))
            .status,
        ).toBe(200);
        expect(
          (await op("privacy", { visibility: "public", version: 1 })).status,
        ).toBe(200);
        expect((await rows()).data).toHaveLength(2);
        expect(
          (await op("privacy", { visibility: "private", version: 1 })).status,
        ).toBe(409);
        expect(
          (
            await reviewApi(
              `/rest/v1/private_user_settings?user_id=eq.${owner.id}`,
              owner.token,
              "PATCH",
              { library_visibility: "private" },
            )
          ).status,
        ).toBe(403);
        expect(
          (
            await reviewApi(
              `/rest/v1/private_user_settings?user_id=eq.${owner.id}`,
              owner.token,
              "PATCH",
              { interests: "old form excludes visibility" },
            )
          ).status,
        ).toBe(200);
        expect((await op("settings", {})).data.visibility).toBe("public");
        expect(
          (await op("privacy", { visibility: "private", version: 2 }, token))
            .status,
        ).toBe(200);
        expect((await rows()).data).toEqual([]);
        for (const who of [owner, other, critic, mod, admin])
          for (const method of ["POST", "PATCH", "DELETE"])
            expect(
              (
                await reviewApi(
                  `/rest/v1/user_library?user_id=eq.${who.id}`,
                  who.token,
                  method,
                  method === "DELETE"
                    ? undefined
                    : { user_id: who.id, favorite: true },
                )
              ).status,
            ).toBe(403);
        expect(
          (
            await reviewApi(
              `/rest/v1/persisted_library_games?select=*&id=eq.${f.manualId}&limit=20`,
            )
          ).data.some((g: { id: string }) => g.id === f.manualId),
        ).toBe(true);
        const handle = owner.username.toUpperCase();
        const exact = await reviewApi(
          `/rest/v1/profiles?select=id&username_normalized=eq.${handle.toLowerCase()}`,
        );
        expect(exact.data).toEqual([{ id: owner.id }]);
        expect(
          (await op("privacy", { visibility: "public", version: 3 })).status,
        ).toBe(200);
        reviewDb(
          `begin;select pg_advisory_xact_lock(718007013);update private.authz set status='suspended' where user_id='${owner.id}';commit;`,
        );
        expect((await rows()).data).toEqual([]);
        expect((await rows(owner.token)).data).toEqual([]);
        expect((await op("own", { gameId })).status).toBe(403);
        reviewDb(
          `update private.authz set status='active' where user_id='${owner.id}';delete from auth.sessions where id='${owner.session}';`,
        );
        expect([401, 403]).toContain((await op("own", { gameId })).status);
        expect((await op("own", { gameId }, token)).status).toBe(200);
      } finally {
        f.cleanup();
      }
    }, 180000);

    it("isolated persisted fixtures enforce real page boundaries, filters, joins and exact totals", async () => {
      const f = await reviewFixtures(["user", "admin"]);
      const owner = f.accounts[0];
      let fixture: ReturnType<typeof libraryPaginationFixtures> | undefined;
      try {
        fixture = libraryPaginationFixtures(owner.id, f.marker);
        const read = async (
          page: number,
          filtered = false,
          interested = false,
        ) => {
          const params = new URLSearchParams({
            select:
              "id,manual_game_id,state,favorite,interested,progress,manual_games(title)",
            user_id: `eq.${owner.id}`,
            order: "created_at.desc,id.asc",
            limit: "20",
            offset: String((page - 1) * 20),
          });
          if (filtered) {
            params.set("favorite", "eq.true");
            params.set("state", "eq.playing");
          }
          if (interested) params.set("interested", "eq.true");
          const response = await fetch(
            `${reviewsOrigin}/rest/v1/user_library?${params}`,
            {
              headers: {
                apikey: process.env.GH_LOCAL_API_KEY!,
                Authorization: `Bearer ${owner.token}`,
                Prefer: "count=exact",
              },
              signal: AbortSignal.timeout(15000),
            },
          );
          expect([200, 206]).toContain(response.status);
          return {
            items: (await response.json()) as {
              id: string;
              manual_game_id: string;
              state: string;
              favorite: boolean;
              interested: boolean;
              progress: number;
              manual_games: { title: string };
            }[],
            total: Number(response.headers.get("content-range")?.split("/")[1]),
          };
        };
        const first = await read(1),
          second = await read(2);
        expect(first.total).toBe(24);
        expect(second.total).toBe(24);
        expect(first.items).toHaveLength(20);
        expect(second.items).toHaveLength(4);
        const all = [...first.items, ...second.items];
        expect(new Set(all.map((r) => r.id)).size).toBe(24);
        expect(all.map((r) => r.manual_game_id)).toEqual(
          fixture.games.map((g) => g.id),
        );
        expect(all.map((r) => r.manual_games.title)).toEqual(
          fixture.games.map((g) => g.title),
        );
        const filteredFirst = await read(1, true),
          filteredSecond = await read(2, true);
        expect(filteredFirst.total).toBe(21);
        expect(filteredSecond.total).toBe(21);
        expect(filteredFirst.items).toHaveLength(20);
        expect(filteredSecond.items).toHaveLength(1);
        expect(
          new Set(
            [...filteredFirst.items, ...filteredSecond.items].map((r) => r.id),
          ).size,
        ).toBe(21);
        expect(
          [...filteredFirst.items, ...filteredSecond.items].every(
            (r) => r.favorite && r.state === "playing",
          ),
        ).toBe(true);
        const interests = await read(1, true, true);
        expect(interests.total).toBe(11);
        expect(interests.items.every((r) => r.interested)).toBe(true);
      } finally {
        try {
          fixture?.cleanup();
        } finally {
          f.cleanup();
        }
      }
    }, 180000);
  },
);
