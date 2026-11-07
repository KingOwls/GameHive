import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { manualDeadline, readManualBody } from '../functions/_shared/manual-game-deadline.ts';
const assert=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
Deno.test('library body ceiling and cancellation use shared deadline',async()=>{
 const controller=new AbortController();const deadline=manualDeadline(controller.signal);
 try {
  let rejected=false;
  try{await readManualBody(new Request('https://edge.invalid',{method:'POST',body:JSON.stringify({gameId:'x'.repeat(4097),value:1})}),deadline,4096);}catch{rejected=true;}
  assert(rejected,'oversized library body must fail');
  controller.abort();rejected=false;
  try{await deadline.wait(Promise.resolve('late'));}catch{rejected=true;}
  assert(rejected,'canceled library deadline must fail');
 }finally{deadline.dispose();}
});
Deno.test({name:'library races serialize two sessions and current authority with no partial writes',sanitizeOps:false,sanitizeResources:false,async fn(){
 const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:4});
 const actor=crypto.randomUUID(),author=crypto.randomUUID(),session=crypto.randomUUID(),second=crypto.randomUUID(),game=crypto.randomUUID();
 const marker=crypto.randomUUID().replaceAll('-','').slice(0,12);
 let manager:Awaited<ReturnType<typeof sql.reserve>>|undefined,writer:Awaited<ReturnType<typeof sql.reserve>>|undefined;
 try{
  for(const [id,suffix] of [[actor,'v'],[author,'a']])await sql`insert into auth.users(id,email,raw_user_meta_data) values(${id}::uuid,${`${marker}${suffix}@example.invalid`},${sql.json({username:`Vote_${marker}_${suffix}`})})`;
  for(const s of [session,second])await sql`insert into auth.sessions(id,user_id) values(${s}::uuid,${actor}::uuid)`;
  await sql`insert into public.manual_games(id,title,synopsis,platforms,genres,source_url,source_label) values(${game}::uuid,'Isolated vote race','Isolated vote transaction fixture only.',array['PC'],array['Test'],${`https://example.com/vote-race/${marker}`},'Isolated fixture')`;
  const input={gameId:`manual:${game}`,state:null,favorite:false,interested:false,progress:null};
  const results=await Promise.all([session,second].map(s=>sql`select private.library_operation(${actor}::uuid,${s}::uuid,'create',${sql.json(input)}::jsonb)`.then(()=>200,(error: {code:string})=>error.code)));
  assert(results.includes(200)&&results.includes('23505'),'two-session create race has one winner and conflict');
  const [counts]=await sql`select count(*)::int as total from public.user_library where user_id=${actor}::uuid`;
  assert(counts.total===1,'two-session race stores one entry');
  await sql`delete from public.user_library where user_id=${actor}::uuid`;
  manager=await sql.reserve();writer=await sql.reserve();
  const [worker]=await writer`select pg_backend_pid() as pid`;const [blocker]=await manager`select pg_backend_pid() as pid`;
  for(const kind of ['suspension','session deletion']){
   await manager`begin`;
   if(kind==='session deletion')await manager`delete from auth.sessions where id=${session}::uuid`;
   else{
    await manager`select pg_advisory_xact_lock(718007013)`;
    await manager`update private.authz set status='suspended' where user_id=${actor}::uuid`;
   }
   let settled=false;
   const outcome=Promise.resolve(writer`select private.library_operation(${actor}::uuid,${session}::uuid,'create',${sql.json(input)}::jsonb)`.execute()).then(()=>{settled=true;return 'success';},(error: {code:string})=>{settled=true;return error.code;});
   let blocked=false;
   for(let i=0;i<100&&!settled;i++){
    const [state]=await sql`select ${blocker.pid}::int=any(pg_blocking_pids(${worker.pid}::int)) as blocked`;
    if(state.blocked){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,10));
   }
   assert(blocked,`${kind}: operation waits for authority/session`);await manager`commit`;
   assert(await outcome==='42501',`${kind}: operation denies stale eligibility`);
   const [state]=await sql`select count(*)::int as entries from public.user_library where user_id=${actor}::uuid`;
   assert(state.entries===0,`${kind}: zero partial state`);
   await sql`update private.authz set status='active' where user_id in (${actor}::uuid,${author}::uuid)`;
   if(kind==='session deletion')await sql`insert into auth.sessions(id,user_id) values(${session}::uuid,${actor}::uuid)`;
  }
 }finally{
  if(manager){try{await manager`rollback`;}finally{manager.release();}}writer?.release();
  try{await sql.begin(async(cleanup:typeof sql)=>{
   await cleanup`select pg_advisory_xact_lock(718007013)`;
   await cleanup`delete from public.user_library where user_id=${actor}::uuid`;
   await cleanup`delete from public.manual_games where id=${game}::uuid`;
   await cleanup`delete from private.audit_logs where actor_id in (${actor}::uuid,${author}::uuid)`;
   await cleanup`delete from auth.users where id in (${actor}::uuid,${author}::uuid)`;
  });}finally{await sql.end({timeout:1});}
 }
}});
