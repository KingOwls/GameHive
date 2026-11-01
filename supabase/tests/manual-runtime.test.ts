import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import {
  manualDeadline,
  manualQuery,
  readManualBody,
} from "../functions/_shared/manual-game-deadline.ts";
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function rejects(operation: PromiseLike<unknown>, message: string) {
  let failed = false;
  try {
    await operation;
  } catch {
    failed = true;
  }
  assert(failed, message);
}
Deno.test("manual body: one abort listener across chunks, cancellation and released lock", async () => {
  const controller = new AbortController();
  let adds = 0, removes = 0, cancels = 0;
  const signal = controller.signal;
  const add = signal.addEventListener.bind(signal),
    remove = signal.removeEventListener.bind(signal);
  signal.addEventListener = (
    ...args: Parameters<AbortSignal["addEventListener"]>
  ) => {
    adds++;
    add(...args);
  };
  signal.removeEventListener = (
    ...args: Parameters<AbortSignal["removeEventListener"]>
  ) => {
    removes++;
    remove(...args);
  };
  const deadline = manualDeadline(signal);
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(c) {
      if (pulls++ < 30) c.enqueue(new Uint8Array([32]));
    },
    cancel() {
      cancels++;
    },
  });
  const request = new Request("https://edge.invalid", {
    method: "POST",
    body: stream,
  });
  const result = readManualBody(request, deadline);
  await pause(10);
  controller.abort();
  await rejects(result, "stalled body must reach deadline");
  deadline.dispose();
  assert(
    adds === 1 && removes === 1,
    "body chunks must reuse one abort listener",
  );
  assert(
    cancels === 1 && !stream.locked,
    "timeout must cancel and release body reader",
  );
  const bounded = manualDeadline(new AbortController().signal);
  const tooLarge = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(20001));
    },
    cancel() {
      cancels++;
    },
  });
  await rejects(
    readManualBody(
      new Request("https://edge.invalid", { method: "POST", body: tooLarge }),
      bounded,
    ),
    "oversized body rejected",
  );
  bounded.dispose();
  assert(cancels === 2 && !tooLarge.locked, "oversized body reader released");
});
Deno.test({
  name:
    "manual deadline: shared phase budget, pool queue removed, active query canceled",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
      prepare: false,
      max: 1,
    });
    const table = `manual_deadline_${crypto.randomUUID().replaceAll("-", "")}`;
    let held: Awaited<ReturnType<typeof sql.reserve>> | undefined;
    try {
      await sql.unsafe(`create table private.${table}(marker text)`);
      held = await sql.reserve();
      const deadline = manualDeadline(AbortSignal.timeout(150));
      const started = Date.now();
      // Auth/body phases already consumed the same request budget before DB queuing.
      await deadline.wait(pause(80));
      const query = sql.unsafe(
        `insert into private.${table} values('must-not-run')`,
      );
      await rejects(
        manualQuery<Awaited<typeof query>>(query, deadline),
        "queued query rejected by total deadline",
      );
      assert(
        Date.now() - started < 1000,
        "pool wait must be bounded by request deadline",
      );
      deadline.dispose();
      held.release();
      held = undefined;
      const [row] = await sql.unsafe(
        `select count(*)::int as count from private.${table}`,
      );
      assert(
        row.count === 0,
        "canceled queued write must not execute when pool is released",
      );
      const activeDeadline = manualDeadline(AbortSignal.timeout(120));
      const active = sql`select pg_sleep(5)`;
      const activeStarted = Date.now();
      await rejects(
        manualQuery<Awaited<typeof active>>(active, activeDeadline),
        "active query deadline",
      );
      activeDeadline.dispose();
      await sql`select 1`;
      assert(
        Date.now() - activeStarted < 1500,
        "active cancellation must release connection before pg_sleep finishes",
      );
    } finally {
      held?.release();
      await sql.unsafe(`drop table if exists private.${table}`);
      await sql.end({ timeout: 1 });
    }
  },
});
Deno.test({
  name:
    "manual authorization races: demotion, suspension and session deletion win without partial writes",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
      prepare: false,
      max: 3,
    });
    const actor = crypto.randomUUID(), session = crypto.randomUUID();
    const marker = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let manager: Awaited<ReturnType<typeof sql.reserve>> | undefined,
      writer: Awaited<ReturnType<typeof sql.reserve>> | undefined;
    try {
      await sql`insert into auth.users(id,email,raw_user_meta_data) values(${actor}::uuid,${`race-${marker}@example.invalid`},${
        sql.json({ username: `Race_${marker}` })
      })`;
      await sql`insert into auth.sessions(id,user_id) values(${session}::uuid,${actor}::uuid)`;
      await sql`update private.authz set role='admin' where user_id=${actor}::uuid`;
      manager = await sql.reserve();
      writer = await sql.reserve();
      const [worker] = await writer`select pg_backend_pid() as pid`;
      const [blocker] = await manager`select pg_backend_pid() as pid`;
      for (const kind of ["demotion", "suspension", "session deletion"]) {
        await manager`begin`;
        if (
          kind === "session deletion"
        ) {
          await manager`delete from auth.sessions where id=${session}::uuid`;
        } else {
          await manager`select pg_advisory_xact_lock(718007013)`;
          if (
            kind === "demotion"
          ) {
            await manager`update private.authz set role='user' where user_id=${actor}::uuid`;
          } else {
            await manager`update private.authz set status='suspended' where user_id=${actor}::uuid`;
          }
        }
        const payload = {
          title: "Isolated authorization race fixture",
          synopsis: "Isolated adversarial fixture for local transaction races.",
          platforms: ["PC"],
          genres: ["Test"],
          releasedAt: null,
          sourceUrl: `https://example.com/isolated-manual-race/${marker}/${
            encodeURIComponent(kind)
          }`,
          sourceLabel: "Isolated fixture",
          reason: "Isolated concurrency acceptance test",
        };
        let settled = false;
        const pending =
          writer`select private.create_manual_game(${actor}::uuid,${session}::uuid,${
            sql.json(payload)
          })`.execute();
        const outcome = Promise.resolve(pending).then(() => {
          settled = true;
          return "success";
        }, (e) => {
          settled = true;
          return String(e.code);
        });
        let blocked = false;
        for (let i = 0; i < 100 && !settled; i++) {
          const [state] =
            await sql`select ${blocker.pid}::int=any(pg_blocking_pids(${worker.pid}::int)) as blocked`;
          if (state.blocked) {
            blocked = true;
            break;
          }
          await pause(10);
        }
        assert(
          blocked,
          `${kind}: writer must wait for authority/session transaction`,
        );
        await manager`commit`;
        assert(
          await outcome === "42501",
          `${kind}: create rejected after authority/session change`,
        );
        const [counts] =
          await sql`select (select count(*)::int from private.audit_logs where actor_id=${actor}::uuid) as audits,(select count(*)::int from public.manual_games where source_url=${payload.sourceUrl}) as games`;
        assert(
          counts.audits === 0 && counts.games === 0,
          `${kind}: no game or audit committed`,
        );
        await sql`update private.authz set role='admin',status='active' where user_id=${actor}::uuid`;
        if (
          kind === "session deletion"
        ) {
          await sql`insert into auth.sessions(id,user_id) values(${session}::uuid,${actor}::uuid)`;
        }
      }
    } finally {
      try {
        if (manager) {
          try {
            await manager`rollback`;
          } finally {
            manager.release();
          }
        }
        writer?.release();
        await sql.begin(async (cleanup: typeof sql) => {
          // Wait for an in-flight create before reading its audit. If cleanup
          // wins the lock first, deleting the fixture identity prevents a late create.
          await cleanup`select pg_advisory_xact_lock(718007013)`;
          await cleanup`delete from public.manual_games g where exists(select 1 from private.audit_logs a where a.actor_id=${actor}::uuid and a.action='manual_game.create' and a.after_data->>'gameId'='manual:'||g.id::text)`;
          await cleanup`delete from private.audit_logs where actor_id=${actor}::uuid`;
          await cleanup`delete from auth.users where id=${actor}::uuid`;
        });
      } finally {
        await sql.end({ timeout: 1 });
      }
    }
  },
});
