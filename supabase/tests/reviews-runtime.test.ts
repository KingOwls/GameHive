import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import {manualDeadline,readManualBody} from '../functions/_shared/manual-game-deadline.ts';
const assert=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
Deno.test('review body permits full Unicode limits while manual default remains20KB',async()=>{
 const text=JSON.stringify({bodySpoiler:'😀'.repeat(20000),bodyPublic:'😀'.repeat(10000)});
 const deadline=manualDeadline(new AbortController().signal);
 try {
 const body=await readManualBody(new Request('https://edge.invalid',{method:'POST',body:text}),deadline,160000);
 assert([...body.bodySpoiler].length===20000,'review Unicode body must fit');
 let rejected=false;try{await readManualBody(new Request('https://edge.invalid',{method:'POST',body:text}),deadline);}catch{rejected=true;}
 assert(rejected,'manual20KB default must remain protected');
 }finally{deadline.dispose();}
});
Deno.test({
  name:
    "review authorization races: demotion, suspension and session deletion win without partial writes",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
      prepare: false,
      max: 3,
    });
    const actor = crypto.randomUUID(), session = crypto.randomUUID(), game = crypto.randomUUID();
    const marker = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let manager: Awaited<ReturnType<typeof sql.reserve>> | undefined,
      writer: Awaited<ReturnType<typeof sql.reserve>> | undefined;
    try {
      await sql`insert into auth.users(id,email,raw_user_meta_data) values(${actor}::uuid,${`race-${marker}@example.invalid`},${
        sql.json({ username: `Race_${marker}` })
      })`;
      await sql`insert into auth.sessions(id,user_id) values(${session}::uuid,${actor}::uuid)`;
      await sql`insert into public.manual_games(id,title,synopsis,platforms,genres,source_url,source_label) values(${game}::uuid,'Isolated review race fixture','Isolated review transaction fixture only.',array['PC'],array['Test'],${`https://example.com/isolated-review-race/${marker}`},'Isolated fixture')`;
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
            await manager`update private.authz set role='moderator' where user_id=${actor}::uuid`;
          } else {
            await manager`update private.authz set status='suspended' where user_id=${actor}::uuid`;
          }
        }
        const payload={rating:7,title:'Isolated review race',bodyPublic:'Isolated review fixture with sufficient public text.',bodySpoiler:'',pros:[],cons:[]};
        let settled = false;
        const pending =
          writer`select private.review_operation(${actor}::uuid,${session}::uuid,'create',${`manual:${game}`},null,${
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
          await sql`select (select count(*)::int from private.audit_logs where actor_id=${actor}::uuid) as audits,(select count(*)::int from public.reviews where author_id=${actor}::uuid) as games`;
        assert(
          counts.audits === 0 && counts.games === 0,
          `${kind}: no game or audit committed`,
        );
        await sql`update private.authz set role='user',status='active' where user_id=${actor}::uuid`;
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
          await cleanup`delete from public.reviews where author_id=${actor}::uuid`;
          await cleanup`delete from public.manual_games where id=${game}::uuid`;
          await cleanup`delete from private.audit_logs where actor_id=${actor}::uuid`;
          await cleanup`delete from auth.users where id=${actor}::uuid`;
        });
      } finally {
        await sql.end({ timeout: 1 });
      }
    }
  },
});
