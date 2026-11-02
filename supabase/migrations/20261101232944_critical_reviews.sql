-- GH-022: immutable historical review format and operator-versioned editorial questions.
alter table public.reviews add column kind text not null default 'user' check(kind in ('user','critic'));
alter table public.reviews add column critic_verified boolean not null default false;
create table public.critic_questions (
 id uuid primary key default gen_random_uuid(),
 question_key text not null,
 version integer not null check(version>0),
 genre text not null default '*',
 prompt text not null check(char_length(prompt) between 10 and 500),
 provenance text not null default 'Contenido editorial propio de GameHive',
 enabled boolean not null default true,
 position integer not null default 0,
 unique(question_key,version)
);
alter table public.critic_questions enable row level security;
revoke all on public.critic_questions from public,anon,authenticated,service_role;
grant select on public.critic_questions to anon,authenticated;
create policy critic_questions_read on public.critic_questions for select to anon,authenticated using(true);
-- Existing question identities/text are immutable, including for an operator; publish a new version.
create function private.critic_question_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (to_jsonb(new)-'enabled') is distinct from (to_jsonb(old)-'enabled') then raise exception 'Publish a new question version' using errcode='22023'; end if;
 return new;
end; $$;
revoke all on function private.critic_question_immutable() from public,anon,authenticated,service_role;
create trigger critic_question_immutable before update on public.critic_questions for each row execute function private.critic_question_immutable();
insert into public.critic_questions(question_key,version,genre,prompt,position) values
 ('experience',1,'*','¿Qué experiencia propone el juego y cómo sostiene su propuesta?',1),
 ('audience',1,'*','¿A qué tipo de jugador recomendarías esta experiencia y por qué?',2),
 ('action',1,'action','¿Cómo contribuyen los controles y el ritmo a los desafíos de acción?',3),
 ('adventure',1,'adventure','¿Cómo recompensa la exploración y el descubrimiento?',4),
 ('rpg',1,'rpg','¿Qué impacto tienen la progresión y las decisiones en tu experiencia?',5),
 ('strategy',1,'strategy','¿Qué variedad de decisiones estratégicas ofrece?',6),
 ('platformer',1,'platformer','¿Cómo evolucionan la precisión y el diseño de niveles?',7),
 ('puzzle',1,'puzzle','¿Cómo introduce y desarrolla sus reglas de resolución?',8),
 ('shooter',1,'shooter','¿Cómo interactúan las armas y el diseño de encuentros?',9),
 ('racing',1,'racing','¿Cómo se sienten la conducción y la variedad de circuitos?',10),
 ('sports',1,'sports','¿Cómo comunica sus reglas y su dominio técnico?',11),
 ('simulation',1,'simulation','¿Qué profundidad y claridad presentan sus sistemas?',12),
 ('indie',1,'indie','¿Cómo utiliza sus recursos para construir una identidad propia?',13);
create table public.review_critic_details (
 review_id uuid primary key references public.reviews(id) on delete cascade,
 criteria jsonb not null check(jsonb_typeof(criteria)='object'),
 platform text not null,
 hours_played numeric not null check(hours_played between 0 and 10000),
 completed boolean not null,
 copy_provided boolean not null,
 score_reason text not null check(char_length(score_reason) between 20 and 2000)
);
create table public.review_critic_answers (
 review_id uuid not null references public.review_critic_details(review_id) on delete cascade,
 question_id uuid not null references public.critic_questions(id),
 answer text not null check(char_length(answer) between 1 and 1000),
 primary key(review_id,question_id)
);
alter table public.review_critic_details enable row level security;
alter table public.review_critic_answers enable row level security;
revoke all on public.review_critic_details,public.review_critic_answers from public,anon,authenticated,service_role;
grant select on public.review_critic_details,public.review_critic_answers to anon,authenticated;
create policy critic_details_public on public.review_critic_details for select to anon,authenticated using(exists(select 1 from public.reviews r where r.id=review_id));
create policy critic_answers_public on public.review_critic_answers for select to anon,authenticated using(exists(select 1 from public.reviews r where r.id=review_id));
create function private.review_document(r public.reviews) returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(r)||jsonb_build_object('critical', (select to_jsonb(d)-'review_id'||jsonb_build_object('answers',coalesce((select jsonb_agg(jsonb_build_object('question_id',a.question_id,'answer',a.answer,'question',to_jsonb(q)) order by q.position,q.id) from public.review_critic_answers a join public.critic_questions q on q.id=a.question_id where a.review_id=r.id),'[]'::jsonb)) from public.review_critic_details d where d.review_id=r.id));
$$;
revoke all on function private.review_document(public.reviews) from public,anon,authenticated,service_role;
create function private.critic_selected_questions(game text) returns setof public.critic_questions language sql stable security invoker set search_path='' as $$
 with genres as (
 select lower(x) as genre from public.games g cross join lateral jsonb_array_elements_text(coalesce(g.document->'genres','[]'::jsonb)) x where g.id=game
 union all select lower(x) from public.manual_games g cross join lateral unnest(g.genres) x where 'manual:'||g.id::text=lower(game)
 ), mapped as (select case genre when 'acción' then 'action' when 'aventura' then 'adventure' when 'plataformas' then 'platformer' when 'platforms' then 'platformer' when 'rol' then 'rpg' when 'estrategia' then 'strategy' when 'deportes' then 'sports' when 'carreras' then 'racing' when 'simulación' then 'simulation' when 'puzles' then 'puzzle' else genre end genre from genres)
 select q.* from public.critic_questions q where q.enabled and (q.genre='*' or q.genre in(select genre from mapped)) and not exists(select 1 from public.critic_questions n where n.question_key=q.question_key and n.enabled and n.version>q.version and (n.genre='*' or n.genre in(select genre from mapped))) order by q.position,q.id limit 12;
$$;
revoke all on function private.critic_selected_questions(text) from public,anon,authenticated,service_role;
-- Validation also executes in the DB, protecting direct internal calls and transaction rollback.
create function private.critical_score(details jsonb) returns numeric language plpgsql immutable security invoker set search_path='' as $$
declare k text; v jsonb; total numeric:=0;
begin
 if jsonb_typeof(details) is distinct from 'object' or jsonb_typeof(details->'criteria') is distinct from 'object' then raise exception 'Invalid critical details' using errcode='22023'; end if;
 if (select count(*) from jsonb_object_keys(details->'criteria'))<>8 then raise exception 'Eight criteria required' using errcode='22023'; end if;
 foreach k in array array['gameplay','narrative','art','sound','performance','accessibility','content','value'] loop
 v:=details->'criteria'->k;
 if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'score') is distinct from 'number' or jsonb_typeof(v->'explanation') is distinct from 'string' then raise exception 'Invalid criterion' using errcode='22023'; end if;
 if (v->>'score')::numeric not between 0 and 10 or (v->>'score')::numeric<>round((v->>'score')::numeric,2) or char_length(private.review_normalize(v->>'explanation'))<10 or char_length(v->>'explanation')>1000 or v->>'explanation' ~ '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]' then raise exception 'Invalid criterion' using errcode='22023'; end if;
 total:=total+(v->>'score')::numeric;
 end loop;
 if jsonb_typeof(details->'platform') is distinct from 'string' or jsonb_typeof(details->'hoursPlayed') is distinct from 'number' or (details->>'hoursPlayed')::numeric not between 0 and 10000 or jsonb_typeof(details->'completed') is distinct from 'boolean' or jsonb_typeof(details->'copyProvided') is distinct from 'boolean' or jsonb_typeof(details->'scoreReason') is distinct from 'string' or char_length(private.review_normalize(details->>'scoreReason'))<20 or char_length(details->>'scoreReason')>2000 or details->>'scoreReason' ~ '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]' or jsonb_typeof(details->'answers') is distinct from 'array' or jsonb_array_length(details->'answers')>12 then raise exception 'Invalid context' using errcode='22023'; end if;
 return round(total/8,2);
end; $$;
revoke all on function private.critical_score(jsonb) from public,anon,authenticated,service_role;
create or replace function private.sync_review_author_status() returns trigger language plpgsql security invoker set search_path='' as $$
begin update public.reviews set author_active=(new.status='active'),critic_verified=new.critic_verified where author_id=new.user_id; return new; end; $$;
drop trigger sync_review_author_status on private.authz;
create trigger sync_review_author_status after update of status,critic_verified on private.authz for each row execute function private.sync_review_author_status();
update public.reviews r set critic_verified=a.critic_verified from private.authz a where a.user_id=r.author_id;

create or replace function private.review_operation(actor uuid, session uuid, operation text, game text, expected_version integer default null, input jsonb default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare previous public.reviews; result public.reviews; rawg text; manual uuid; field text; p text[]; c text[]; r numeric; role_name text; critical jsonb; is_critical boolean:=false; qids uuid[]; answer jsonb; qid uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(718007013);
 perform 1 from auth.sessions s where s.id=session and s.user_id=actor for share;
 if not found or not exists(select 1 from private.authz a where a.user_id=actor and a.status='active') then
 raise exception 'Forbidden' using errcode='42501'; end if;
 if game ~ '^rawg:[0-9]+$' then rawg:=game;
 elsif game ~* '^manual:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then manual:=substring(game from 8)::uuid;
 else raise exception 'Invalid game' using errcode='22023'; end if;
 if not exists(select 1 from public.games where id=rawg) and not exists(select 1 from public.manual_games where id=manual) then
 raise exception 'Unknown game' using errcode='22023'; end if;
 select * into previous from public.reviews where author_id=actor and (game_id=rawg or manual_game_id=manual) for update;
 if operation='own' then return case when previous.id is null then 'null'::jsonb else private.review_document(previous) end; end if;
 if operation='questions' then
 return jsonb_build_object('questions',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from private.critic_selected_questions(game) q),'platforms',coalesce((select document->'platforms' from public.games where id=rawg),(select to_jsonb(platforms) from public.manual_games where id=manual)));
 end if;
 if operation not in ('create','update','convert','withdraw','republish') or operation is null then raise exception 'Invalid action' using errcode='22023'; end if;
 -- Current user/critic roles authorize authorship; stored kind remains historical.
 select role::text into role_name from private.authz where user_id=actor;
 if role_name not in ('user','critic') then raise exception 'Forbidden' using errcode='42501'; end if;
 if operation='create' and previous.id is not null then raise exception 'Review exists' using errcode='23505'; end if;
 if operation<>'create' then
 if previous.id is null then raise exception 'Review not found' using errcode='P0002'; end if;
 if previous.status='hidden' then raise exception 'Moderated review' using errcode='42501'; end if;
 if expected_version is null or expected_version<>previous.version then raise exception 'Version conflict' using errcode='40001'; end if;
 if (operation='withdraw' and previous.status<>'published') or (operation='republish' and previous.status<>'withdrawn') then raise exception 'State conflict' using errcode='40001'; end if;
 end if;
 if operation='convert' and role_name<>'critic' then raise exception 'Critic required for conversion' using errcode='42501'; end if;
 if operation='convert' and previous.kind<>'user' then raise exception 'Already critical' using errcode='40001'; end if;
 if operation in ('create','update','convert') then
 critical:=input->'critical';
 is_critical:=previous.kind='critic' or operation='convert' or (operation='create' and critical is not null);
 if operation='update' and previous.kind='user' and critical is not null then raise exception 'Explicit conversion required' using errcode='22023'; end if;
 if is_critical then
 if role_name='critic' then
 r:=private.critical_score(critical);
 if not (coalesce(previous.kind='critic',false) and exists(select 1 from public.review_critic_details d where d.review_id=previous.id and d.platform=critical->>'platform')) and not exists(select 1 from public.games g cross join lateral jsonb_array_elements_text(g.document->'platforms') x where g.id=rawg and x=critical->>'platform') and not exists(select 1 from public.manual_games g where g.id=manual and critical->>'platform'=any(g.platforms)) then raise exception 'Invalid platform' using errcode='22023'; end if;
 if previous.kind='critic' then select array_agg(question_id order by question_id) into qids from public.review_critic_answers where review_id=previous.id;
 else select array_agg(id order by id) into qids from private.critic_selected_questions(game); end if;
 if (select array_agg((x->>'questionId')::uuid order by (x->>'questionId')::uuid) from jsonb_array_elements(critical->'answers') x) is distinct from qids then raise exception 'Question set changed' using errcode='22023'; end if;
 for answer in select * from jsonb_array_elements(critical->'answers') loop
 if jsonb_typeof(answer->'answer') is distinct from 'string' or char_length(private.review_normalize(answer->>'answer'))<1 or char_length(answer->>'answer')>1000 or answer->>'answer' ~ '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]' then raise exception 'Invalid answer' using errcode='22023'; end if;
 end loop;
 else
 if critical is not null then raise exception 'Critical fields protected' using errcode='42501'; end if;
 r:=previous.rating;
 end if;
 input:=input||jsonb_build_object('rating',r);
 elsif critical is not null then raise exception 'Critic required' using errcode='42501'; end if;
 if input is null or jsonb_typeof(input)<>'object' then raise exception 'Invalid input' using errcode='22023'; end if;
 foreach field in array array['title','bodyPublic','bodySpoiler'] loop
 if jsonb_typeof(input->field) is distinct from 'string' or input->>field ~ '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]' then raise exception 'Invalid text' using errcode='22023'; end if;
 end loop;
 if jsonb_typeof(input->'rating') is distinct from 'number' then raise exception 'Invalid rating' using errcode='22023'; end if;
 r:=(input->>'rating')::numeric;
 if r not between 0 and 10 or char_length(input->>'title')>120 or char_length(input->>'bodyPublic')>10000 or char_length(input->>'bodySpoiler')>20000
 or char_length(private.review_normalize(input->>'title'))<3 or char_length(private.review_normalize(input->>'bodyPublic'))<20 then raise exception 'Invalid bounds' using errcode='22023'; end if;
 foreach field in array array['pros','cons'] loop
 if input ? field then
 if jsonb_typeof(input->field)<>'array' then raise exception 'Invalid points' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(input->field) x where jsonb_typeof(x)<>'string') then raise exception 'Invalid points' using errcode='22023'; end if;
 end if;
 end loop;
 p:=array(select btrim(x) from jsonb_array_elements_text(coalesce(input->'pros','[]'::jsonb)) x);
 c:=array(select btrim(x) from jsonb_array_elements_text(coalesce(input->'cons','[]'::jsonb)) x);
 if not private.review_points_valid(p) or not private.review_points_valid(c) then raise exception 'Invalid points' using errcode='22023'; end if;
 if operation in ('update','convert') and r<>previous.rating and private.review_normalize(input->>'bodyPublic')=private.review_normalize(previous.body_public) then raise exception 'Opinion required' using errcode='22023'; end if;
 end if;
 if operation='create' then
 insert into public.reviews(author_id,game_id,manual_game_id,rating,title,body_public,body_spoiler,pros,cons,author_active)
 values(actor,rawg,manual,r,btrim(input->>'title'),btrim(input->>'bodyPublic'),input->>'bodySpoiler',p,c,true) returning * into result;
 elsif operation in ('update','convert') then
 update public.reviews set rating=r,title=btrim(input->>'title'),body_public=btrim(input->>'bodyPublic'),body_spoiler=input->>'bodySpoiler',pros=p,cons=c,version=version+1,updated_at=clock_timestamp() where id=previous.id returning * into result;
 else
 update public.reviews set status=case operation when 'withdraw' then 'withdrawn' else 'published' end,version=version+1,updated_at=clock_timestamp() where id=previous.id returning * into result;
 end if;
 if is_critical and role_name='critic' then
 update public.reviews set kind='critic',critic_verified=(select a.critic_verified from private.authz a where a.user_id=actor) where id=result.id returning * into result;
 insert into public.review_critic_details(review_id,criteria,platform,hours_played,completed,copy_provided,score_reason)
 values(result.id,critical->'criteria',critical->>'platform',(critical->>'hoursPlayed')::numeric,(critical->>'completed')::boolean,(critical->>'copyProvided')::boolean,btrim(critical->>'scoreReason'))
 on conflict(review_id) do update set criteria=excluded.criteria,platform=excluded.platform,hours_played=excluded.hours_played,completed=excluded.completed,copy_provided=excluded.copy_provided,score_reason=excluded.score_reason;
 for answer in select * from jsonb_array_elements(critical->'answers') loop
 qid:=(answer->>'questionId')::uuid;
 insert into public.review_critic_answers(review_id,question_id,answer) values(result.id,qid,btrim(answer->>'answer')) on conflict(review_id,question_id) do update set answer=excluded.answer;
 end loop;
 end if;
 insert into private.audit_logs(actor_id,target_id,action,reason,before_data,after_data)
 values(actor,actor,'review.'||operation,'Author review operation',
 case when previous.id is null then '{}'::jsonb else jsonb_build_object('reviewId',previous.id,'version',previous.version,'status',previous.status) end,
 jsonb_build_object('reviewId',result.id,'gameId',game,'version',result.version,'status',result.status));
 return private.review_document(result);
end; $$;
revoke all on function private.review_operation(uuid,uuid,text,text,integer,jsonb) from public,anon,authenticated,service_role;
