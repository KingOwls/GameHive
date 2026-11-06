import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { manualDeadline, manualQuery, readManualBody } from './manual-game-deadline.ts';
const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 3, connection: { statement_timeout: 8000 } });
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function reviewVotesHandler(request: Request): Promise<Response> {
 const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
 if (request.method === 'OPTIONS') return new Response(null, { headers });
 if (!['GET','POST'].includes(request.method)) return reply(405, { error: 'Método no permitido.' });
 const timeout = AbortSignal.any([AbortSignal.timeout(10000), request.signal]);
 const deadline = manualDeadline(timeout);
 try {
  const bearer = request.headers.get('Authorization') ?? '';
  if (!bearer.startsWith('Bearer ')) return reply(401, { error: 'Inicia sesión de nuevo.' });
  const token = bearer.slice(7);
  const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: timeout }) } });
  const { data, error } = await deadline.wait(auth.auth.getUser(token));
  if (error || !data.user) return reply(401, { error: 'Inicia sesión de nuevo.' });
  let session: string;
  try {
   session = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id;
   if (!uuid(session)) throw Error();
  } catch { return reply(401, { error: 'Inicia sesión de nuevo.' }); }
  let ids: string[]; let value: number | null = null;
  try {
   if (request.method === 'GET') {
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some(k => k !== 'reviewIds') || params.getAll('reviewIds').length !== 1) throw Error();
    ids = (params.get('reviewIds') ?? '').split(',');
   } else {
    const body = await readManualBody(request, deadline, 1024) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'reviewId,value' || ![1,-1].includes(body.value as number)) throw Error();
    ids = [body.reviewId as string]; value = body.value as number;
   }
   if (ids.length < 1 || ids.length > 10 || ids.some(id => !uuid(id)) || new Set(ids.map(id => id.toLowerCase())).size !== ids.length) throw Error();
  } catch(error) { if (timeout.aborted) throw error; return reply(400, { error: 'Revisa la reseña y el valor del voto.' }); }
  const query = sql`select private.review_vote_operation(${data.user.id}::uuid, ${session}::uuid, ${request.method === 'GET' ? 'own' : 'vote'}, string_to_array(${ids.join(',')}, ',')::uuid[], ${value}::integer) as result`;
  const [row] = await manualQuery<Awaited<typeof query>>(query, deadline);
  return reply(request.method === 'GET' ? 200 : 201, row.result);
 } catch(error) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === '42501') return reply(403, { error: 'No puedes votar esta reseña o tu sesión ya no está vigente.' });
  if (code === '23505') return reply(409, { error: 'Ya tienes un voto irreversible. Comprueba tu voto guardado.' });
  if (code === 'P0429') return reply(429, { error: 'Has alcanzado el límite de votos. Espera antes de volver a intentarlo.' });
  if (['22023','22P02','23514','23502','23503'].includes(code)) return reply(400, { error: 'Revisa la reseña y el valor del voto.' });
  return reply(503, { error: 'No pudimos confirmar el voto. Comprueba tu voto guardado antes de reintentar.' });
 } finally { deadline.dispose(); }
}
