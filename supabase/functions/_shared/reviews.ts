import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import {manualDeadline, manualQuery, readManualBody} from './manual-game-deadline.ts';
import {reviewGameId, validateReviewRequest} from './review-validation.ts';
const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:3,connection:{statement_timeout:8000}});
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
export async function reviewsHandler(request: Request): Promise<Response> {
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(request.method==='OPTIONS') return new Response(null,{headers});
 if(!['GET','POST'].includes(request.method)) return reply(405,{error:'Método no permitido.'});
 const timeout=AbortSignal.any([AbortSignal.timeout(10000),request.signal]);
 const deadline=manualDeadline(timeout);
 try {
 const bearer=request.headers.get('Authorization')??'';
 if(!bearer.startsWith('Bearer ')) return reply(401,{error:'Inicia sesión de nuevo.'});
 const token=bearer.slice(7);
 const auth=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:timeout})}});
 const {data,error}=await deadline.wait(auth.auth.getUser(token));
 if(error || !data.user) return reply(401,{error:'Inicia sesión de nuevo.'});
 let session: string;
 try {
 const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
 session=claims.session_id;
 if(typeof session!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session)) throw new Error('Invalid session');
 } catch {return reply(401,{error:'Inicia sesión de nuevo.'});}
 let action: string; let gameId: string; let version: number|null=null; let input: Record<string,unknown>|null=null;
 try {
 if(request.method==='GET') {
 const game=new URL(request.url).searchParams.get('gameId');
 if(!reviewGameId(game)) throw new Error('Invalid game');
 gameId=game; action='own';
 } else {
 const body=validateReviewRequest(await readManualBody(request,deadline,160000));
 gameId=String(body.gameId); action=String(body.action); version=body.version===undefined?null:Number(body.version); input=(body.input as Record<string,unknown>)??null;
 }
 } catch(error) {if(timeout.aborted) throw error; return reply(400,{error:'Revisa el juego, la versión y los campos de tu reseña.'});}
 const query=sql`select private.review_operation(${data.user.id}::uuid,${session}::uuid,${action},${gameId},${version}::integer,${input===null?null:sql.json(input)}) as review`;
 const [row]=await manualQuery<Awaited<typeof query>>(query,deadline);
 return reply(action==='create'?201:200,row.review);
 } catch(error) {
 const code=error && typeof error==='object' && 'code' in error?String(error.code):'';
 if(code==='42501') return reply(403,{error:'No tienes permiso o tu sesión ya no está vigente.'});
 if(['23505','40001'].includes(code)) return reply(409,{error:'Tu reseña ya existe o cambió. Conserva el borrador y carga la versión guardada.'});
 if(code==='P0002') return reply(404,{error:'No existe una reseña propia para este juego.'});
 if(['22023','22P02','23514','23502','23503'].includes(code)) return reply(400,{error:'Revisa el juego, la versión y los campos de tu reseña.'});
 return reply(503,{error:'No pudimos confirmar el cambio. Comprueba tu reseña guardada antes de reintentar.'});
 } finally {deadline.dispose();}
}
