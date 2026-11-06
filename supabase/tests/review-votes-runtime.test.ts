import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { manualDeadline, readManualBody } from '../functions/_shared/manual-game-deadline.ts';
const assert=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
Deno.test('vote body ceiling and cancellation use shared deadline',async()=>{
 const controller=new AbortController();const deadline=manualDeadline(controller.signal);
 try {
  let rejected=false;
  try{await readManualBody(new Request('https://edge.invalid',{method:'POST',body:JSON.stringify({reviewId:'x'.repeat(1025),value:1})}),deadline,1024);}catch{rejected=true;}
  assert(rejected,'oversized vote body must fail');
  controller.abort();rejected=false;
  try{await deadline.wait(Promise.resolve('late'));}catch{rejected=true;}
  assert(rejected,'canceled vote deadline must fail');
 }finally{deadline.dispose();}
});
Deno.test({name:'vote races serialize two sessions and current authority with no partial writes',sanitizeOps:false,sanitizeResources:false,async fn(){
 const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:4});
 const actor=crypto.randomUUID(),author=crypto.randomUUID(),session=crypto.randomUUID(),second=crypto.randomUUID(),game=crypto.randomUUID(),review=crypto.randomUUID();
 const marker=crypto.randomUUID().replaceAll('-','').slice(0,12);
 let manager:Awaited<ReturnType<typeof sql.reserve>>|undefined,writer:Awaited<ReturnType<typeof sql.reserve>>|undefined;
 try{
  for(const [id,suffix] of [[actor,'v'],[author,'a']])await sql`insert into auth.users(id,email,raw_user_meta_data) values(${id}::uuid,${`${marker}${suffix}@example.invalid`},${sql.json({username:`Vote_${marker}_${suffix}`})})`;
  for(const s of [session,second])await sql`insert into auth.sessions(id,user_id) values(${s}::uuid,${actor}::uuid)`;
  await sql`insert into public.manual_games(id,title,synopsis,platforms,genres,source_url,source_label) values(${game}::uuid,'Isolated vote race','Isolated vote transaction fixture only.',array['PC'],array['Test'],${`https://example.com/vote-race/${marker}`},'Isolated fixture')`;
  await sql`insert into public.reviews(id,author_id,manual_game_id,rating,title,body_public,author_active) values(${review}::uuid,${author}::uuid,${game}::uuid,7,'Isolated vote race','Isolated public opinion sufficiently long.',true)`;
  const results=await Promise.all([session,second].map((s,i)=>sql`select private.review_vote_operation(${actor}::uuid,${s}::uuid,'vote',string_to_array(${review},',')::uuid[],${i===0?1:-1})`.then(()=>201,(error: {code:string})=>error.code)));
  assert(results.includes(201)&&results.includes('23505'),'two-session race has one winner and conflict');
  const [counts]=await sql`select count(*)::int as total from public.review_votes where review_id=${review}::uuid`;
  assert(counts.total===1,'two-session race stores one sign');
  await sql`delete from public.review_votes where review_id=${review}::uuid`;
  await sql`delete from private.audit_logs where actor_id=${actor}::uuid`;
  manager=await sql.reserve();writer=await sql.reserve();
  const [worker]=await writer`select pg_backend_pid() as pid`;const [blocker]=await manager`select pg_backend_pid() as pid`;
  for(const kind of ['voter suspension','author suspension','session deletion']){
   await manager`begin`;
   if(kind==='session deletion')await manager`delete from auth.sessions where id=${session}::uuid`;
   else{
    await manager`select pg_advisory_xact_lock(718007013)`;
    await manager`update private.authz set status='suspended' where user_id=${kind==='voter suspension'?actor:author}::uuid`;
   }
   let settled=false;
   const outcome=Promise.resolve(writer`select private.review_vote_operation(${actor}::uuid,${session}::uuid,'vote',string_to_array(${review},',')::uuid[],1)`.execute()).then(()=>{settled=true;return 'success';},(error: {code:string})=>{settled=true;return error.code;});
   let blocked=false;
   for(let i=0;i<100&&!settled;i++){
    const [state]=await sql`select ${blocker.pid}::int=any(pg_blocking_pids(${worker.pid}::int)) as blocked`;
    if(state.blocked){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,10));
   }
   assert(blocked,`${kind}: operation waits for authority/session`);await manager`commit`;
   assert(await outcome==='42501',`${kind}: operation denies stale eligibility`);
   const [state]=await sql`select helpful_count,unhelpful_count,(select count(*)::int from public.review_votes where review_id=${review}::uuid) as votes,(select count(*)::int from private.audit_logs where actor_id=${actor}::uuid) as audits from public.reviews where id=${review}::uuid`;
   assert(state.votes===0&&state.audits===0&&state.helpful_count===0&&state.unhelpful_count===0,`${kind}: zero partial state`);
   await sql`update private.authz set status='active' where user_id in (${actor}::uuid,${author}::uuid)`;
   if(kind==='session deletion')await sql`insert into auth.sessions(id,user_id) values(${session}::uuid,${actor}::uuid)`;
  }
 }finally{
  if(manager){try{await manager`rollback`;}finally{manager.release();}}writer?.release();
  try{await sql.begin(async(cleanup:typeof sql)=>{
   await cleanup`select pg_advisory_xact_lock(718007013)`;
   await cleanup`delete from public.reviews where id=${review}::uuid`;
   await cleanup`delete from public.manual_games where id=${game}::uuid`;
   await cleanup`delete from private.audit_logs where actor_id in (${actor}::uuid,${author}::uuid)`;
   await cleanup`delete from auth.users where id in (${actor}::uuid,${author}::uuid)`;
  });}finally{await sql.end({timeout:1});}
 }
}});
