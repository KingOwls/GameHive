// Explicitly isolated persisted pagination fixtures; never provider certification.
// Only exact generated IDs and the caller's isolated actor are cleaned.
import { randomUUID } from "node:crypto";
import { reviewDb } from "./reviews-local";
export function libraryPaginationFixtures(actor: string, marker: string) {
  if (!/^[0-9a-f-]{36}$/i.test(actor) || !/^r[a-z0-9]{10}$/.test(marker))
    throw Error("Invalid isolated pagination fixture identity.");
  const games = Array.from({ length: 24 }, (_, index) => ({
    id: randomUUID(),
    title: `Isolated library pagination ${String(index + 1).padStart(2, "0")} ${marker}`,
    index,
  }));
  const reviews = games
    .slice(0, 11)
    .map((g) => ({
      id: randomUUID(),
      gameId: g.id,
      title: `Isolated profile review ${String(g.index + 1).padStart(2, "0")} ${marker}`,
      body: `Public isolated profile pagination opinion ${String(g.index + 1).padStart(2, "0")} for ${marker}.`,
    }));
  const gameIds = games.map((g) => `'${g.id}'`).join(",");
  const reviewIds = reviews.map((r) => `'${r.id}'`).join(",");
  const cleanup = () => {
    reviewDb(
      `begin;select pg_advisory_xact_lock(718007013);delete from public.reviews where id in (${reviewIds}) and author_id='${actor}';delete from public.user_library where user_id='${actor}' and manual_game_id in (${gameIds});delete from public.manual_games where id in (${gameIds}) and source_url like 'https://example.com/isolated-library-pagination/${marker}/%';commit;`,
    );
    if (
      reviewDb(
        `select (select count(*) from public.reviews where id in (${reviewIds}))+(select count(*) from public.manual_games where id in (${gameIds}));`,
      ) !== "0"
    )
      throw Error("Isolated pagination fixture cleanup incomplete.");
  };
  try {
    reviewDb(
      `begin;${games.map((g) => `insert into public.manual_games(id,title,synopsis,platforms,genres,source_url,source_label) values('${g.id}','${g.title}','Explicitly isolated persisted pagination fixture only.',array['PC'],array['Test'],'https://example.com/isolated-library-pagination/${marker}/${g.index}','Isolated pagination fixture');insert into public.user_library(user_id,manual_game_id,state,favorite,interested,progress,created_at) values('${actor}','${g.id}','${g.index < 21 ? "playing" : "backlog"}',${g.index < 21},${g.index % 2 === 0},${g.index},timestamptz '2026-01-01T00:00:00Z'+interval '${24 - g.index} seconds');`).join("")}${reviews.map((r, index) => `insert into public.reviews(id,author_id,manual_game_id,rating,title,body_public,author_active,created_at) values('${r.id}','${actor}','${r.gameId}',7,'${r.title}','${r.body}',true,timestamptz '2026-01-01T00:00:00Z'+interval '${11 - index} seconds');`).join("")}commit;`,
    );
    return { games, reviews, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
