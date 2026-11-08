import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';
import { manualDeadline,readManualBody } from '../functions/_shared/manual-game-deadline.ts';
const assert=(v:unknown,m:string)=>{if(!v)throw new Error(m);};
Deno.test('applications 64KiB ceiling and cancellation',async()=>{
 const c=new AbortController(),d=manualDeadline(c.signal);
 try {let failed=false;try{await readManualBody(new Request('https://edge.invalid',{method:'POST',body:' '.repeat(65537)}),d,65536);}catch{failed=true;}assert(failed,'oversized body rejected');c.abort();failed=false;try{await d.wait(Promise.resolve(1));}catch{failed=true;}assert(failed,'timeout must reject aborted request');}finally{d.dispose();}
});
Deno.test({name:'applications atomic races and current admin/target/session checks',sanitizeOps:false,sanitizeResources:false,async fn(){
 const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:5});
 const actor=crypto.randomUUID(),admin=crypto.randomUUID(),session=crypto.randomUUID(),adminSession=crypto.randomUUID();
 const marker=crypto.randomUUID().replaceAll('-','').slice(0,10);
 const input={organization:'Independiente',experience:'Experiencia editorial '.repeat(4),sample:'Muestra textual propia '.repeat(4),links:[]};
 let manager:Awaited<ReturnType<typeof sql.reserve>>|undefined,writer:Awaited<ReturnType<typeof sql.reserve>>|undefined;
 const op=(who:string,s:string,operation:string,data:unknown)=>sql`select private.critic_application_operation(${who}::uuid,${s}::uuid,${operation},${sql.json(data as never)}::jsonb) as result`;
 try {
  for(const [id,suffix] of [[actor,'u'],[admin,'a']])await sql`insert into auth.users(id,email,raw_user_meta_data) values(${id}::uuid,${`application_${marker}_${suffix}@example.invalid`},${sql.json({username:`App_${marker}_${suffix}`})})`;
  await sql`update private.authz set role='admin' where user_id=${admin}::uuid`;
  await sql`insert into auth.sessions(id,user_id) values(${session}::uuid,${actor}::uuid),(${adminSession}::uuid,${admin}::uuid)`;
  const submissions=await Promise.all([op(actor,session,'submit',input),op(actor,session,'submit',input)].map(p=>p.then(()=>200,(e:{code:string})=>e.code)));
  assert(submissions.includes(200)&&submissions.includes('23505'),'one concurrent submission wins');
  const [a]=await sql`select id from private.critic_applications where user_id=${actor}::uuid and status='pending'`;
  const decision={id:a.id,version:1,decision:'approved',reason:'Admisión humana tras evaluación'};
  const resolutions=await Promise.all([op(admin,adminSession,'resolve',decision),op(admin,adminSession,'resolve',decision)].map(p=>p.then(()=>200,(e:{code:string})=>e.code)));
  assert(resolutions.includes(200)&&resolutions.includes('23505'),'one concurrent resolution wins');
  const [state]=await sql`select (select count(*) from private.application_notices where application_id=${a.id}::uuid)::int as notices,(select count(*) from private.audit_logs where target_id=${actor}::uuid and action='critic_application.approved')::int as audits`;
  assert(state.notices===1&&state.audits===1,'single notice and audit');
  await sql`update private.authz set role='user',critic_verified=false where user_id=${actor}::uuid`;
  const [created]=await op(actor,session,'submit',input);decision.id=created.result.id;
  manager=await sql.reserve();writer=await sql.reserve();const [worker]=await writer`select pg_backend_pid() as pid`;const [blocker]=await manager`select pg_backend_pid() as pid`;
  for(const kind of ['demotion','suspension','session deletion','target seal']) {
   await manager`begin`;
   if(kind==='session deletion')await manager`delete from auth.sessions where id=${adminSession}::uuid`;
   else{await manager`select pg_advisory_xact_lock(718007013)`;
    if(kind==='demotion')await manager`update private.authz set role='user' where user_id=${admin}::uuid`;
    if(kind==='suspension')await manager`update private.authz set status='suspended' where user_id=${actor}::uuid`;
    if(kind==='target seal')await manager`update private.authz set critic_verified=true where user_id=${actor}::uuid`;
   }
   let settled=false;
   const outcome=Promise.resolve(writer`select private.critic_application_operation(${admin}::uuid,${adminSession}::uuid,'resolve',${sql.json(decision)}::jsonb)`.execute()).then(()=>{settled=true;return 'success';},(e:{code:string})=>{settled=true;return e.code;});
   let blocked=false;for(let i=0;i<100&&!settled;i++){const [state]=await sql`select ${blocker.pid}::int=any(pg_blocking_pids(${worker.pid}::int)) as blocked`;if(state.blocked){blocked=true;break;}await new Promise(r=>setTimeout(r,10));}
   assert(blocked,`${kind}: operation waits for lock`);await manager`commit`;
   assert(await outcome===(['demotion','session deletion'].includes(kind)?'42501':'23505'),`${kind}: stale authority denied`);
   const [pending]=await sql`select status from private.critic_applications where id=${decision.id}::uuid`;assert(pending.status==='pending',`${kind}: zero partial resolution`);
   await sql`update private.authz set status='active',critic_verified=false,role=case when user_id=${admin}::uuid then 'admin'::private.account_role else 'user'::private.account_role end where user_id in (${actor}::uuid,${admin}::uuid)`;
   if(kind==='session deletion')await sql`insert into auth.sessions(id,user_id) values(${adminSession}::uuid,${admin}::uuid)`;
  }
 } finally {
  if(manager){try{await manager`rollback`;}finally{manager.release();}}writer?.release();
  try{await sql.begin(async(c:typeof sql)=>{await c`select pg_advisory_xact_lock(718007013)`;await c`delete from private.audit_logs where actor_id in (${actor}::uuid,${admin}::uuid)`;await c`delete from auth.users where id in (${actor}::uuid,${admin}::uuid)`;});}finally{await sql.end({timeout:1});}
 }
}});
